import Link from 'next/link';
import { ReactNode } from 'react';

const navigation = [
  { href: '/', label: 'Overview' },
  { href: '/quickstart', label: 'Quickstart' },
  { href: '/auth', label: 'Auth' },
  { href: '/payments', label: 'Payments' },
  { href: '/webhooks', label: 'Webhooks' },
  { href: '/base-usdc-limitations', label: 'Base/USDC Limits' },
];

export function DocsShell({
  currentPath,
  title,
  summary,
  children,
}: {
  currentPath: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <div className="docs-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="eyebrow">Kenya-first payment infrastructure</span>
          <strong>Quidly Docs</strong>
          <span className="muted">
            v1 is intentionally narrow: Base + USDC + webhook-driven merchant
            payments.
          </span>
        </div>

        <nav className="nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-active={currentPath === item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="page-head">
          <span className="eyebrow">Quidly v1</span>
          <h1>{title}</h1>
          <p>{summary}</p>
        </header>
        {children}
      </main>
    </div>
  );
}
