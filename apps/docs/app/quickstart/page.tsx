import { CodeBlock } from '../../components/code-block';
import { DocsShell } from '../../components/docs-shell';

const registerSnippet = `curl -X POST http://localhost:3000/auth/register \\
  -H 'content-type: application/json' \\
  -d '{
    "name": "Acme Kenya",
    "email": "ops@acme.co.ke",
    "password": "supersecurepassword"
  }'`;

const apiKeySnippet = `curl -X POST http://localhost:3000/merchant/api-keys \\
  -H 'authorization: Bearer <merchant-jwt>' \\
  -H 'content-type: application/json' \\
  -d '{
    "name": "server-production"
  }'`;

const paymentSnippet = `curl -X POST http://localhost:3000/v1/payments \\
  -H 'authorization: Bearer <qk_live_key>' \\
  -H 'idempotency-key: pay_001' \\
  -H 'content-type: application/json' \\
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

export default function QuickstartPage() {
  return (
    <DocsShell
      currentPath="/quickstart"
      title="Quickstart"
      summary="This is the shortest supported path from zero to a live Base USDC invoice. The examples below assume the API is available at http://localhost:3000."
    >
      <section className="section-stack">
        <article className="section-card">
          <h2>1. Create a merchant account</h2>
          <p>
            Merchant JWT auth is used for operator actions such as creating API
            keys, rotating webhook secrets, reading webhook logs, and accessing
            the dashboard.
          </p>
          <CodeBlock code={registerSnippet} language="bash" title="Register merchant" />
        </article>

        <article className="section-card">
          <h2>2. Create an API key</h2>
          <p>
            Quidly payment creation is not performed with a JWT. Use the JWT once
            to mint a merchant API key, store it on your backend, and then send it
            as a Bearer token to the v1 payment endpoints.
          </p>
          <CodeBlock code={apiKeySnippet} language="bash" title="Create API key" />
        </article>

        <article className="section-card">
          <h2>3. Create a crypto payment intent</h2>
          <p>
            The response contains a `cryptoInvoice` with a deposit address,
            expected amount, chain, asset, and `expiresAt`. The invoice starts in
            `AWAITING_PAYMENT`.
          </p>
          <CodeBlock code={paymentSnippet} language="bash" title="Create payment" />
        </article>

        <article className="section-card">
          <h2>4. React to lifecycle changes</h2>
          <ol>
            <li>`payment.awaiting_payment` is emitted when the invoice is created.</li>
            <li>`payment.confirming` is emitted when Quidly detects the exact Base USDC transfer.</li>
            <li>`payment.succeeded` is emitted after the confirmation threshold is met.</li>
            <li>`payment.expired` is emitted if the invoice times out before success.</li>
          </ol>
        </article>

        <article className="section-card">
          <h2>5. Inspect the result</h2>
          <p>
            Use `GET /v1/payments` and `GET /v1/payments/:id` from your server, or
            sign into the dashboard with the same merchant JWT to inspect payment
            details, API keys, webhook logs, and settings.
          </p>
        </article>
      </section>
    </DocsShell>
  );
}
