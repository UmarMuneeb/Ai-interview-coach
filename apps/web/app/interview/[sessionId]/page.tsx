'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '../../components/AppLayout';
import { useVoiceInterviewer, QuestionAdvancedPayload, AnswerClassifiedPayload } from '../../../hooks/useVoiceInterviewer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Phase = 'loading' | 'ready' | 'interview' | 'transitioning' | 'error';
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
  const [sessionField, setSessionField] = useState('Full-stack Engineering');
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [transcript, setTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stable callbacks so useVoiceInterviewer hook doesn't re-init on every render
  const handleQuestionAdvanced = useCallback((payload: QuestionAdvancedPayload) => {
    if (payload.interviewComplete) {
      setInterviewComplete(true);
    } else if (payload.nextQuestion) {
      setQuestion(payload.nextQuestion as any);
      setTranscript('');
      setLastResult(null);
    }
  }, []);

  const handleAnswerClassified = useCallback((payload: AnswerClassifiedPayload) => {
    setLastResult(prev => prev
      ? { ...prev, answer: { classification: payload.classification as any, confidence: payload.confidence, reasoning: payload.reasoning } }
      : { answer: { classification: payload.classification as any, confidence: payload.confidence, reasoning: payload.reasoning }, nextQuestion: question! }
    );
    setAnsweredCount(c => c + 1);
  }, [question]);

  const voice = useVoiceInterviewer(
    sessionId,
    question?.prompt,
    handleQuestionAdvanced,
    handleAnswerClassified,
  );

  const getToken = useCallback(() => {
    const token = localStorage.getItem('ai_coach_token');
    if (!token) { router.push('/login'); return null; }
    return token;
  }, [router]);

  const fetchQuestion = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      // Fetch session field for AI context
      const sessionRes = await fetch(`${API_URL}/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.field) setSessionField(sessionData.field);
      }

      // Fetch current question (history-aware, with LLM fallback + adaptive weak-area weighting)
      const topicParam = sessionField ? encodeURIComponent(sessionField.toLowerCase().replace(/\s+/g, '-')) : 'fullstack';
      const storedWeak = localStorage.getItem(`weak_topics_${sessionId}`);
      const weakParam = storedWeak ? `&weakTopics=${encodeURIComponent(storedWeak)}` : '';
      const res = await fetch(`${API_URL}/questions/next?sessionId=${sessionId}&topic=${topicParam}${weakParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch question');
      const q = await res.json();
      setQuestion(q);

      // Pre-fetch 4 more questions for voice AI context (best-effort)
      if (allQuestions.length === 0) {
        const extras: Question[] = [q];
        for (let i = 0; i < 4; i++) {
          try {
            const r = await fetch(`${API_URL}/questions/next?sessionId=${sessionId}&topic=${topicParam}${weakParam}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.ok) {
              const eq = await r.json();
              if (!extras.find(x => x.id === eq.id)) extras.push(eq);
            }
          } catch { /* ignore */ }
        }
        setAllQuestions(extras);
      }

      if (answeredCount === 0) {
        setPhase('ready');
      } else {
        setPhase('interview');
        setTimeout(() => textareaRef.current?.focus(), 100);
      }

      setTranscript('');
      setLastResult(null);
    } catch (err: any) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, [getToken, sessionId, answeredCount, allQuestions.length]);

  // Load session and first question on mount
  useEffect(() => {
    if (!sessionId) return;
    const token = localStorage.getItem('ai_coach_token');
    if (!token) { router.push('/login'); return; }
    fetchQuestion();
  }, [sessionId, router, fetchQuestion]);


  async function handleSubmitAnswer(e?: React.FormEvent, overrideTranscript?: string) {
    if (e) e.preventDefault();
    const finalTranscript = overrideTranscript || transcript;
    if (!finalTranscript.trim() || !question || isSubmitting) return;

    const token = getToken();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, transcript: finalTranscript.trim() }),
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

  // In voice mode, the AI handles the conversation — no auto-submit to grading API

  function handleNextQuestion() {
    voice.setTranscript('');
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
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>Start new session</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (phase === 'ready') {
    return (
      <AppLayout>
        <div className="animate-fade-in" style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', maxWidth: 420 }}>
            <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-xl)', background: 'linear-gradient(135deg, #2563eb, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-5)' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
            <h2 style={{ marginBottom: 'var(--space-3)' }}>Your interviewer is ready.</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-2)', lineHeight: 1.5 }}>
              Alex will ask the questions — you speak your answers naturally.
            </p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
              Grant microphone access when prompted.
            </p>
            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => {
               setPhase('interview');
               voice.startVoiceSession({
                 field: sessionField,
                 role: sessionField,
                 difficulty: question?.difficulty || 1,
                 questions: allQuestions.map(q => ({ id: q.id, prompt: q.prompt, topic: q.topic, subtopic: q.subtopic || '', difficulty: q.difficulty })),
                 firstQuestion: question?.prompt,
               });
            }}>
               Start Voice Interview
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 'var(--space-3)', width: '100%' }} onClick={() => {
               setPhase('interview');
               setTimeout(() => textareaRef.current?.focus(), 100);
            }}>
               Continue in Text Mode
            </button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            {!voice.isVoiceMode ? (
              <button className="btn btn-outline" onClick={() => voice.startVoiceSession({
                field: sessionField,
                role: sessionField,
                difficulty: question?.difficulty || 1,
                questions: allQuestions.map(q => ({ id: q.id, prompt: q.prompt, topic: q.topic, subtopic: q.subtopic || '', difficulty: q.difficulty })),
                firstQuestion: question?.prompt,
              })} style={{ fontSize: 'var(--text-sm)' }}>
                🎙️ Switch to Voice
              </button>
            ) : (
              <span className="badge badge-green">🎙️ Voice Mode Active</span>
            )}
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
        </div>

        {/* Question card — hidden in voice mode (Alex asks it verbally) */}
        {question && !voice.isVoiceMode && (
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
        {!lastResult && !voice.isVoiceMode && (
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

            {(errorMsg || voice.error) && (
              <div id="interview-error" role="alert" className="form-error" style={{
                padding: 'var(--space-3)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)',
              }}>
                <span>⚠️</span> {errorMsg || voice.error}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  Tip: Think out loud — explain your reasoning, not just the answer.
                </p>
                {transcript.trim().length > 0 && transcript.trim().length < 50 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-accent-amber)' }}>
                    Your answer looks short — try to explain your reasoning.
                  </p>
                )}
              </div>
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

        {/* Voice UI */}
        {!lastResult && voice.isVoiceMode && (
          <div className="card animate-fade-in" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)', flex: 1, justifyContent: 'center' }}>

            {/* Difficulty progress indicator */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              {[1, 2, 3].map(d => (
                <div key={d} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: d <= voice.difficulty
                    ? (d === 1 ? 'var(--color-accent-green)' : d === 2 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)')
                    : 'var(--color-border)',
                  transition: 'background 0.3s ease',
                }} />
              ))}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 4 }}>
                {voice.difficultyLabel}
              </span>
            </div>

            {/* AI Speech Bubble */}
            {voice.aiText && (
              <div style={{
                width: '100%',
                padding: 'var(--space-4)',
                background: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-purple, #8b5cf6))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: '#fff', flexShrink: 0, fontWeight: 600
                  }}>A</div>
                  <p style={{
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--text-sm)',
                    lineHeight: 1.6,
                    margin: 0,
                    fontStyle: voice.isPlaying ? 'italic' : 'normal',
                  }}>
                    {voice.aiText}
                  </p>
                </div>
                {voice.isPlaying && (
                  <div style={{
                    position: 'absolute', bottom: 8, right: 12,
                    display: 'flex', gap: 3, alignItems: 'flex-end',
                  }}>
                    {[4, 8, 12, 8, 4].map((h, i) => (
                      <div key={i} style={{
                        width: 3, height: h,
                        background: 'var(--color-accent-blue)',
                        borderRadius: 2,
                        animation: `bounce 0.8s ease-in-out ${i * 0.1}s infinite alternate`,
                      }} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Status indicators */}
            <div style={{ height: 24, display: 'flex', alignItems: 'center' }}>
              {voice.isPlaying && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-accent-blue)', fontSize: 'var(--text-sm)' }}>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 16 }}>
                    {[3, 5, 8, 5, 3].map((h, i) => (
                      <div key={i} style={{ width: 3, height: h, background: 'var(--color-accent-blue)', borderRadius: 2, animation: `bounce 0.8s ease-in-out ${i * 0.1}s infinite alternate` }} />
                    ))}
                  </div>
                  Alex is speaking
                </div>
              )}
              {voice.isProcessing && !voice.isPlaying && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  <span style={{
                    width: 14, height: 14,
                    border: '2px solid var(--color-text-muted)',
                    borderTopColor: 'var(--color-accent-blue)',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    display: 'inline-block',
                  }} /> Thinking...
                </div>
              )}
            </div>

            {/* SVG Mic button */}
            <button
              className={`btn ${voice.isRecording ? 'btn-outline' : 'btn-primary'}`}
              style={{
                width: 120, height: 120, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: voice.isRecording
                  ? `0 0 ${20 + voice.volume * 60}px rgba(239,68,68,${0.4 + voice.volume * 0.6})`
                  : 'none',
                borderColor: voice.isRecording ? 'var(--color-accent-red)' : 'transparent',
                transform: voice.isRecording ? `scale(${1 + voice.volume * 0.35})` : 'scale(1)',
                transition: 'transform 0.05s ease-out, box-shadow 0.05s ease-out',
              }}
              onMouseDown={voice.startRecording}
              onMouseUp={voice.stopRecording}
              onTouchStart={voice.startRecording}
              onTouchEnd={voice.stopRecording}
              disabled={voice.isPlaying || voice.isProcessing}
              aria-label={voice.isRecording ? 'Recording — release to send' : 'Hold to speak your answer'}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </button>

            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              {voice.isRecording
                ? 'Release to send your answer'
                : voice.isPlaying || voice.isProcessing
                ? ''
                : 'Hold to speak your answer'}
            </p>

            {/* Live transcript while recording */}
            {voice.isRecording && voice.transcript && (
              <div style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 'var(--radius-md)',
              }}>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', marginBottom: 4 }}>You:</p>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{voice.transcript}</p>
              </div>
            )}

            {(voice.error) && (
              <div role="alert" className="form-error" style={{
                width: '100%',
                padding: 'var(--space-3)',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)',
              }}>
                ⚠️ {voice.error}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
