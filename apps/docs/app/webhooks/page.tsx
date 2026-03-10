import { CodeBlock } from '../../components/code-block';
import { DocsShell } from '../../components/docs-shell';

const payloadSnippet = `{
  "id": "8b3a8d7c-2d7e-4cb8-b2b1-7d8fd3112e70",
  "type": "payment.succeeded",
  "createdAt": "2026-03-09T12:00:00.000Z",
  "data": {
    "paymentId": "cm8...",
    "merchantId": "cm8...",
    "status": "SUCCEEDED",
    "amount": "25",
    "currency": "USD",
    "method": "CRYPTO",
    "provider": "CRYPTO",
    "reference": "order_1001",
    "cryptoInvoice": {
      "id": "cm8...",
      "status": "SUCCEEDED",
      "address": "0x...",
      "asset": "USDC",
      "chain": "BASE",
      "expectedAmount": "25",
      "expiresAt": "2026-03-09T12:30:00.000Z"
    }
  }
}`;

const verifySnippet = `const payload = JSON.stringify(body);
const signedPayload = \`\${timestamp}.\${payload}\`;
const expected = 'sha256=' + createHmac('sha256', webhookSecret)
  .update(signedPayload)
  .digest('hex');`;

const replaySnippet = `curl -X POST http://localhost:3000/merchant/webhooks/deliveries/<delivery-id>/replay \\
  -H 'authorization: Bearer <merchant-jwt>'`;

export default function WebhooksPage() {
  return (
    <DocsShell
      currentPath="/webhooks"
      title="Webhooks"
      summary="Quidly creates outbound delivery records when payment status changes, signs the payload with an HMAC secret, and processes dispatch through BullMQ-backed jobs."
    >
      <section className="section-stack">
        <article className="section-card">
          <h2>Events</h2>
          <ul>
            <li>`payment.awaiting_payment`</li>
            <li>`payment.confirming`</li>
            <li>`payment.succeeded`</li>
            <li>`payment.failed`</li>
            <li>`payment.expired`</li>
          </ul>
          <p>
            A delivery record is created when the payment status changes. The
            queue worker later dispatches it and updates attempt metadata.
          </p>
        </article>

        <article className="section-card">
          <h2>Signed payload shape</h2>
          <CodeBlock code={payloadSnippet} language="json" title="Webhook body" />
          <div style={{ height: 16 }} />
          <CodeBlock
            code={verifySnippet}
            language="ts"
            title="Verify x-quidly-signature"
          />
        </article>

        <article className="section-card">
          <h2>Headers and retries</h2>
          <p>Each delivery payload is sent with:</p>
          <ul>
            <li>`x-quidly-timestamp`</li>
            <li>`x-quidly-signature`</li>
          </ul>
          <p>
            Delivery records track `attemptCount`, `nextRetryAt`, `responseCode`,
            `responseBody`, and `deliveredAt`. Failed deliveries are retried with
            backoff through the queue layer.
          </p>
        </article>

        <article className="section-card">
          <h2>Replay and inspection</h2>
          <p>
            Merchants can list delivery logs via `GET /merchant/webhooks/deliveries`
            and replay one delivery with a JWT-authenticated POST.
          </p>
          <CodeBlock code={replaySnippet} language="bash" title="Replay one delivery" />
        </article>
      </section>
    </DocsShell>
  );
}
