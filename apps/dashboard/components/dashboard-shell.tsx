'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { clearStoredSession, getStoredSession, StoredSession } from '../lib/auth';

const links = [
  { href: '/overview', label: 'Overview' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/api-keys', label: 'API Keys' },
  { href: '/webhook-logs', label: 'Webhook Logs' },
  { href: '/settings', label: 'Settings' },
];

export function DashboardShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    const nextSession = getStoredSession();

    if (!nextSession?.accessToken) {
      router.replace('/login');
      return;
    }

    setSession(nextSession);
  }, [router]);

  if (!session) {
    return null;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="muted">Kenya-first payments infra</span>
          <strong>Quidly</strong>
          <span>{session.merchant.name}</span>
        </div>

        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className="button-ghost"
          onClick={() => {
            clearStoredSession();
            router.replace('/login');
          }}
          type="button"
        >
          Sign out
        </button>
      </aside>

      <main className="main">
        <section className="hero">
          <div>
            <h1>{title}</h1>
            <p className="muted">{description}</p>
          </div>
          <div className="panel" style={{ minWidth: 220 }}>
            <div className="muted">Signed in as</div>
            <strong>{session.merchant.email}</strong>
          </div>
        </section>
        {children}
      </main>
    </div>
  );
}
