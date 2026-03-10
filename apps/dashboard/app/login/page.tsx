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
        merchant: {
          id: string;
          name: string;
          email: string;
          status: string;
        };
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
        <h1>Merchant sign-in</h1>
        <p className="muted">
          Use your Quidly JWT merchant account to manage Base USDC payment
          flows.
        </p>

        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="muted">{error}</p> : null}

        <div className="row">
          <button className="button" disabled={pending} type="submit">
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
          <Link className="button-ghost" href="/register">
            Create account
          </Link>
        </div>
      </form>
    </div>
  );
}
