import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

import { ProviderRouterService } from '../provider-router/provider-router.service';
import { ConversationService } from './conversation.service';
import { SessionsService } from '../sessions/sessions.service';
import { QuestionsService } from '../questions/questions.service';
import { Question } from '@prisma/client';

/** Per-socket runtime state stored in the gateway (not in ConversationService) */
interface GatewaySocketState {
  currentQuestion: Question | null;
  sessionId: string;
  userId: string;
  field: string;
}

@WebSocketGateway({ cors: true })
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  /** Per-socket state (currentQuestion, sessionId, userId, field) */
  private socketState = new Map<string, GatewaySocketState>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly providerRouter: ProviderRouterService,
    private readonly conversationService: ConversationService,
    private readonly sessionsService: SessionsService,
    private readonly questionsService: QuestionsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      let token =
        client.handshake.auth?.token || client.handshake.headers?.authorization;
      if (!token) throw new Error('No token provided');
      if (token.startsWith('Bearer ')) token = token.split(' ')[1];

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'fallback_secret',
      });
      client.data.user = payload;
      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (e: any) {
      this.logger.warn(`Unauthorized: ${e.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.conversationService.cleanup(client.id);
    this.socketState.delete(client.id);
  }

  /**
   * Start a new voice interview session.
   * AI greets the candidate and speaks the intro question via TTS.
   */
  @SubscribeMessage('start_voice_session')
  async handleStartVoiceSession(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      sessionId: string;
      field?: string;
      role?: string;
      difficulty?: number;
      questions?: Array<{ id: string; prompt: string; topic: string; subtopic: string; difficulty: number }>;
      firstQuestion?: string;
    },
  ) {
    this.logger.log(`Starting voice session for ${client.id}`);
    try {
      const field = payload.field || 'Full-stack Engineering';
      const role = payload.role || field;
      const difficulty = payload.difficulty || 1;
      const questions = payload.questions || [];
      const firstQuestion = payload.firstQuestion || questions[0]?.prompt || 'Tell me about a recent technical challenge you faced.';

      // Store gateway-level socket state
      const firstQ = questions[0] ?? null;
      this.socketState.set(client.id, {
        currentQuestion: firstQ
          ? {
              id: firstQ.id,
              source_db: 'seed',
              topic: firstQ.topic,
              subtopic: firstQ.subtopic || field,
              difficulty: firstQ.difficulty,
              prompt: firstQ.prompt,
              rubric_points: [],
              tags: [],
              last_refreshed_at: new Date(),
            }
          : null,
        sessionId: payload.sessionId,
        userId: client.data.user?.sub,
        field,
      });

      // Initialize conversation — get AI greeting text
      const greetingText = await this.conversationService.startConversation(
        client.id,
        payload.sessionId,
        field,
        role,
        difficulty,
        questions,
        firstQuestion,
      );

      // Convert greeting to speech
      const { audio, mimeType } = await this.providerRouter.synthesizeSpeech(
        greetingText,
        payload.sessionId,
      );

      client.emit('voice_session_started', { success: true });
      client.emit('ai_text', { text: greetingText });
      client.emit('audio_response', { delta: audio, mimeType });
      this.logger.log(`Sent opening greeting for session ${payload.sessionId}`);
    } catch (err: any) {
      this.logger.error(`Error starting voice session: ${err.message}`);
      client.emit('voice_error', { message: `Failed to start voice session: ${err.message}` });
    }
  }

  /**
   * Process a user's voice turn:
   *   1. Submit answer to DB (classification + skill-profile update)
   *   2. Feed classification into ConversationService so it can decide drill/advance
   *   3. Get AI response text
   *   4. If advancing, fetch next question from DB and emit question_advanced
   *   5. Synthesize TTS and emit audio
   */
  @SubscribeMessage('voice_turn')
  async handleVoiceTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      transcript: string;
      sessionId: string;
    },
  ) {
    if (!payload.transcript?.trim()) return;
    this.logger.log(`voice_turn from ${client.id}: "${payload.transcript.slice(0, 80)}..."`);

    const state = this.socketState.get(client.id);
    if (!state) {
      client.emit('voice_error', { message: 'Session state not found. Please restart.' });
      return;
    }

    try {
      // ── Step 1: Persist answer to DB if we have a current question ──────────
      let wasCorrect: boolean | undefined = undefined;
      let nextQuestion: Question | null = null;

      if (state.currentQuestion) {
        try {
          const submitResult = await this.sessionsService.submitAnswer(
            state.sessionId,
            state.currentQuestion,
            payload.transcript.trim(),
          );

          const classification = submitResult.answer.classification;
          wasCorrect = classification === 'correct';

          // Emit the classification to the client so the UI can update
          client.emit('answer_classified', {
            classification,
            confidence: submitResult.answer.confidence,
            reasoning: submitResult.answer.reasoning,
            questionId: state.currentQuestion.id,
          });

          // Hold onto the DB-returned next question for after conversation processing
          nextQuestion = submitResult.nextQuestion ?? null;
        } catch (dbErr: any) {
          // Non-fatal: log but don't break the voice turn
          this.logger.error(`Failed to persist voice answer to DB: ${dbErr.message}`);
        }
      }

      // ── Step 2: Process conversational turn with drill logic ──────────────
      const { text: aiText, shouldAdvance, interviewComplete } = await this.conversationService.processTurn(
        client.id,
        payload.transcript,
        wasCorrect,
      );

      // ── Step 3: Advance question in gateway state if needed ──────────────
      if (shouldAdvance) {
        if (nextQuestion) {
          // Update gateway state with the new question from DB
          state.currentQuestion = nextQuestion;
          // Push new question context into the conversation in-memory state
          this.conversationService.pushNextQuestion(client.id, {
            id: nextQuestion.id,
            prompt: nextQuestion.prompt,
            topic: nextQuestion.topic,
            subtopic: nextQuestion.subtopic,
            difficulty: nextQuestion.difficulty,
          });
          // Tell client about the new question
          client.emit('question_advanced', { nextQuestion, interviewComplete: false });
        } else if (!interviewComplete) {
          // Fetch a fresh question from the DB (LLM generation fallback included)
          try {
            const seenIds = this.conversationService.getAnsweredQuestionIds(client.id);
            const fresh = await this.questionsService.getNextQuestion(
              state.userId,
              state.field.toLowerCase().replace(/\s+/g, '-'),
              undefined,
              this.conversationService.getCurrentDifficulty(client.id),
              seenIds,
            );
            state.currentQuestion = fresh;
            this.conversationService.pushNextQuestion(client.id, {
              id: fresh.id,
              prompt: fresh.prompt,
              topic: fresh.topic,
              subtopic: fresh.subtopic,
              difficulty: fresh.difficulty,
            });
            client.emit('question_advanced', { nextQuestion: fresh, interviewComplete: false });
          } catch (fetchErr: any) {
            this.logger.warn(`Could not fetch next question: ${fetchErr.message}`);
          }
        } else {
          // All done
          client.emit('question_advanced', { nextQuestion: null, interviewComplete: true });
        }
      }

      // ── Step 4: Synthesize TTS and emit ──────────────────────────────────
      const { audio, mimeType } = await this.providerRouter.synthesizeSpeech(
        aiText,
        payload.sessionId,
      );

      client.emit('ai_text', { text: aiText });
      client.emit('audio_response', { delta: audio, mimeType });
      this.logger.log(`Sent AI response for turn in session ${payload.sessionId}`);
    } catch (err: any) {
      this.logger.error(`Error processing voice turn: ${err.message}`);
      client.emit('voice_error', { message: `Voice processing failed: ${err.message}` });
    }
  }

  /**
   * Gracefully end the conversation — AI gives a warm closing.
   */
  @SubscribeMessage('end_voice_session')
  async handleEndVoiceSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId: string },
  ) {
    try {
      const closingText = await this.conversationService.endConversation(client.id);
      const { audio, mimeType } = await this.providerRouter.synthesizeSpeech(
        closingText,
        payload.sessionId,
      );
      client.emit('ai_text', { text: closingText });
      client.emit('audio_response', { delta: audio, mimeType });
    } catch (err: any) {
      this.logger.error(`Error ending voice session: ${err.message}`);
    } finally {
      this.socketState.delete(client.id);
    }
  }
}
