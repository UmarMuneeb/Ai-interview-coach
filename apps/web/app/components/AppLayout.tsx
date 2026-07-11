'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AppLayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
}

export default function AppLayout({ children, showNav = true }: AppLayoutProps) {
  const router = useRouter();

  function handleLogout() {
    localStorage.removeItem('ai_coach_token');
    router.push('/login');
  }

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
          {/* Brand mark — text logo with gradient accent, no emoji */}
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2)',
              margin: 'calc(-1 * var(--space-2))',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              outline: 'none',
            }}
            className="brand-link"
          >
            {/* SVG circuit/brain mark */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="url(#grad)" />
              <path d="M9 14h3m0 0v-3m0 3v3m0-3h3m3-3v3m0 0h-3m3 0v3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563eb"/>
                  <stop offset="1" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
            <span style={{
              fontWeight: 'var(--font-bold)',
              fontSize: 'var(--text-base)',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg, #e2e8f0, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              InterviewIQ
            </span>
          </Link>

          <nav style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Link href="/dashboard" className="nav-link">
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="btn btn-ghost"
              style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' }}
            >
              Sign out
            </button>
          </nav>
        </header>
      )}
      <main style={{ flex: 1 }}>
        {children}
      </main>
    </div>
  );
}
