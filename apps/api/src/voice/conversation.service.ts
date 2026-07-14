import { Injectable } from '@nestjs/common';
import { ProviderRouterService } from '../provider-router/provider-router.service';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface QuestionBrief {
  id: string;
  prompt: string;
  topic: string;
  subtopic: string;
  difficulty: number;
}

interface ConversationState {
  sessionId: string;
  field: string;
  role: string;
  history: Message[];
  turnCount: number;
  currentDifficulty: number; // 1=Easy, 2=Medium, 3=Hard
  phase: 'intro' | 'interview' | 'wrap-up';
  currentQuestion: string | null;
  allQuestions: QuestionBrief[];
  questionIndex: number;
  /** True once the interviewer has given ONE drill-down on the current question */
  drillUsed: boolean;
  /** IDs of questions already answered/drilled — for dedup on re-start */
  answeredQuestionIds: string[];
  /** Signals that the interview questions are exhausted — gateway can wrap up */
  interviewComplete: boolean;
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
5. DRILL POLICY — exactly one drill per question, no more:
   - If the candidate answers INCORRECTLY or partially, give ONE brief correction or hint ("Actually, the key point here is X…").
   - After giving that one correction, say something like "Okay, let's move on." and transition to the NEXT question in your list.
   - Do NOT drill the same question again after you have already given the correction once.
   - If the candidate answered correctly, acknowledge it naturally and move straight to the next question.
6. Use natural transitions: "Okay, let's shift gears..." / "Building on what you just said..."
7. When you have covered ALL questions in your list, say exactly: "That covers all the questions I had prepared." and wrap up warmly.

CONVERSATION FLOW:
PHASE intro: Greet warmly. Mention the role. Ask exactly ONE casual warm-up question (e.g., "What have you been working on recently?"). DO NOT ask any technical questions from your list yet. Wait for the user to answer.
PHASE interview: Work through your prepared question list in order. Follow the drill policy above strictly.
PHASE wrap-up: Close warmly, mention 1–2 things they did well specifically.

CURRENT STATE:
Phase: {{PHASE}}
Turn: {{TURN}}
Drill already used on current question: {{DRILL_USED}}
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
      phase: 'intro',
      currentQuestion: firstQuestion,
      allQuestions: questions,
      questionIndex: 0,
      drillUsed: false,
      answeredQuestionIds: [],
      interviewComplete: false,
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
   * wasCorrect is set by the gateway after submitAnswer classification comes back.
   */
  async processTurn(
    socketId: string,
    userTranscript: string,
    wasCorrect?: boolean,
  ): Promise<{ text: string; shouldAdvance: boolean; interviewComplete: boolean }> {
    const state = this.conversations.get(socketId);
    if (!state) {
      throw new Error('No active conversation for this socket');
    }

    // After intro phase (turn 2+), move to interview phase
    if (state.phase === 'intro' && state.turnCount >= 2) {
      state.phase = 'interview';
      state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
    }

    // Determine whether to advance question based on answer correctness and drill policy
    let shouldAdvance = false;

    if (state.phase === 'interview' && wasCorrect !== undefined) {
      if (wasCorrect) {
        // Correct answer → advance immediately
        shouldAdvance = true;
      } else {
        // Incorrect answer
        if (state.drillUsed) {
          // Already drilled once → advance regardless
          shouldAdvance = true;
        } else {
          // First wrong answer → mark drill used, do NOT advance yet (Alex will correct)
          state.drillUsed = true;
        }
      }
    }

    // If advancing, move the question index forward
    if (shouldAdvance && state.phase === 'interview') {
      const currentQId = state.allQuestions[state.questionIndex]?.id;
      if (currentQId) state.answeredQuestionIds.push(currentQId);

      state.questionIndex++;
      state.drillUsed = false; // reset drill for the new question

      if (state.questionIndex >= state.allQuestions.length) {
        // All questions exhausted
        state.phase = 'wrap-up';
        state.interviewComplete = true;
        state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
      } else {
        const nextQ = state.allQuestions[state.questionIndex];
        state.currentQuestion = nextQ.prompt;
        state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
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

    // Keep history manageable: system prompt + last 20 messages
    if (state.history.length > 22) {
      state.history = [state.history[0], ...state.history.slice(-20)];
    }

    return { text: aiText, shouldAdvance, interviewComplete: state.interviewComplete };
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

  /** Returns IDs of questions that have already been answered in this conversation */
  getAnsweredQuestionIds(socketId: string): string[] {
    return this.conversations.get(socketId)?.answeredQuestionIds ?? [];
  }

  /** Returns true if all prepared questions have been covered */
  isInterviewComplete(socketId: string): boolean {
    return this.conversations.get(socketId)?.interviewComplete ?? false;
  }

  /**
   * Called by the gateway once a new question is fetched from the DB
   * (after the current question is advanced). Updates the question queue
   * in-memory so Alex has the fresh question context.
   */
  pushNextQuestion(socketId: string, question: QuestionBrief): void {
    const state = this.conversations.get(socketId);
    if (!state) return;
    state.allQuestions.push(question);
    // If we just ran out and this is the new question, update currentQuestion
    if (state.questionIndex < state.allQuestions.length) {
      state.currentQuestion = state.allQuestions[state.questionIndex].prompt;
      state.history[0] = { role: 'system', content: this.buildSystemPrompt(state) };
    }
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
      .replace('{{DRILL_USED}}', state.drillUsed ? 'YES — do NOT drill again, move on after responding' : 'NO')
      .replace('{{CURRENT_QUESTION}}', state.currentQuestion || 'Continue naturally');
  }
}
