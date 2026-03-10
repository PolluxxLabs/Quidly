'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { setStoredSession } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const session = await apiRequest<{
        accessToken: string;
        merchant: { id: string; name: string; email: string; status: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setStoredSession(session);
      router.replace('/overview');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to sign in',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <div className="auth-brand-icon">Q</div>
          <span className="auth-brand-name">Quidly</span>
        </div>

        <h1>Welcome back</h1>
        <p>Sign in to your merchant account to manage your payments.</p>

        <label className="field">
          <span>Email address</span>
          <input
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />
        </label>

        {error && <div className="error-msg">{error}</div>}

        <button className="button" disabled={pending} type="submit" style={{ width: '100%', marginTop: 4 }}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-divider">
          No account?{' '}
          <Link href="/register">Create one free</Link>
        </p>
      </form>
    </div>
  );
}
