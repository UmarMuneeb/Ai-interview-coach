export default function OnboardingPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
    }}>
      <div className="card" style={{ padding: 'var(--space-10)', textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>🚀</div>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-3)' }}>
          You&apos;re in!
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Onboarding flow coming in the next step.
        </p>
      </div>
    </div>
  );
}
