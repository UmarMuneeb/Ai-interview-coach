export default function InterviewPage({ params }: { params: { sessionId: string } }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
    }}>
      <div className="card" style={{ padding: 'var(--space-10)', textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🎙️</div>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-3)' }}>
          Session Ready
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Session ID: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent-blue-light)', fontSize: 'var(--text-sm)' }}>{params.sessionId}</code>
        </p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          Live interview screen — coming in the next step.
        </p>
      </div>
    </div>
  );
}
