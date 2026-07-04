import { Injectable } from '@nestjs/common';
import { ProviderRouterService } from '../provider-router/provider-router.service';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ConversationState {
  sessionId: string;
  field: string;
  history: Message[];
  turnCount: number;
  currentDifficulty: number; // 1=Easy, 2=Medium, 3=Hard
  consecutiveCorrect: number;
  phase: 'intro' | 'interview' | 'wrap-up';
  currentQuestion: string | null;
}

const INTERVIEWER_SYSTEM_PROMPT = `You are Alex, a warm and experienced senior engineer conducting a technical interview.
Your personality: friendly, encouraging, curious, and thorough — like the best interviewer you've ever met.
You are NOT a chatbot. You are a real human interviewer having a natural conversation.

CORE RULES:
- Keep every response to 2–4 sentences MAX. This is a conversation, not a lecture.
- Never say "Correct!", "That is correct!", or any robotic affirmations. Use natural language.
- Never read a question verbatim from a script — paraphrase it naturally as a conversation.
- Always ask follow-up questions to go deeper after any answer.
- When a candidate is stuck, offer a gentle prod like "Maybe think about it from the angle of..."
- Use natural transitions between topics: "Okay, let's shift gears a bit..." or "Building on that..."

CONVERSATION PHASES:

PHASE: intro
- Greet the candidate warmly and briefly introduce the format in 1–2 sentences.
- Ask ONE light warm-up question about what they have been working on recently.
- Listen to their answer and give a genuine, warm acknowledgement before moving to technical questions.

PHASE: interview
- Start with easier conceptual questions, then gradually move to harder design/architecture questions.
- After EVERY answer (correct or not), ask at least one follow-up that digs deeper:
  * "Great — can you walk me through how that works under the hood?"
  * "Interesting approach — what would happen if you had to scale that to 10 million users?"
  * "You mentioned X — how does that interact with Y?"
- Use natural positive affirmations when answers are good:
  * "That's a solid approach."  "Good thinking."  "Exactly right, yeah."
- When an answer is incomplete or wrong, be encouraging and give a gentle nudge:
  * "You're on the right track — what about the caching layer?"
  * "Close! Think about what happens when two requests come in simultaneously..."
- Mirror the candidate's energy — if they get excited about a topic, explore it more.

PHASE: wrap-up
- Give a warm, encouraging close: "That wraps us up — you covered a lot of ground today."
- Mention 1–2 specific things they did well.

CURRENT SESSION CONTEXT:
Field: {{FIELD}}
Current difficulty: {{DIFFICULTY}} (1=Easy, 2=Medium, 3=Hard)
Turn: {{TURN}}
Current question to guide toward (do NOT read verbatim, paraphrase naturally): {{QUESTION}}`;

@Injectable()
export class ConversationService {
  // In-memory conversation state per socket connection
  private conversations = new Map<string, ConversationState>();

  constructor(private readonly providerRouter: ProviderRouterService) {}

  /**
   * Initialize a new conversation for a socket connection.
   * Returns the opening greeting text.
   */
  async startConversation(
    socketId: string,
    sessionId: string,
    field: string,
    firstQuestion: string,
  ): Promise<string> {
    const state: ConversationState = {
      sessionId,
      field,
      history: [],
      turnCount: 0,
      currentDifficulty: 1,
      consecutiveCorrect: 0,
      phase: 'intro',
      currentQuestion: firstQuestion,
    };
    this.conversations.set(socketId, state);

    const systemPrompt = this.buildSystemPrompt(state);
    state.history.push({ role: 'system', content: systemPrompt });

    // Get AI opening greeting
    const userMsg = '[INTRO] Start the interview. Greet the candidate and ask your warm-up question.';
    state.history.push({ role: 'user', content: userMsg });

    const response = await this.providerRouter.complete({
      purpose: 'voice-interview-conversation',
      sessionId,
      messages: state.history,
    });

    const aiText = response.content as string;
    state.history.push({ role: 'assistant', content: aiText });
    state.turnCount++;

    return aiText;
  }

  /**
   * Process a user's spoken turn. Returns the AI's response text.
   */
  async processTurn(
    socketId: string,
    userTranscript: string,
    currentQuestion?: string,
    wasCorrect?: boolean,
  ): Promise<string> {
    const state = this.conversations.get(socketId);
    if (!state) {
      throw new Error('No active conversation for this socket');
    }

    // Update question context if provided
    if (currentQuestion) {
      state.currentQuestion = currentQuestion;
    }

    // After intro phase (2 turns), move to interview phase
    if (state.phase === 'intro' && state.turnCount >= 2) {
      state.phase = 'interview';
      // Rebuild system prompt with updated phase
      state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
    }

    // Track difficulty escalation
    if (wasCorrect !== undefined) {
      if (wasCorrect) {
        state.consecutiveCorrect++;
        if (state.consecutiveCorrect >= 2 && state.currentDifficulty < 3) {
          state.currentDifficulty++;
          state.consecutiveCorrect = 0;
          // Rebuild system prompt with new difficulty
          state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
        }
      } else {
        state.consecutiveCorrect = 0;
      }
    }

    state.history.push({ role: 'user', content: userTranscript });

    const response = await this.providerRouter.complete({
      purpose: 'voice-interview-conversation',
      sessionId: state.sessionId,
      messages: state.history,
    });

    const aiText = response.content as string;
    state.history.push({ role: 'assistant', content: aiText });
    state.turnCount++;

    // Keep history manageable: keep system prompt + last 20 messages
    if (state.history.length > 22) {
      state.history = [state.history[0], ...state.history.slice(-20)];
    }

    return aiText;
  }

  /**
   * Transition to wrap-up phase and get closing message.
   */
  async endConversation(socketId: string): Promise<string> {
    const state = this.conversations.get(socketId);
    if (!state) return 'That wraps up our session. Great work today!';

    state.phase = 'wrap-up';
    state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
    state.history.push({
      role: 'user',
      content: '[WRAP-UP] The interview session is ending. Give a warm, encouraging close.',
    });

    try {
      const response = await this.providerRouter.complete({
        purpose: 'voice-interview-conversation',
        sessionId: state.sessionId,
        messages: state.history,
      });
      return response.content as string;
    } finally {
      this.conversations.delete(socketId);
    }
  }

  /**
   * Clean up conversation state when socket disconnects.
   */
  cleanup(socketId: string): void {
    this.conversations.delete(socketId);
  }

  getCurrentDifficulty(socketId: string): number {
    return this.conversations.get(socketId)?.currentDifficulty ?? 1;
  }

  private buildSystemPrompt(state: ConversationState): string {
    const difficultyLabels: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
    return INTERVIEWER_SYSTEM_PROMPT
      .replace('{{FIELD}}', state.field)
      .replace('{{DIFFICULTY}}', `${state.currentDifficulty} (${difficultyLabels[state.currentDifficulty] || 'Medium'})`)
      .replace('{{TURN}}', `${state.turnCount}`)
      .replace('{{QUESTION}}', state.currentQuestion || 'No specific question — continue the conversation naturally');
  }
}
