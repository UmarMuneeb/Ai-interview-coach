'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '../components/AppLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const FIELDS = [
  { id: 'fullstack', label: 'Full-Stack Engineering', icon: '⚡', desc: 'React, Node, APIs, databases' },
  { id: 'system-design', label: 'System Design', icon: '🏗️', desc: 'Scalability, architecture, trade-offs' },
  { id: 'agentic-ai', label: 'Agentic AI', icon: '🤖', desc: 'LLM pipelines, agents, RAG, evals' },
];

const DURATIONS = [
  { value: 15, label: '15 min', desc: 'Quick warmup' },
  { value: 30, label: '30 min', desc: 'Standard session' },
  { value: 45, label: '45 min', desc: 'Deep dive' },
  { value: 60, label: '60 min', desc: 'Full interview' },
];

const DIFFICULTIES = [
  { value: 'easy', label: 'Junior', icon: '🌱', desc: '0-2 years' },
  { value: 'medium', label: 'Mid-Level', icon: '🌿', desc: '2-5 years' },
  { value: 'hard', label: 'Senior', icon: '🌳', desc: '5+ years' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [field, setField] = useState('');
  const [duration, setDuration] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const questionsMap: Record<number, number> = { 15: 5, 30: 10, 45: 15, 60: 20 };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!field) {
      setError('Please choose an interview field to continue.');
      return;
    }

    const token = localStorage.getItem('ai_coach_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          field,
          target_duration_minutes: duration,
          questions_planned: questionsMap[duration] ?? 10,
          difficulty,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to create session');
      }

      const session = await res.json();
      router.push(`/interview/${session.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  const step = field ? (difficulty ? 3 : 2) : 1;

  return (
    <AppLayout>
      <div style={{
        minHeight: 'calc(100vh - 65px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Background glows */}
        <div aria-hidden style={{
          position: 'absolute', top: '-10%', left: '30%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div aria-hidden style={{
          position: 'absolute', bottom: '5%', right: '15%',
          width: 350, height: 350, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div className="animate-fade-in" style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
          <span className="badge badge-blue" style={{ marginBottom: 'var(--space-4)' }}>
            New Session
          </span>
          <h1 style={{
            fontSize: 'var(--text-4xl)',
            fontWeight: 'var(--font-bold)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 'var(--space-3)',
          }}>
            Set up your{' '}
            <span className="text-gradient">interview</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)', maxWidth: 480, margin: '0 auto' }}>
            Configure your practice session. The AI adapts in real-time to your answers.
          </p>
        </div>

        <form id="onboarding-form" onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 680 }}>

          {/* SECTION 1 — Field */}
          <div className="card animate-fade-in animate-delay-1" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-full)',
                background: field ? 'var(--color-accent-blue)' : 'var(--color-bg-input)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 'var(--font-bold)', color: '#fff',
                transition: 'background-color 300ms var(--ease-out-strong)',
              }}>
                {field ? '✓' : '1'}
              </div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
                What role are you preparing for?
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              {FIELDS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  id={`field-${f.id}`}
                  onClick={() => setField(f.id)}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${field === f.id ? 'var(--color-accent-blue)' : 'var(--color-border)'}`,
                    background: field === f.id ? 'rgba(59,130,246,0.08)' : 'var(--color-bg-input)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border-color 160ms var(--ease-out-strong), background-color 160ms var(--ease-out-strong)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 'var(--space-2)' }}>{f.icon}</div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    color: field === f.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-1)',
                  }}>{f.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 2 — Duration */}
          <div className="card animate-fade-in animate-delay-2" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg-input)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 'var(--font-bold)', color: 'var(--color-text-muted)',
              }}>2</div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
                How long do you have?
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
              {DURATIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  id={`duration-${d.value}`}
                  onClick={() => setDuration(d.value)}
                  style={{
                    padding: 'var(--space-4) var(--space-2)',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${duration === d.value ? 'var(--color-accent-blue)' : 'var(--color-border)'}`,
                    background: duration === d.value ? 'rgba(59,130,246,0.08)' : 'var(--color-bg-input)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'border-color 160ms var(--ease-out-strong), background-color 160ms var(--ease-out-strong)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{
                    fontSize: 'var(--text-base)',
                    fontWeight: 'var(--font-bold)',
                    color: duration === d.value ? 'var(--color-accent-blue)' : 'var(--color-text-primary)',
                    marginBottom: 'var(--space-1)',
                  }}>{d.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* SECTION 3 — Difficulty */}
          <div className="card animate-fade-in animate-delay-3" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-full)',
                background: 'var(--color-bg-input)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 'var(--font-bold)', color: 'var(--color-text-muted)',
              }}>3</div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-semibold)' }}>
                Your experience level?
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  id={`difficulty-${d.value}`}
                  onClick={() => setDifficulty(d.value)}
                  style={{
                    padding: 'var(--space-4)',
                    borderRadius: 'var(--radius-lg)',
                    border: `2px solid ${difficulty === d.value ? 'var(--color-accent-purple)' : 'var(--color-border)'}`,
                    background: difficulty === d.value ? 'rgba(168,85,247,0.08)' : 'var(--color-bg-input)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'border-color 160ms var(--ease-out-strong), background-color 160ms var(--ease-out-strong)',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 'var(--space-2)' }}>{d.icon}</div>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--font-semibold)',
                    color: difficulty === d.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-1)',
                  }}>{d.label}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div id="onboarding-error" role="alert" className="form-error" style={{
              padding: 'var(--space-3)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Session summary + Submit */}
          <div className="animate-fade-in animate-delay-4" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            flexWrap: 'wrap',
          }}>
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
              {field && (
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {FIELDS.find(f => f.id === field)?.label}
                  {' · '}{duration} min · {DIFFICULTIES.find(d => d.value === difficulty)?.label}
                </span>
              )}
              {!field && 'Choose a field to continue →'}
            </div>

            <button
              id="start-session-btn"
              type="submit"
              disabled={!field || isLoading}
              className="btn btn-primary btn-lg"
              style={{ minWidth: 180 }}
            >
              {isLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{
                    width: 16, height: 16,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                    display: 'inline-block',
                  }} />
                  Starting…
                </span>
              ) : (
                'Start Interview →'
              )}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
