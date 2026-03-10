import { CodeBlock } from '../../components/code-block';
import { DocsShell } from '../../components/docs-shell';

const createPaymentSnippet = `curl -X POST http://localhost:3000/v1/payments \\
  -H 'authorization: Bearer <qk_live_key>' \\
  -H 'content-type: application/json' \\
  -H 'idempotency-key: order_1001' \\
  -d '{
    "amount": 25,
    "currency": "USD",
    "method": "CRYPTO",
    "asset": "USDC",
    "chain": "BASE",
    "reference": "order_1001",
    "description": "Order 1001",
    "customerEmail": "buyer@example.com"
  }'`;

const listSnippet = `curl http://localhost:3000/v1/payments \\
  -H 'authorization: Bearer <qk_live_key>'`;

const detailSnippet = `curl http://localhost:3000/v1/payments/<payment-id> \\
  -H 'authorization: Bearer <qk_live_key>'`;

export default function PaymentsPage() {
  return (
    <DocsShell
      currentPath="/payments"
      title="Payments"
      summary="The current public API is deliberately narrow. Every supported v1 payment is a Base USDC crypto payment intent with exact-amount settlement rules."
    >
      <section className="section-stack">
        <article className="section-card">
          <h2>Create a payment</h2>
          <p>Required invariants for v1:</p>
          <ul>
            <li>`method` must be `CRYPTO`.</li>
            <li>`asset` must be `USDC`.</li>
            <li>`chain` must be `BASE`.</li>
            <li>`amount` must be an exact amount that will be matched on-chain.</li>
            <li>`currency` is expected to be `USD` for the current crypto flow.</li>
          </ul>
          <CodeBlock
            code={createPaymentSnippet}
            language="bash"
            title="Create Base USDC payment"
          />
        </article>

        <article className="section-card">
          <h2>Payment lifecycle</h2>
          <ol>
            <li>`AWAITING_PAYMENT`: the deposit address exists and the invoice is open.</li>
            <li>`CONFIRMING`: Quidly detected the exact transfer and is tracking confirmations.</li>
            <li>`SUCCEEDED`: the transfer reached the required confirmation count.</li>
            <li>`EXPIRED`: the invoice timed out before valid success.</li>
          </ol>
          <p>
            Illegal state jumps are rejected centrally. A succeeded payment cannot
            become awaiting payment again, and expiry after success is blocked.
          </p>
        </article>

        <article className="section-card">
          <h2>Read payments</h2>
          <p>
            Use the list endpoint for merchant server-side views and the detail
            endpoint when you need the attached `cryptoInvoice` and tracked
            `transactions`.
          </p>
          <CodeBlock code={listSnippet} language="bash" title="List payments" />
          <div style={{ height: 16 }} />
          <CodeBlock code={detailSnippet} language="bash" title="Get one payment" />
        </article>

        <article className="section-card">
          <h2>Dev-only lifecycle simulation</h2>
          <p>
            Quidly exposes JWT-protected dev routes for internal testing:
            `POST /v1/payments/:id/simulate/detected`,
            `POST /v1/payments/:id/simulate/confirmed`, and
            `POST /v1/payments/:id/simulate/expired`.
          </p>
          <div className="callout">
            These simulation routes are for development workflows. Real merchant
            integrations should rely on on-chain monitoring plus webhooks.
          </div>
        </article>
      </section>
    </DocsShell>
  );
}
