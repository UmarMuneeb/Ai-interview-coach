import { Injectable } from '@nestjs/common';
import { ProviderRouterService } from '../provider-router/provider-router.service';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QuestionBrief {
  prompt: string;
  topic: string;
  difficulty: number;
}

interface ConversationState {
  sessionId: string;
  field: string;
  role: string;
  history: Message[];
  turnCount: number;
  currentDifficulty: number; // 1=Easy, 2=Medium, 3=Hard
  consecutiveCorrect: number;
  phase: 'intro' | 'interview' | 'wrap-up';
  currentQuestion: string | null;
  allQuestions: QuestionBrief[];
  questionIndex: number;
}

// Template — placeholders get replaced at runtime
const INTERVIEWER_SYSTEM_PROMPT = `You are Alex, a warm and experienced interviewer conducting a real technical interview for a {{ROLE}} position.
You are NOT a chatbot or assistant. You are a human interviewer. Do not break character.

THE INTERVIEW CONTEXT:
- Role being interviewed for: {{ROLE}}
- Field / domain: {{FIELD}}
- Difficulty level for this session: {{DIFFICULTY}}
- Total questions in queue: {{QUESTION_COUNT}}

YOUR PREPARED QUESTIONS (ask them in order, paraphrasing naturally — never read verbatim):
{{QUESTION_LIST}}

YOUR PERSONALITY:
- Warm, encouraging, and genuinely curious.
- Like the best technical interviewer the candidate has ever met.
- Conversational — you make the candidate feel comfortable, not interrogated.

STRICT RULES:
1. Keep each response to 2–4 sentences MAX.
2. NEVER ask more than one question per turn.
3. Never say "Correct!", "That is correct!", "Great job!" robotically. Use natural language.
4. Never read a question word-for-word — paraphrase naturally into conversation.
5. After EVERY answer, ask a follow-up to dig deeper before moving to the next question.
6. Give encouraging nudges when stuck: "Maybe think about it from the angle of X..."
7. Use natural transitions: "Okay, let's shift gears..." / "Building on what you just said..."

CONVERSATION FLOW:
PHASE intro: Greet warmly. Mention the role. Ask exactly ONE casual warm-up question (e.g., "What have you been working on recently?"). DO NOT ask any technical questions from your list yet. Wait for the user to answer.
PHASE interview: Work through your prepared question list. Follow the difficulty progression. Always follow up before moving on.
PHASE wrap-up: Close warmly, mention 1–2 things they did well specifically.

CURRENT STATE:
Phase: {{PHASE}}
Turn: {{TURN}}
Next question to work toward (ONLY if phase is interview): {{CURRENT_QUESTION}}`;

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
    role: string,
    difficulty: number,
    questions: QuestionBrief[],
    firstQuestion: string,
  ): Promise<string> {
    const state: ConversationState = {
      sessionId,
      field,
      role,
      history: [],
      turnCount: 0,
      currentDifficulty: difficulty,
      consecutiveCorrect: 0,
      phase: 'intro',
      currentQuestion: firstQuestion,
      allQuestions: questions,
      questionIndex: 0,
    };
    this.conversations.set(socketId, state);

    const systemPrompt = this.buildSystemPrompt(state);
    state.history.push({ role: 'system', content: systemPrompt });

    // Trigger the greeting
    const userMsg = '[SYSTEM] Start the interview now. Do the intro phase greeting.';
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

    // Update current question if provided
    if (currentQuestion) {
      state.currentQuestion = currentQuestion;
    }

    // After intro phase (turn 2), move to interview phase
    if (state.phase === 'intro' && state.turnCount >= 2) {
      state.phase = 'interview';
      state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
    }

    // Track difficulty escalation
    if (wasCorrect !== undefined) {
      if (wasCorrect) {
        state.consecutiveCorrect++;
        if (state.consecutiveCorrect >= 2 && state.currentDifficulty < 3) {
          state.currentDifficulty++;
          state.consecutiveCorrect = 0;
          state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
        }
      } else {
        state.consecutiveCorrect = 0;
      }
    }

    // Advance question index after follow-up (every 2 turns in interview)
    if (state.phase === 'interview' && state.turnCount % 2 === 0 && state.allQuestions.length > 0) {
      state.questionIndex = Math.min(state.questionIndex + 1, state.allQuestions.length - 1);
      const nextQ = state.allQuestions[state.questionIndex];
      if (nextQ) {
        state.currentQuestion = nextQ.prompt;
      }
      state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
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

    // Keep history manageable: system prompt + last 20 messages
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
      content: '[SYSTEM] The interview session is ending. Give the wrap-up now.',
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

  cleanup(socketId: string): void {
    this.conversations.delete(socketId);
  }

  getCurrentDifficulty(socketId: string): number {
    return this.conversations.get(socketId)?.currentDifficulty ?? 1;
  }

  private buildSystemPrompt(state: ConversationState): string {
    const difficultyLabels: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

    // Build numbered question list for the prompt
    const questionList = state.allQuestions.length > 0
      ? state.allQuestions
          .map((q, i) => `  ${i + 1}. [${difficultyLabels[q.difficulty] || 'Medium'}] ${q.prompt}`)
          .join('\n')
      : `  1. ${state.currentQuestion || 'Ask relevant technical questions for this role'}`;

    return INTERVIEWER_SYSTEM_PROMPT
      .replace(/{{ROLE}}/g, state.role || state.field)
      .replace(/{{FIELD}}/g, state.field)
      .replace(/{{DIFFICULTY}}/g, `${state.currentDifficulty} — ${difficultyLabels[state.currentDifficulty] || 'Medium'}`)
      .replace('{{QUESTION_COUNT}}', `${state.allQuestions.length}`)
      .replace('{{QUESTION_LIST}}', questionList)
      .replace('{{PHASE}}', state.phase)
      .replace('{{TURN}}', `${state.turnCount}`)
      .replace('{{CURRENT_QUESTION}}', state.currentQuestion || 'Continue naturally');
  }
}
