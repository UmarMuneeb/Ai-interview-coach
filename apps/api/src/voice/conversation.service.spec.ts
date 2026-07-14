import { ConversationService } from './conversation.service';
import { ProviderRouterService } from '../provider-router/provider-router.service';

describe('ConversationService', () => {
  let service: ConversationService;
  let mockProviderRouter: jest.Mocked<Pick<ProviderRouterService, 'complete'>>;

  const SOCKET_ID = 'test-socket-123';
  const SESSION_ID = 'session-abc';

  const mockQuestion = (id: string, prompt: string) => ({
    id,
    prompt,
    topic: 'fullstack',
    subtopic: 'react',
    difficulty: 2,
  });

  const mockQuestions = [
    mockQuestion('q1', 'Explain React hooks.'),
    mockQuestion('q2', 'What is the virtual DOM?'),
    mockQuestion('q3', 'How does context API work?'),
  ];

  beforeEach(() => {
    mockProviderRouter = {
      complete: jest.fn().mockResolvedValue({ content: 'AI response text' }),
    };

    service = new ConversationService(
      mockProviderRouter as unknown as ProviderRouterService,
    );
  });

  afterEach(() => {
    service.cleanup(SOCKET_ID);
    jest.clearAllMocks();
  });

  // ── startConversation ────────────────────────────────────────────────────
  describe('startConversation', () => {
    it('returns AI greeting text', async () => {
      const greeting = await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      expect(greeting).toBe('AI response text');
    });

    it('initialises state with phase=intro and drillUsed=false', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      expect(service.isInterviewComplete(SOCKET_ID)).toBe(false);
      expect(service.getAnsweredQuestionIds(SOCKET_ID)).toEqual([]);
    });
  });

  // ── processTurn — phase transition ─────────────────────────────────────
  describe('processTurn — intro → interview transition', () => {
    it('transitions from intro to interview after turn 2', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      // turn 0 was the greeting, turn 1 is the first user reply
      await service.processTurn(SOCKET_ID, 'Hello!');
      // turn 2 — should trigger transition
      const result = await service.processTurn(SOCKET_ID, 'I am a developer');
      expect(result.text).toBe('AI response text');
      expect(mockProviderRouter.complete).toHaveBeenCalledTimes(3); // start + 2 turns
    });
  });

  // ── processTurn — 1-drill-max policy ─────────────────────────────────
  describe('processTurn — drill policy', () => {
    beforeEach(async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      // Manually push through intro phase (needs 2+ turns)
      await service.processTurn(SOCKET_ID, 'Hello');
      await service.processTurn(SOCKET_ID, 'Ready to start');
    });

    it('does NOT advance on first wrong answer (drill allowed)', async () => {
      const result = await service.processTurn(SOCKET_ID, 'Wrong answer', false);
      expect(result.shouldAdvance).toBe(false);
      expect(result.interviewComplete).toBe(false);
    });

    it('DOES advance on second wrong answer (drill already used)', async () => {
      // First wrong: drill used
      await service.processTurn(SOCKET_ID, 'Wrong answer', false);
      // Second wrong: must advance regardless
      const result = await service.processTurn(SOCKET_ID, 'Still wrong', false);
      expect(result.shouldAdvance).toBe(true);
    });

    it('advances immediately on correct answer', async () => {
      const result = await service.processTurn(SOCKET_ID, 'Correct answer!', true);
      expect(result.shouldAdvance).toBe(true);
    });

    it('resets drillUsed after advancing to next question', async () => {
      // Correct answer on q1 → advance to q2
      await service.processTurn(SOCKET_ID, 'Correct!', true);
      // First wrong on q2 should NOT advance (drill reset)
      const result = await service.processTurn(SOCKET_ID, 'Wrong on q2', false);
      expect(result.shouldAdvance).toBe(false);
    });
  });

  // ── processTurn — question exhaustion ────────────────────────────────
  describe('processTurn — question exhaustion', () => {
    it('sets interviewComplete when all questions answered', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      // Push through intro
      await service.processTurn(SOCKET_ID, 'Hello');
      await service.processTurn(SOCKET_ID, 'Ready');

      // Answer all 3 questions correctly
      for (let i = 0; i < mockQuestions.length; i++) {
        await service.processTurn(SOCKET_ID, `Answer ${i}`, true);
      }

      const result = await service.processTurn(SOCKET_ID, 'Any final words', true);
      expect(result.interviewComplete).toBe(true);
    });
  });

  // ── getAnsweredQuestionIds ────────────────────────────────────────────
  describe('getAnsweredQuestionIds', () => {
    it('returns empty array before any question is answered', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      expect(service.getAnsweredQuestionIds(SOCKET_ID)).toEqual([]);
    });

    it('accumulates answered question IDs after correct answers', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      await service.processTurn(SOCKET_ID, 'Hello');
      await service.processTurn(SOCKET_ID, 'Ready');

      // Answer q1 correctly → q1 should be in answered IDs
      await service.processTurn(SOCKET_ID, 'Correct!', true);
      const ids = service.getAnsweredQuestionIds(SOCKET_ID);
      expect(ids).toContain('q1');
    });
  });

  // ── pushNextQuestion ─────────────────────────────────────────────────
  describe('pushNextQuestion', () => {
    it('adds a new question to the in-memory queue without throwing', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1,
        [mockQuestion('q1', 'Question 1'), mockQuestion('q2', 'Question 2')],
        'Question 1',
      );
      await service.processTurn(SOCKET_ID, 'Hello');
      await service.processTurn(SOCKET_ID, 'Ready');

      // Answer q1 correctly — advances to q2
      const r1 = await service.processTurn(SOCKET_ID, 'Good answer for q1', true);
      expect(r1.shouldAdvance).toBe(true);
      expect(r1.interviewComplete).toBe(false); // q2 still pending

      // Push an additional question from the gateway (simulating DB fetch)
      // Should not throw even if questions remain
      expect(() =>
        service.pushNextQuestion(SOCKET_ID, mockQuestion('q3', 'Question 3'))
      ).not.toThrow();
    });
  });

  // ── cleanup ──────────────────────────────────────────────────────────
  describe('cleanup', () => {
    it('removes conversation state for disconnected socket', async () => {
      await service.startConversation(
        SOCKET_ID, SESSION_ID, 'Full-stack', 'Engineer', 1, mockQuestions, 'Explain hooks',
      );
      service.cleanup(SOCKET_ID);
      expect(service.getAnsweredQuestionIds(SOCKET_ID)).toEqual([]);
      expect(service.isInterviewComplete(SOCKET_ID)).toBe(false);
    });
  });
});
