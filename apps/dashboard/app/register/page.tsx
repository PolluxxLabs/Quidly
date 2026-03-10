'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { setStoredSession } from '../../lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
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
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });

      setStoredSession(session);
      router.replace('/overview');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to create account',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Create merchant account</h1>
        <p className="muted">
          Start with Base USDC and expand later without changing your core
          integration.
        </p>

        <label className="field">
          <span>Business name</span>
          <input
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? <p className="muted">{error}</p> : null}

        <div className="row">
          <button className="button" disabled={pending} type="submit">
            {pending ? 'Creating…' : 'Register'}
          </button>
          <Link className="button-ghost" href="/login">
            Back to sign-in
          </Link>
        </div>
      </form>
    </div>
  );
}
