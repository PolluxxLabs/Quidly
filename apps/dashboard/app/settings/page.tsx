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
  const [saved, setSaved] = useState(false);

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
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    await load();
  }

  async function handleRotate() {
    const response = await apiRequest<{ webhookSecret: string }>(
      '/merchant/settings/rotate-webhook-secret',
      { method: 'POST' },
    );
    setRotatedSecret(response.webhookSecret);
    await load();
  }

  return (
    <DashboardShell
      title="Settings"
      description="Manage webhook delivery targets, rotate signing secrets, and set your default merchant environment."
    >
      <div className="grid-two">
        <form className="panel" onSubmit={handleSave}>
          <div className="panel-header">
            <h2>Merchant settings</h2>
          </div>

          <label className="field">
            <span>Webhook URL</span>
            <input
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-site.com/webhooks/quidly"
              value={webhookUrl}
            />
          </label>

          <label className="field">
            <span>Default environment</span>
            <select
              onChange={(e) => setDefaultEnvironment(e.target.value)}
              value={defaultEnvironment}
            >
              <option value="SANDBOX">Sandbox</option>
              <option value="LIVE">Live</option>
            </select>
          </label>

          {saved && <div className="success-msg">Settings saved successfully.</div>}

          <button className="button" type="submit">
            Save settings
          </button>
        </form>

        <section className="panel">
          <div className="panel-header">
            <h2>Webhook signing</h2>
          </div>

          <div className="info-grid" style={{ marginBottom: 20 }}>
            <div className="info-row">
              <span className="info-label">Secret preview</span>
              <span className="info-value mono">
                {settings?.webhookSecretPreview ?? '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">URL updated</span>
              <span className="info-value">
                {formatDate(settings?.webhookUrlUpdatedAt)}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Secret rotated</span>
              <span className="info-value">
                {formatDate(settings?.webhookSecretUpdatedAt)}
              </span>
            </div>
          </div>

          <button className="button-ghost" onClick={handleRotate} type="button">
            Rotate webhook secret
          </button>

          {rotatedSecret && (
            <div style={{ marginTop: 16 }}>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                Copy this now — it will not be shown again.
              </p>
              <div className="code">{rotatedSecret}</div>
              <button
                className="button-ghost"
                onClick={() => navigator.clipboard.writeText(rotatedSecret)}
                style={{ marginTop: 10 }}
                type="button"
              >
                Copy secret
              </button>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
