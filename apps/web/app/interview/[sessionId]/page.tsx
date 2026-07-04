'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '../../components/AppLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Phase = 'loading' | 'interview' | 'transitioning' | 'error';
type Classification = 'correct' | 'incorrect' | 'partial' | 'misunderstood' | 'evasive';

interface Question {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: number;
  prompt: string;
  rubric_points: string[];
  tags: string[];
  source_db: string;
  last_refreshed_at: string;
}

interface AnswerResult {
  answer: {
    classification: Classification;
    confidence: number;
    reasoning: string;
  };
  nextQuestion: Question;
}

const CLASSIFICATION_CONFIG: Record<Classification, { label: string; color: string; bg: string; icon: string }> = {
  correct:       { label: 'Correct',       color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '✓' },
  partial:       { label: 'Partial',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: '◐' },
  incorrect:     { label: 'Incorrect',      color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: '✗' },
  misunderstood: { label: 'Off-track',      color: '#a855f7', bg: 'rgba(168,85,247,0.08)', icon: '?' },
  evasive:       { label: 'Evasive',        color: '#64748b', bg: 'rgba(100,116,139,0.08)',icon: '~' },
};

const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

export default function InterviewPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [question, setQuestion] = useState<Question | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEndingSession, setIsEndingSession] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getToken = useCallback(() => {
    const token = localStorage.getItem('ai_coach_token');
    if (!token) { router.push('/login'); return null; }
    return token;
  }, [router]);

  const fetchQuestion = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/questions/mock`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch question');
      const q = await res.json();
      setQuestion(q);
      setPhase('interview');
      setTranscript('');
      setLastResult(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (err: any) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, [getToken]);

  // Load session and first question on mount
  useEffect(() => {
    if (!sessionId) return;
    const token = localStorage.getItem('ai_coach_token');
    if (!token) { router.push('/login'); return; }
    fetchQuestion();
  }, [sessionId, router, fetchQuestion]);

  async function handleSubmitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim() || !question || isSubmitting) return;

    const token = getToken();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, transcript: transcript.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to submit answer');
      }
      const result: AnswerResult = await res.json();
      setLastResult(result);
      setAnsweredCount(c => c + 1);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNextQuestion() {
    if (lastResult?.nextQuestion) {
      setQuestion(lastResult.nextQuestion);
      setTranscript('');
      setLastResult(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } else {
      fetchQuestion();
    }
  }

  async function handleEndInterview() {
    const token = getToken();
    if (!token) return;
    setIsEndingSession(true);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/transition`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to end session');
      router.push(`/interview/${sessionId}/tutor`);
    } catch (err: any) {
      setErrorMsg(err.message);
      setIsEndingSession(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <AppLayout>
        <div style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading your session…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (phase === 'error') {
    return (
      <AppLayout>
        <div style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', maxWidth: 420 }}>
            <div style={{ fontSize: 40, marginBottom: 'var(--space-4)' }}>⚠️</div>
            <h2 style={{ marginBottom: 'var(--space-3)' }}>Session error</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>{errorMsg}</p>
            <button className="btn btn-primary" onClick={() => router.push('/onboarding')}>Start new session</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const cfg = lastResult ? CLASSIFICATION_CONFIG[lastResult.answer.classification] : null;

  return (
    <AppLayout>
      <div style={{
        minHeight: 'calc(100vh - 65px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 760,
        margin: '0 auto',
        width: '100%',
      }}>

        {/* Header bar */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#22c55e',
              boxShadow: '0 0 8px rgba(34,197,94,0.6)',
              animation: 'pulse-ring 1.5s ease infinite',
            }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              Live Interview
            </span>
            <span className="badge badge-blue">{answeredCount} answered</span>
          </div>
          <button
            id="end-interview-btn"
            className="btn btn-ghost"
            disabled={isEndingSession}
            onClick={handleEndInterview}
            style={{ fontSize: 'var(--text-sm)' }}
          >
            {isEndingSession ? 'Ending…' : 'End Interview →'}
          </button>
        </div>

        {/* Question card */}
        {question && (
          <div className="card animate-fade-in animate-delay-1" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-4)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{question.topic}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                {question.subtopic}
              </span>
              <span style={{
                marginLeft: 'auto',
                fontSize: 'var(--text-xs)',
                color: question.difficulty >= 3 ? 'var(--color-accent-red)' : question.difficulty === 2 ? 'var(--color-accent-amber)' : 'var(--color-accent-green)',
                fontWeight: 'var(--font-semibold)',
              }}>
                {DIFFICULTY_LABELS[question.difficulty] ?? 'Medium'}
              </span>
            </div>
            <p style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--font-semibold)',
              lineHeight: 1.5,
              letterSpacing: '-0.01em',
              color: 'var(--color-text-primary)',
            }}>
              {question.prompt}
            </p>
          </div>
        )}

        {/* Result panel (shown after submission, before next question) */}
        {lastResult && cfg && (
          <div className="card animate-fade-in" style={{
            padding: 'var(--space-6)',
            marginBottom: 'var(--space-4)',
            border: `1px solid ${cfg.color}33`,
            background: cfg.bg,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-full)',
                background: cfg.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: '#fff', fontWeight: 'var(--font-bold)',
              }}>{cfg.icon}</div>
              <span style={{ fontWeight: 'var(--font-semibold)', color: cfg.color }}>{cfg.label}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginLeft: 'auto' }}>
                {Math.round(lastResult.answer.confidence * 100)}% confidence
              </span>
            </div>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
              {lastResult.answer.reasoning}
            </p>
            <button
              id="next-question-btn"
              className="btn btn-primary"
              onClick={handleNextQuestion}
            >
              Next Question →
            </button>
          </div>
        )}

        {/* Answer form */}
        {!lastResult && (
          <form
            id="answer-form"
            onSubmit={handleSubmitAnswer}
            className="card animate-fade-in animate-delay-2"
            style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', flex: 1 }}
          >
            <label htmlFor="answer-textarea" className="form-label">Your answer</label>
            <textarea
              id="answer-textarea"
              ref={textareaRef}
              className="form-input"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Type your answer here… explain your thinking clearly."
              rows={6}
              style={{
                resize: 'vertical',
                minHeight: 140,
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.6,
              }}
              required
              disabled={isSubmitting}
            />

            {errorMsg && (
              <div id="interview-error" role="alert" className="form-error" style={{
                padding: 'var(--space-3)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)',
              }}>
                <span>⚠️</span> {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                Tip: Think out loud — explain your reasoning, not just the answer.
              </p>
              <button
                id="submit-answer-btn"
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={!transcript.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span style={{
                      width: 16, height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite',
                      display: 'inline-block',
                    }} />
                    Evaluating…
                  </span>
                ) : 'Submit Answer →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
