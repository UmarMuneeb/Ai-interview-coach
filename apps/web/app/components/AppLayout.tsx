'use client';

import Link from 'next/link';

interface AppLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export default function AppLayout({ children, showNav = true }: AppLayoutProps) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {showNav && (
        <header style={{
          padding: 'var(--space-3) var(--space-8)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-bg-primary-alpha)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          {/* Logo — padding creates 44×44px touch target without affecting visual layout */}
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-2)',
              margin: 'calc(-1 * var(--space-2))',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #3b82f6, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
            }}>🎯</div>
            <span style={{ fontWeight: 'var(--font-semibold)', fontSize: 'var(--text-lg)', letterSpacing: '-0.01em' }}>
              AI Coach
            </span>
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* Use .nav-link class so :hover works — inline styles can't respond to pseudo-classes */}
            <Link href="/dashboard" className="nav-link">
              Dashboard
            </Link>
          </nav>
        </header>
      )}
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
