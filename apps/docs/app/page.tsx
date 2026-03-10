import Link from 'next/link';
import { DocsShell } from '../components/docs-shell';

const cards = [
  {
    href: '/quickstart',
    title: 'Ship a payment in minutes',
    body: 'Create a merchant, mint an API key, and open a Base USDC invoice with one flow.',
  },
  {
    href: '/payments',
    title: 'Understand the strict lifecycle',
    body: 'Awaiting payment, confirming, succeeded, and expired are enforced centrally.',
  },
  {
    href: '/webhooks',
    title: 'Drive your backend from events',
    body: 'Every payment status change can fan out to a signed merchant webhook delivery.',
  },
];

export default function HomePage() {
  return (
    <DocsShell
      currentPath="/"
      title="Base USDC payments for merchant backends"
      summary="Quidly is a Kenya-first payments infrastructure platform. The current v1 scope is deliberately small: create and inspect crypto payment intents for exact-amount USDC transfers on Base, then react to signed webhook events."
    >
      <section className="hero-grid">
        <article className="hero-card">
          <span className="eyebrow">Built for v1 focus</span>
          <h2>One rail, one asset, one clear integration path</h2>
          <p>
            Quidly does not attempt to be a general exchange or wallet. It is a
            payment-intent engine with strict invoice state, merchant API keys,
            outbound webhooks, and operator-friendly lifecycle tooling.
          </p>
          <div className="tag-row">
            <span className="tag">USDC only</span>
            <span className="tag">Base only</span>
            <span className="tag">30 min expiry</span>
            <span className="tag">Webhook-first</span>
          </div>
        </article>

        <article className="hero-card">
          <span className="eyebrow">What you can do today</span>
          <h2>Create, inspect, replay, and monitor</h2>
          <p>
            Register merchants with JWT auth, issue server-side API keys, create
            crypto payment intents, inspect invoices in the dashboard, and replay
            outbound webhook deliveries without mutating payment state.
          </p>
        </article>
      </section>

      <section className="cards-grid" style={{ marginTop: 24 }}>
        {cards.map((card) => (
          <Link key={card.href} className="section-card" href={card.href}>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </Link>
        ))}
      </section>

      <section className="section-stack" style={{ marginTop: 24 }}>
        <article className="section-card">
          <h2>Integration shape</h2>
          <ol>
            <li>Register or login a merchant account over JWT auth.</li>
            <li>Create an API key from the merchant surface.</li>
            <li>Call `POST /v1/payments` with `method=CRYPTO`, `asset=USDC`, and `chain=BASE`.</li>
            <li>Wait for `payment.confirming` and `payment.succeeded` webhooks.</li>
            <li>Use the dashboard or merchant endpoints to inspect payments and webhook retries.</li>
          </ol>
        </article>

        <article className="section-card">
          <h2>Read this before going live</h2>
          <p>
            Quidly v1 enforces exact-amount policy, one invoice address per
            payment, and no multi-chain or multi-asset behavior. Overpayments,
            underpayments, swaps, cards, and M-Pesa collection are outside the
            supported surface for this release.
          </p>
          <p className="footer-note">
            Start with the <Link href="/quickstart">Quickstart</Link>, then move
            to <Link href="/payments">Payments</Link> and{' '}
            <Link href="/webhooks">Webhooks</Link>.
          </p>
        </article>
      </section>
    </DocsShell>
  );
}
