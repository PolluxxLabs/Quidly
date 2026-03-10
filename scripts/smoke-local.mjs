const apiUrl = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3000';
const dashboardUrl =
  process.env.SMOKE_DASHBOARD_URL ?? 'http://127.0.0.1:3001';
const docsUrl = process.env.SMOKE_DOCS_URL ?? 'http://127.0.0.1:3002';
const suffix = `${Date.now()}`;

async function requestJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const bodyText = await response.text();
  const body = bodyText ? JSON.parse(bodyText) : null;

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${bodyText}`);
  }

  return body;
}

async function requestText(url, init = {}) {
  const response = await fetch(url, init);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }

  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const merchant = await requestJson(`${apiUrl}/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Smoke Merchant',
      email: `smoke.${suffix}@example.com`,
      password: 'supersecurepassword',
    }),
  });

  const accessToken = merchant.accessToken;
  assert(typeof accessToken === 'string', 'Missing access token from register');

  await requestJson(`${apiUrl}/merchant/settings`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      webhookUrl: 'https://merchant.test/webhook',
    }),
  });

  const apiKeyResponse = await requestJson(`${apiUrl}/merchant/api-keys`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'smoke-local',
    }),
  });
  const apiKey = apiKeyResponse.key;
  assert(typeof apiKey === 'string', 'Missing API key');

  const payment = await requestJson(`${apiUrl}/v1/payments`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'idempotency-key': `smoke_${suffix}`,
    },
    body: JSON.stringify({
      amount: 25,
      currency: 'USD',
      method: 'CRYPTO',
      asset: 'USDC',
      chain: 'BASE',
      reference: `smoke_${suffix}`,
      description: 'Local smoke payment',
      customerEmail: 'buyer@example.com',
    }),
  });

  await requestJson(`${apiUrl}/v1/payments/${payment.id}/simulate/detected`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  await requestJson(`${apiUrl}/v1/payments/${payment.id}/simulate/confirmed`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  const paymentDetail = await requestJson(
    `${apiUrl}/merchant/payments/${payment.id}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const webhookDeliveries = await requestJson(
    `${apiUrl}/merchant/webhooks/deliveries`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const dashboardLoginPage = await requestText(`${dashboardUrl}/login`);
  const docsQuickstartPage = await requestText(`${docsUrl}/quickstart`);

  assert(paymentDetail.status === 'SUCCEEDED', 'Payment did not succeed');
  assert(
    paymentDetail.cryptoInvoice?.status === 'SUCCEEDED',
    'Crypto invoice did not succeed',
  );
  assert(
    Array.isArray(webhookDeliveries) &&
      webhookDeliveries.some(
        (delivery) =>
          delivery.paymentIntentId === payment.id &&
          delivery.eventType === 'payment.succeeded',
      ),
    'Succeeded webhook delivery was not created',
  );
  assert(
    dashboardLoginPage.includes('Merchant sign-in'),
    'Dashboard login page did not render expected content',
  );
  assert(
    docsQuickstartPage.includes('Quickstart'),
    'Docs quickstart page did not render expected content',
  );

  console.log(
    JSON.stringify(
      {
        merchantId: merchant.merchant.id,
        paymentId: payment.id,
        paymentStatus: paymentDetail.status,
        webhookEvents: webhookDeliveries
          .filter((delivery) => delivery.paymentIntentId === payment.id)
          .map((delivery) => delivery.eventType),
        dashboardUrl,
        docsUrl,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
