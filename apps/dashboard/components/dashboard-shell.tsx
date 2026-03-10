'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { clearStoredSession, getStoredSession, StoredSession } from '../lib/auth';

const links = [
  { href: '/overview', label: 'Overview', icon: '◈' },
  { href: '/transactions', label: 'Transactions', icon: '↕' },
  { href: '/api-keys', label: 'API Keys', icon: '⌗' },
  { href: '/webhook-logs', label: 'Webhook Logs', icon: '⚡' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function DashboardShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
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

  if (!session) return null;

  const initials = session.merchant.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">
            <div className="brand-icon">Q</div>
            <strong>Quidly</strong>
          </div>
          <div className="brand-sub">Payments Platform</div>
        </div>

        <nav className="nav">
          <div className="nav-label">Navigation</div>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              data-active={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
              }
            >
              <span className="nav-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{session.merchant.name}</div>
              <div className="sidebar-user-email">{session.merchant.email}</div>
            </div>
          </div>
          <button
            className="signout-btn"
            onClick={() => {
              clearStoredSession();
              router.replace('/login');
            }}
            type="button"
          >
            <span className="nav-icon">↩</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="page-header">
          <div>
            <div className="page-title">{title}</div>
            <div className="page-desc">{description}</div>
          </div>
          {action && <div>{action}</div>}
        </div>
        <div className="page-body">{children}</div>
      </main>
    </div>
  );
}
