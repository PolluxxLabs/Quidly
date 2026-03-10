import { CodeBlock } from '../../components/code-block';
import { DocsShell } from '../../components/docs-shell';

const loginSnippet = `curl -X POST http://localhost:3000/auth/login \\
  -H 'content-type: application/json' \\
  -d '{
    "email": "ops@acme.co.ke",
    "password": "supersecurepassword"
  }'`;

const settingsSnippet = `curl http://localhost:3000/merchant/settings \\
  -H 'authorization: Bearer <merchant-jwt>'`;

export default function AuthPage() {
  return (
    <DocsShell
      currentPath="/auth"
      title="Authentication"
      summary="Quidly has two auth modes in v1: merchant JWTs for operator actions, and merchant API keys for the public payment API."
    >
      <section className="section-stack">
        <article className="section-card">
          <h2>Merchant JWT auth</h2>
          <p>
            `POST /auth/register` and `POST /auth/login` both return an
            `accessToken` plus a minimal merchant object. Use the JWT for:
          </p>
          <ul>
            <li>creating and revoking API keys</li>
            <li>reading and updating merchant settings</li>
            <li>rotating webhook signing secrets</li>
            <li>listing and replaying webhook deliveries</li>
            <li>dashboard sign-in</li>
          </ul>
          <CodeBlock code={loginSnippet} language="bash" title="Login merchant" />
        </article>

        <article className="section-card">
          <h2>Merchant API keys</h2>
          <p>
            API keys start with `qk_` and are only shown once at creation. Quidly
            expects them in the standard `Authorization: Bearer ...` header for the
            `v1/payments` API.
          </p>
          <div className="callout">
            Do not send merchant JWTs to `POST /v1/payments`. That surface is
            intentionally API-key authenticated.
          </div>
        </article>

        <article className="section-card">
          <h2>Settings and secret management</h2>
          <p>
            Merchant settings are exposed under `/merchant/settings`. Secret values
            are masked on reads and only returned in full at rotation time.
          </p>
          <CodeBlock
            code={settingsSnippet}
            language="bash"
            title="Read merchant settings"
          />
        </article>
      </section>
    </DocsShell>
  );
}
