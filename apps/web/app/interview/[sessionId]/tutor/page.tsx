'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AppLayout from '../../../components/AppLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Phase = 'loading' | 'tutor' | 'completed' | 'error';

interface Question {
  id: string;
  topic: string;
  subtopic: string;
  difficulty: number;
  prompt: string;
  rubric_points: string[];
}

interface WeakAnswer {
  id: string;
  transcript: string;
  classification: string;
  reasoning: string;
  question: Question;
}

interface TutorState {
  weakAnswer: WeakAnswer | null;
  attempts: number;
  latestHint: string | null;
}

export default function TutorPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params?.sessionId as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [tutorState, setTutorState] = useState<TutorState | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getToken = useCallback(() => {
    const token = localStorage.getItem('ai_coach_token');
    if (!token) { router.push('/login'); return null; }
    return token;
  }, [router]);

  const fetchTutorState = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/tutor-state`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tutor state');
      const data: TutorState = await res.json();
      
      if (!data.weakAnswer) {
        // No weak answers left, session is completed
        setPhase('completed');
      } else {
        setTutorState(data);
        setPhase('tutor');
        setTranscript('');
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, [sessionId, getToken]);

  useEffect(() => {
    if (!sessionId) return;
    fetchTutorState();
  }, [sessionId, fetchTutorState]);

  async function handleSubmitRetry(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim() || !tutorState?.weakAnswer || isSubmitting) return;

    const token = getToken();
    if (!token) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/tutor-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          questionId: tutorState.weakAnswer.question.id,
          transcript: transcript.trim()
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to submit tutor answer');
      }
      
      const result = await res.json();
      
      // The backend returns the newly generated hint in tutorResult.hint
      const newHint = result.tutorResult?.hint;
      
      // Re-fetch to get updated attempts or next question
      await fetchTutorState();
      
      // Override the hint with the one returned from the POST (since it's not persisted in DB)
      if (newHint) {
        setTutorState(prev => prev ? { ...prev, latestHint: newHint } : null);
      }

    } catch (err: any) {
      setErrorMsg(err.message);
      setIsSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <AppLayout>
        <div style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto var(--space-4)' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading feedback mode…</p>
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
            <h2 style={{ marginBottom: 'var(--space-3)' }}>Tutor error</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>{errorMsg}</p>
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>Go to Dashboard</button>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (phase === 'completed') {
    return (
      <AppLayout>
        <div style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ padding: 'var(--space-10)', textAlign: 'center', maxWidth: 480 }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🎉</div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-3)' }}>
              Interview Completed!
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
              You've successfully completed the interview and the feedback loop. Great job sticking with it!
            </p>
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
              View Final Report →
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { weakAnswer, attempts } = tutorState!;

  // If no weak answer, show completed (safety check)
  if (!weakAnswer) {
    return (
      <AppLayout>
        <div style={{ minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card animate-fade-in" style={{ padding: 'var(--space-10)', textAlign: 'center', maxWidth: 480 }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🎉</div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-3)' }}>
              All Feedback Complete!
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              No more questions to review. Great work!
            </p>
            <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
              View Report →
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

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

        {/* Header */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-full)',
              background: 'rgba(168,85,247,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🧑‍🏫</div>
            <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
              Tutor Feedback
            </span>
          </div>
          <span className="badge" style={{ background: 'var(--color-bg-tertiary)' }}>
            Attempt {attempts + 1} / 3
          </span>
        </div>

        {/* Question & Previous Context */}
        <div className="card animate-fade-in animate-delay-1" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <span className="badge badge-blue">{weakAnswer.question.topic}</span>
            <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              Missed Point
            </span>
          </div>
          
          <p style={{
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--font-semibold)',
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--space-5)',
          }}>
            {weakAnswer.question.prompt}
          </p>

          {/* Original incorrect answer & reasoning */}
          <div style={{
            background: 'var(--color-bg-tertiary)',
            padding: 'var(--space-5)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '4px solid var(--color-border)',
          }}>
            <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 'var(--font-bold)' }}>
              Your initial answer
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontStyle: 'italic', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
              "{weakAnswer.transcript}"
            </p>
            
            <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)', fontWeight: 'var(--font-bold)' }}>
              Tutor notes
            </p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
              {tutorState?.latestHint || weakAnswer.reasoning}
            </p>
          </div>
        </div>

        {/* Retry Form */}
        <form
          id="tutor-form"
          onSubmit={handleSubmitRetry}
          className="card animate-fade-in animate-delay-2"
          style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          <label htmlFor="tutor-textarea" className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Try again</span>
            <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              Explain the missing concept
            </span>
          </label>
          <textarea
            id="tutor-textarea"
            ref={textareaRef}
            className="form-input"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="I realize now that..."
            rows={5}
            style={{
              resize: 'vertical',
              minHeight: 120,
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.6,
            }}
            required
            disabled={isSubmitting}
          />

          {errorMsg && (
            <div className="form-error" style={{
              padding: 'var(--space-3)', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)',
            }}>
              <span>⚠️</span> {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-2)' }}>
            <button
              id="submit-tutor-btn"
              type="submit"
              className="btn btn-primary"
              disabled={!transcript.trim() || isSubmitting}
            >
              {isSubmitting ? 'Evaluating…' : 'Submit Retry →'}
            </button>
          </div>
        </form>

      </div>
    </AppLayout>
  );
}
