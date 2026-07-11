'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
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

interface SkillProfile {
  id: string;
  topic: string;
  subtopic: string;
  mastery_score: number;
  current_difficulty: number;
  correct_count: number;
  incorrect_count: number;
}

interface Report {
  session: any;
  summary: any;
  strengths: string[];
  weaknesses: string[];
  recommendedTopics: string[];
}

const FIELD_LABELS: Record<string, string> = {
  'fullstack': 'Full-Stack',
  'system-design': 'System Design',
  'agentic-ai': 'Agentic AI',
};

const FIELDS = [
  { id: 'fullstack', label: 'Full-Stack', icon: '⚡' },
  { id: 'system-design', label: 'System Design', icon: '🏗️' },
  { id: 'agentic-ai', label: 'Agentic AI', icon: '🤖' },
];

const DURATIONS = [15, 30, 45, 60];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: 'rgba(34, 197, 94, 0.12)', text: 'var(--color-accent-green)', border: 'rgba(34, 197, 94, 0.2)' },
  completed: { bg: 'rgba(59, 130, 246, 0.12)', text: 'var(--color-accent-blue-light)', border: 'rgba(59, 130, 246, 0.2)' },
  paused: { bg: 'rgba(245, 158, 11, 0.12)', text: 'var(--color-accent-amber)', border: 'rgba(245, 158, 11, 0.2)' },
};

export default function DashboardPage() {
  const router = useRouter();
  
  // Dashboard Data
  const [sessions, setSessions] = useState<Session[]>([]);
  const [skills, setSkills] = useState<SkillProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Quick Start Form
  const [field, setField] = useState('');
  const [duration, setDuration] = useState(30);
  const [difficulty, setDifficulty] = useState('medium');
  const [isStarting, setIsStarting] = useState(false);

  // Expanded Session Reports
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [reportsCache, setReportsCache] = useState<Record<string, Report>>({});
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);

  // Review Sidebar
  const [reviewQuestions, setReviewQuestions] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const token = localStorage.getItem('ai_coach_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const [sessionsRes, skillsRes, reviewRes] = await Promise.all([
        fetch(`${API_URL}/sessions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/skill-profile`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/questions/review`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (sessionsRes.status === 401 || skillsRes.status === 401) {
        router.push('/login');
        return;
      }

      if (!sessionsRes.ok) throw new Error('Failed to load sessions');
      if (!skillsRes.ok) throw new Error('Failed to load skill profile');
      // Ignore reviewRes failure gracefully if needed, but assuming it succeeds
      const reviewData = reviewRes.ok ? await reviewRes.json() : [];

      const sessionsData = await sessionsRes.json();
      const skillsData = await skillsRes.json();

      setSessions(sessionsData);
      setSkills(skillsData);
      setReviewQuestions(reviewData);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartSession(e: FormEvent) {
    e.preventDefault();
    if (!field) {
      setError('Please choose a field for the session.');
      return;
    }

    const token = localStorage.getItem('ai_coach_token');
    setIsStarting(true);
    try {
      const questionsMap: Record<number, number> = { 15: 5, 30: 10, 45: 15, 60: 20 };
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

      if (!res.ok) throw new Error('Failed to create session');

      const session = await res.json();
      if (session.weakTopics && session.weakTopics.length > 0) {
        localStorage.setItem(`weak_topics_${session.id}`, JSON.stringify(session.weakTopics));
      }
      router.push(`/interview/${session.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      setIsStarting(false);
    }
  }

  async function toggleSessionReport(sessionId: string) {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }

    setExpandedSession(sessionId);

    if (!reportsCache[sessionId]) {
      setLoadingReportId(sessionId);
      const token = localStorage.getItem('ai_coach_token');
      try {
        const res = await fetch(`${API_URL}/sessions/${sessionId}/report`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const reportData = await res.json();
          setReportsCache(prev => ({ ...prev, [sessionId]: reportData }));
        }
      } catch (err) {
        console.error('Failed to load report', err);
      } finally {
        setLoadingReportId(null);
      }
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  const strengths = skills.filter(s => s.mastery_score >= 7.0);
  const weaknesses = skills.filter(s => s.mastery_score < 7.0);

  return (
    <AppLayout>
      <div style={{
        minHeight: 'calc(100vh - 65px)',
        padding: 'var(--space-6) var(--space-4)',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--font-bold)', letterSpacing: '-0.02em' }}>
              Practice <span className="text-gradient">Dashboard</span>
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-1)' }}>
              Pick up where you left off, or start a fresh session.
            </p>
          </div>
          <button onClick={fetchDashboardData} disabled={isLoading} className="btn btn-ghost">
            {isLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {error && (
          <div className="form-error" style={{ padding: 'var(--space-3)', background: 'rgba(220, 38, 38, 0.1)', border: '1px solid var(--color-destructive)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-8)', alignItems: 'flex-start' }}>
          
          {/* MAIN CONTENT COLUMN */}
          <div style={{ flex: '3 1 600px', minWidth: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 'var(--space-6)',
              marginBottom: 'var(--space-8)'
            }}>
              
              {/* QUICK START WIDGET */}
              <div className="card" style={{ padding: 'var(--space-6)', gridRow: 'span 2' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-4)' }}>Start a Session</h2>
                <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  
                  <div className="form-group">
                    <label className="form-label">Choose your focus area</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-2)' }}>
                      {FIELDS.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setField(f.id)}
                          style={{
                            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                            border: `1px solid ${field === f.id ? 'var(--color-accent-blue)' : 'var(--color-border)'}`,
                            background: field === f.id ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-bg-input)',
                            color: field === f.id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            textAlign: 'left', cursor: 'pointer',
                            transition: 'all 150ms var(--ease-out-strong)',
                            boxShadow: field === f.id ? '0 0 0 1px rgba(37,99,235,0.4)' : 'none',
                          }}
                          onMouseEnter={e => { if (field !== f.id) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(59,130,246,0.5)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(30,64,175,0.07)'; }}}
                          onMouseLeave={e => { if (field !== f.id) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-bg-input)'; }}}
                        >
                          {f.icon} {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Duration</label>
                      <select 
                        value={duration} 
                        onChange={e => setDuration(Number(e.target.value))}
                        className="form-input"
                        style={{ padding: 'var(--space-2)' }}
                      >
                        {DURATIONS.map(d => <option key={d} value={d}>{d} mins</option>)}
                      </select>
                    </div>
                    
                    <div className="form-group" style={{ flex: 1 }}>
                      <label className="form-label">Level</label>
                      <select 
                        value={difficulty} 
                        onChange={e => setDifficulty(e.target.value)}
                        className="form-input"
                        style={{ padding: 'var(--space-2)' }}
                      >
                        {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                      </select>
                    </div>
                  </div>

                  <button type="submit" disabled={!field || isStarting} className="btn btn-primary" style={{ marginTop: 'var(--space-2)' }}>
                    {isStarting ? 'Starting...' : 'Start Session'}
                  </button>
                </form>
              </div>

              {/* SKILL PROFILE WIDGET */}
              <div className="card" style={{ padding: 'var(--space-6)' }}>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-4)' }}>📊 Skill Analytics</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-green)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Strong Areas (≥ 7.0)</h3>
                    {strengths.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No strong areas yet.</p> : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {strengths.map(s => (
                          <div key={s.id} style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34,197,94,0.3)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                            {s.subtopic} <strong style={{ color: 'var(--color-accent-green)' }}>{s.mastery_score.toFixed(1)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Areas for Improvement (&lt; 7.0)</h3>
                    {weaknesses.length === 0 ? <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No weak areas identified yet.</p> : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        {weaknesses.map(s => (
                          <div key={s.id} style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217,119,6,0.3)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-xs)' }}>
                            {s.subtopic} <strong style={{ color: 'var(--color-accent)' }}>{s.mastery_score.toFixed(1)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* HIGH-LEVEL STATS */}
              <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                <div className="card" style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <div style={{ fontSize: 24, lineHeight: 1 }}>🗂️</div>
                  <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-blue-light)', lineHeight: 1 }}>{sessions.length}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Sessions<br/>completed</div>
                </div>
                <div className="card" style={{ flex: 1, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <div style={{ fontSize: 24, lineHeight: 1 }}>🎯</div>
                  <div style={{ fontSize: 'var(--text-4xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-accent-cyan)', lineHeight: 1 }}>{skills.length}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center' }}>Skills<br/>tracked</div>
                </div>
              </div>
            </div>

            {/* SESSION HISTORY */}
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
              Session History
            </h2>

            {/* Skeleton loading state */}
            {isLoading && sessions.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} className="skeleton" style={{ height: 64, opacity: 1 - i * 0.15 }} />
                ))}
              </div>
            )}

            {/* New user empty state */}
            {!isLoading && sessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
                <div style={{ fontSize: 56, marginBottom: 'var(--space-4)', lineHeight: 1 }}>✦</div>
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-2)' }}>Ready for your first session?</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', maxWidth: 340, margin: '0 auto var(--space-6)' }}>
                  Pick a focus area and difficulty level on the left, then hit Start Session. Your first AI interviewer is waiting.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  ← Choose a field and start
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {sessions.map((session) => {
                const { bg, text, border } = (STATUS_COLORS[session.status] || STATUS_COLORS.active)!;
                const isExpanded = expandedSession === session.id;
                const report = reportsCache[session.id];
                
                return (
                  <div key={session.id} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div 
                      onClick={() => toggleSessionReport(session.id)}
                      style={{ 
                        padding: 'var(--space-4)', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                        transition: 'background 150ms ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                        <div style={{ fontWeight: 'var(--font-bold)', fontSize: 'var(--text-lg)', minWidth: '150px' }}>
                          {FIELD_LABELS[session.field] || session.field}
                        </div>
                        <div className="badge" style={{ background: bg, color: text, border: `1px solid ${border}` }}>
                          {session.status}
                        </div>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                          {formatDate(session.started_at)}
                        </div>
                      </div>
                      <div style={{ color: 'var(--color-text-secondary)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
                        ▼
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.2)' }}>
                        {loadingReportId === session.id && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Loading detailed report...</p>}
                        
                        {!loadingReportId && !report && session.status !== 'completed' && (
                          <p style={{ color: 'var(--color-accent-amber)', fontSize: 'var(--text-sm)' }}>This session is still active or paused. Complete the session to view the narrative report.</p>
                        )}

                        {!loadingReportId && report && (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Summary</h4>
                              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                                {typeof report.summary === 'string' ? report.summary : `Total: ${report.summary.total}, Correct: ${report.summary.correct}, Incorrect: ${report.summary.incorrect}`}
                              </p>
                            </div>
                            
                            <div>
                              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent-green)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Strengths Displayed</h4>
                              <ul style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                {report.strengths?.map((s, i) => <li key={i}>{s}</li>) || <li>No specific strengths noted.</li>}
                              </ul>
                            </div>

                            <div>
                              <h4 style={{ fontSize: 'var(--text-sm)', color: 'var(--color-accent)', textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Improvement Areas</h4>
                              <ul style={{ paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                                {report.weaknesses?.map((w, i) => <li key={i}>{w}</li>) || <li>No major weaknesses noted.</li>}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDEBAR - REVIEW QUESTIONS */}
          <aside style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'sticky', top: 'var(--space-6)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
              Needs Review
            </h2>
            {isLoading && reviewQuestions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 100 }} />)}
              </div>
            ) : reviewQuestions.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Looking good — nothing needs review yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {reviewQuestions.map(rq => (
                  <div
                    key={rq.answer_id}
                    className="card"
                    style={{ padding: 'var(--space-4)', cursor: 'pointer', transition: 'transform 150ms var(--ease-out-strong), box-shadow 150ms var(--ease-out-strong)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <span className="badge" style={{ 
                        background: 'rgba(217, 119, 6, 0.1)', 
                        color: 'var(--color-accent)', 
                        border: '1px solid rgba(217,119,6,0.3)',
                        textTransform: 'uppercase',
                        fontSize: '10px'
                      }}>
                        {rq.classification}
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        {new Date(rq.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                      {rq.question.subtopic}
                    </h3>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {rq.question.prompt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
