'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '../../components/AppLayout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface SessionReport {
  session: {
    id: string;
    field: string;
    started_at: string;
    ended_at: string | null;
    duration_minutes: number;
    status: string;
  };
  summary: {
    total: number;
    correct: number;
    incorrect: number;
    partial: number;
    misunderstood: number;
    evasive: number;
  };
  strengths: string[];
  weaknesses: string[];
  topicBreakdown: Array<{
    topic: string;
    subtopic: string;
    correct: number;
    total: number;
  }>;
  skillProfiles: Array<{
    topic: string;
    subtopic: string;
    masteryScore: number;
    correctCount: number;
    incorrectCount: number;
    currentDifficulty: number;
  }>;
}

const FIELD_LABELS: Record<string, string> = {
  'fullstack': 'Full-Stack Engineering',
  'system-design': 'System Design',
  'agentic-ai': 'Agentic AI',
};

export default function SessionReportPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [report, setReport] = useState<SessionReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (sessionId) {
      fetchReport();
    }
  }, [sessionId]);

  async function fetchReport() {
    const token = localStorage.getItem('ai_coach_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/sessions/${sessionId}/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to load session report');
      }

      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getPercentage(value: number, total: number) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  function getMasteryLevel(score: number) {
    if (score >= 80) return { label: 'Expert', color: 'var(--color-accent-green)' };
    if (score >= 60) return { label: 'Proficient', color: 'var(--color-accent-blue)' };
    if (score >= 40) return { label: 'Intermediate', color: 'var(--color-accent-amber)' };
    return { label: 'Novice', color: 'var(--color-accent-red)' };
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div
          style={{
            minHeight: 'calc(100vh - 65px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: '3px solid rgba(59,130,246,0.3)',
                borderTopColor: 'var(--color-accent-blue)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto var(--space-4)',
              }}
            />
            <p style={{ color: 'var(--color-text-muted)' }}>Loading report...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !report) {
    return (
      <AppLayout>
        <div
          style={{
            minHeight: 'calc(100vh - 65px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div className="card" style={{ padding: 'var(--space-8)', maxWidth: 500, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>⚠️</div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-2)' }}>
              Report Not Found
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
              {error || 'This session report could not be loaded.'}
            </p>
            <Link href="/dashboard" className="btn btn-primary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const accuracyRate = getPercentage(report.summary.correct, report.summary.total);

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
        {/* Back button */}
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-6)',
            transition: 'color 160ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div className="card" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-6)' }}>
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <span className="badge badge-blue" style={{ marginBottom: 'var(--space-3)' }}>
              Session Report
            </span>
            <h1
              style={{
                fontSize: 'var(--text-4xl)',
                fontWeight: 'var(--font-bold)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginBottom: 'var(--space-2)',
              }}
            >
              {FIELD_LABELS[report.session.field] || report.session.field}
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>
              {formatDate(report.session.started_at)}
              {report.session.ended_at && ` - ${formatDate(report.session.ended_at)}`}
            </p>
          </div>

          {/* Overall accuracy */}
          <div style={{ marginTop: 'var(--space-8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Overall Accuracy</span>
              <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-blue)' }}>
                {accuracyRate}%
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 8,
                background: 'var(--color-bg-input)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${accuracyRate}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--color-accent-blue), var(--color-accent-cyan))',
                  transition: 'width 600ms var(--ease-out-strong)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Summary stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-green)' }}>
              {report.summary.correct}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              Correct
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-amber)' }}>
              {report.summary.partial}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              Partial
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-red)' }}>
              {report.summary.incorrect}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              Incorrect
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-purple)' }}>
              {report.summary.misunderstood}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              Misunderstood
            </div>
          </div>
        </div>

        {/* Two-column layout for strengths/weaknesses and topic breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          {/* Strengths */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>💪</span> Strengths
            </h2>
            {report.strengths.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Keep practicing to identify your strengths
              </p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {report.strengths.map((strength, idx) => (
                  <li
                    key={idx}
                    style={{
                      padding: 'var(--space-3)',
                      background: 'rgba(34, 197, 94, 0.08)',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    ✓ {strength}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Weaknesses */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>🎯</span> Areas to Improve
            </h2>
            {report.weaknesses.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Great job! No major weak areas identified
              </p>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {report.weaknesses.map((weakness, idx) => (
                  <li
                    key={idx}
                    style={{
                      padding: 'var(--space-3)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    → {weakness}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Topic breakdown */}
        <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-5)' }}>
            Topic Breakdown
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {report.topicBreakdown.map((item, idx) => {
              const percentage = getPercentage(item.correct, item.total);
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                      {item.topic} / {item.subtopic}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                      {item.correct} / {item.total} ({percentage}%)
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 6,
                      background: 'var(--color-bg-input)',
                      borderRadius: 'var(--radius-full)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: percentage >= 70 ? 'var(--color-accent-green)' : percentage >= 50 ? 'var(--color-accent-amber)' : 'var(--color-accent-red)',
                        transition: 'width 600ms var(--ease-out-strong)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill profile mastery */}
        {report.skillProfiles.length > 0 && (
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-semibold)', marginBottom: 'var(--space-5)' }}>
              Overall Mastery Levels
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-4)' }}>
              {report.skillProfiles.map((profile, idx) => {
                const mastery = getMasteryLevel(profile.masteryScore);
                return (
                  <div
                    key={idx}
                    style={{
                      padding: 'var(--space-4)',
                      background: 'var(--color-bg-input)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>
                      {profile.topic} / {profile.subtopic}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 'var(--text-xs)', color: mastery.color, fontWeight: 'var(--font-semibold)' }}>
                        {mastery.label}
                      </span>
                      <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-bold)', color: mastery.color }}>
                        {profile.masteryScore}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
                      Difficulty: {profile.currentDifficulty} | {profile.correctCount}✓ / {profile.incorrectCount}✗
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
