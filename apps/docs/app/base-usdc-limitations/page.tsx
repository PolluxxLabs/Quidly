import { DocsShell } from '../../components/docs-shell';

export default function BaseUsdcLimitationsPage() {
  return (
    <DocsShell
      currentPath="/base-usdc-limitations"
      title="Base and USDC limitations"
      summary="Quidly v1 is intentionally strict. Those constraints are part of the product contract, not temporary implementation accidents."
    >
      <section className="section-stack">
        <article className="section-card">
          <h2>Supported network surface</h2>
          <ul>
            <li>Chain: `BASE` only</li>
            <li>Asset: `USDC` only</li>
            <li>One generated deposit address per invoice</li>
            <li>Exact-amount transfer matching</li>
          </ul>
        </article>

        <article className="section-card">
          <h2>Exact match policy</h2>
          <p>
            Quidly v1 expects the on-chain transfer amount to exactly match the
            invoice amount. Overpayment, underpayment, and partial settlement are
            not auto-reconciled. Amount mismatches are treated as provider events
            instead of silently mutating invoice state.
          </p>
        </article>

        <article className="section-card">
          <h2>Expiry rules</h2>
          <p>
            Invoices are scheduled to expire 30 minutes after creation. The expiry
            worker is idempotent and skips payments that are already terminal or
            have already succeeded.
          </p>
        </article>

        <article className="section-card">
          <h2>What is not in scope</h2>
          <ul>
            <li>Multi-chain support</li>
            <li>Assets other than USDC</li>
            <li>Custodial balances or swaps</li>
            <li>Cards, Airtel Money, PesaLink, or live M-Pesa collections</li>
            <li>Automatic partial payment reconciliation</li>
          </ul>
        </article>
      </section>
    </DocsShell>
  );
}
