'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/format';

type SettingsResponse = {
  webhookUrl: string | null;
  defaultEnvironment: 'SANDBOX' | 'LIVE';
  webhookSecretPreview: string | null;
  webhookUrlUpdatedAt: string | null;
  webhookSecretUpdatedAt: string | null;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [defaultEnvironment, setDefaultEnvironment] = useState('SANDBOX');
  const [rotatedSecret, setRotatedSecret] = useState('');

  async function load() {
    const response = await apiRequest<SettingsResponse>('/merchant/settings');
    setSettings(response);
    setWebhookUrl(response.webhookUrl ?? '');
    setDefaultEnvironment(response.defaultEnvironment);
  }

  useEffect(() => {
    load().catch(() => setSettings(null));
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiRequest('/merchant/settings', {
      method: 'PATCH',
      body: JSON.stringify({ webhookUrl, defaultEnvironment }),
    });
    await load();
  }

  async function handleRotate() {
    const response = await apiRequest<{ webhookSecret: string }>(
      '/merchant/settings/rotate-webhook-secret',
      {
        method: 'POST',
      },
    );
    setRotatedSecret(response.webhookSecret);
    await load();
  }

  return (
    <DashboardShell
      title="Settings"
      description="Manage webhook delivery targets, rotate signing secrets, and set your default merchant environment."
    >
      <section className="grid-two">
        <form className="panel" onSubmit={handleSave}>
          <h2>Merchant settings</h2>
          <label className="field">
            <span>Webhook URL</span>
            <input
              onChange={(event) => setWebhookUrl(event.target.value)}
              value={webhookUrl}
            />
          </label>

          <label className="field">
            <span>Default environment</span>
            <select
              onChange={(event) => setDefaultEnvironment(event.target.value)}
              value={defaultEnvironment}
            >
              <option value="SANDBOX">SANDBOX</option>
              <option value="LIVE">LIVE</option>
            </select>
          </label>

          <button className="button" type="submit">
            Save settings
          </button>
        </form>

        <section className="panel">
          <h2>Webhook signing</h2>
          <p>Current secret preview: {settings?.webhookSecretPreview ?? '—'}</p>
          <p>Webhook URL updated: {formatDate(settings?.webhookUrlUpdatedAt)}</p>
          <p>
            Secret rotated: {formatDate(settings?.webhookSecretUpdatedAt)}
          </p>
          <button className="button" onClick={handleRotate} type="button">
            Rotate webhook secret
          </button>

          {rotatedSecret ? (
            <>
              <p className="muted">Copy the new secret now. It is shown once.</p>
              <div className="code">{rotatedSecret}</div>
            </>
          ) : null}
        </section>
      </section>
    </DashboardShell>
  );
}
