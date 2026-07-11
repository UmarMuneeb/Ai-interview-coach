'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type AuthMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Auto-focus email when switching modes
  useEffect(() => {
    document.getElementById('email')?.focus();
  }, [mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    // Client-side validation guards
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || (mode === 'register' && password.length < 8)) {
      setError(mode === 'register' ? 'Password must be at least 8 characters.' : 'Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Authentication failed');
      }

      const data = await res.json();
      localStorage.setItem('ai_coach_token', data.access_token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div id="login-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
      position: 'relative',
      overflow: 'hidden',
      padding: 'var(--space-4)',
    }}>
      {/* Background ambient glow — slow float so the page feels alive */}
      <div aria-hidden style={{
        position: 'absolute',
        top: '-20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'float 12s ease-in-out infinite alternate',
      }} />
      <div aria-hidden style={{
        position: 'absolute',
        bottom: '-10%',
        right: '10%',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'float-reverse 10s ease-in-out infinite alternate',
      }} />

      {/* Login Card */}
      <div className="card animate-fade-in" style={{
        width: '100%',
        maxWidth: 440,
        padding: 'var(--space-10)',
        position: 'relative',
      }}>
        {/* Logo & Title */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }} className="animate-fade-in animate-delay-1">
          {/* SVG brand mark — no emoji */}
          <div style={{ margin: '0 auto var(--space-5)', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
              <rect width="56" height="56" rx="14" fill="url(#loginGrad)" />
              <path d="M18 28h6m0 0v-6m0 6v6m0-6h6m6-6v6m0 0h-6m6 0v6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="loginGrad" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2563eb"/>
                  <stop offset="1" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 'var(--font-bold)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: 'var(--space-2)',
          }}>
            {mode === 'login' ? 'Welcome back' : 'Join the ranks'}
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
            {mode === 'login'
              ? 'Your next offer starts here.'
              : 'Free forever. No credit card.'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: 'flex',
          background: 'var(--color-bg-input)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-1)',
          marginBottom: 'var(--space-6)',
          border: '1px solid var(--color-border)',
        }} className="animate-fade-in animate-delay-2">
        {(['login', 'register'] as AuthMode[]).map((m) => (
            <button
              key={m}
              type="button"
              id={`tab-${m}`}
              onClick={() => { setMode(m); setError(''); }}
              className={`tab-btn${mode === m ? ' tab-btn--active' : ''}`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form id="auth-form" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} className="animate-fade-in animate-delay-3">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder={mode === 'register' ? 'Min. 8 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div id="auth-error" role="alert" className="form-error" style={{
              padding: 'var(--space-3)',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            id="auth-submit"
            type="submit"
            disabled={isLoading}
            className="btn btn-primary btn-lg btn-full"
            style={{ marginTop: 'var(--space-2)' }}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.6s linear infinite',
                  display: 'inline-block',
                }} />
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In →' : 'Create Account →'
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-6)',
        }} className="animate-fade-in animate-delay-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent-blue-light)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: 'inherit',
              fontWeight: 'var(--font-medium)',
            }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
