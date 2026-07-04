'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '../components/AppLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Session {
  id: string;
  field: string;
  phase: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  target_duration_minutes: number;
  questions_planned: number;
}

const FIELD_LABELS: Record<string, string> = {
  'fullstack': 'Full-Stack',
  'system-design': 'System Design',
  'agentic-ai': 'Agentic AI',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(34, 197, 94, 0.12)', text: 'var(--color-accent-green)', border: 'rgba(34, 197, 94, 0.2)' },
  completed: { bg: 'rgba(59, 130, 246, 0.12)', text: 'var(--color-accent-blue-light)', border: 'rgba(59, 130, 246, 0.2)' },
  paused: { bg: 'rgba(245, 158, 11, 0.12)', text: 'var(--color-accent-amber)', border: 'rgba(245, 158, 11, 0.2)' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const token = localStorage.getItem('ai_coach_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load sessions');
      }

      const data = await res.json();
      setSessions(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <AppLayout>
      <div
        style={{
          minHeight: 'calc(100vh - 65px)',
          padding: 'var(--space-8) var(--space-4)',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1
            style={{
              fontSize: 'var(--text-4xl)',
              fontWeight: 'var(--font-bold)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              marginBottom: 'var(--space-3)',
            }}
          >
            Your <span className="text-gradient">Dashboard</span>
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)' }}>
            Track your interview practice sessions and progress over time.
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
          <Link href="/onboarding" className="btn btn-primary">
            Start New Session
          </Link>
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            className="btn btn-ghost"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="form-error"
            style={{
              padding: 'var(--space-4)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
            }}
          >
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && sessions.length === 0 && (
          <div
            className="card"
            style={{
              padding: 'var(--space-12)',
              textAlign: 'center',
              color: 'var(--color-text-muted)',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(59,130,246,0.3)',
                borderTopColor: 'var(--color-accent-blue)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto var(--space-4)',
              }}
            />
            Loading your sessions...
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sessions.length === 0 && (
          <div
            className="card"
            style={{
              padding: 'var(--space-12)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📊</div>
            <h2
              style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 'var(--font-semibold)',
                marginBottom: 'var(--space-2)',
              }}
            >
              No sessions yet
            </h2>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-6)',
              }}
            >
              Start your first practice interview to see your progress here.
            </p>
            <Link href="/onboarding" className="btn btn-primary">
              Start Your First Session
            </Link>
          </div>
        )}

        {/* Sessions list */}
        {!isLoading && sessions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {sessions.map((session) => {
              const { bg, text, border } = (STATUS_COLORS[session.status] || STATUS_COLORS.active)!;
              
              return (
                <Link
                  key={session.id}
                  href={`/reports/${session.id}`}
                  className="card"
                  style={{
                    padding: 'var(--space-6)',
                    cursor: 'pointer',
                    transition: 'transform 160ms var(--ease-out-strong), box-shadow 160ms var(--ease-out-strong)',
                    display: 'block',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card), var(--shadow-glow-sm)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-card)';
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 'var(--space-4)',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Left: Session info */}
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                        <h3
                          style={{
                            fontSize: 'var(--text-lg)',
                            fontWeight: 'var(--font-semibold)',
                          }}
                        >
                          {FIELD_LABELS[session.field] || session.field}
                        </h3>
                        <div
                          className="badge"
                          style={{
                            background: bg,
                            color: text,
                            border: `1px solid ${border}`,
                          }}
                        >
                          {session.status}
                        </div>
                        {session.phase && (
                          <div
                            className="badge"
                            style={{
                              background: 'rgba(168,85,247,0.12)',
                              color: 'var(--color-accent-purple)',
                              border: '1px solid rgba(168,85,247,0.2)',
                            }}
                          >
                            {session.phase}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                        Started: {formatDate(session.started_at)}
                        {session.ended_at && ` • Ended: ${formatDate(session.ended_at)}`}
                      </div>
                    </div>

                    {/* Right: Session stats */}
                    <div style={{ display: 'flex', gap: 'var(--space-6)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 'var(--text-2xl)',
                            fontWeight: 'var(--font-bold)',
                            color: 'var(--color-accent-blue)',
                          }}
                        >
                          {session.target_duration_minutes}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          minutes
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 'var(--text-2xl)',
                            fontWeight: 'var(--font-bold)',
                            color: 'var(--color-accent-cyan)',
                          }}
                        >
                          {session.questions_planned}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          questions
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* View report arrow */}
                  {session.status === 'completed' && (
                    <div
                      style={{
                        marginTop: 'var(--space-4)',
                        paddingTop: 'var(--space-4)',
                        borderTop: '1px solid var(--color-border)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--color-accent-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      View full report <span>→</span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
