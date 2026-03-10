'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
import { StatusBadge } from '../../components/status-badge';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/format';

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');

  async function load() {
    const response = await apiRequest<ApiKey[]>('/merchant/api-keys');
    setKeys(response);
  }

  useEffect(() => {
    load().catch(() => setKeys([]));
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await apiRequest<{ key: string }>('/merchant/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    setName('');
    setNewKey(response.key);
    await load();
  }

  async function handleRevoke(id: string) {
    await apiRequest(`/merchant/api-keys/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <DashboardShell
      title="API keys"
      description="Create server-side merchant credentials. Copy the key immediately — it is only shown once."
    >
      <div className="grid-two">
        <form className="panel" onSubmit={handleCreate}>
          <div className="panel-header">
            <h2>Create new key</h2>
          </div>

          <label className="field">
            <span>Key name</span>
            <input
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production server"
              required
              value={name}
            />
          </label>

          <button className="button" type="submit">
            Generate key
          </button>

          {newKey && (
            <div style={{ marginTop: 16 }}>
              <div className="success-msg" style={{ marginBottom: 10 }}>
                Key created — copy it now. It will not be shown again.
              </div>
              <div className="code">{newKey}</div>
              <button
                className="button-ghost"
                onClick={() => navigator.clipboard.writeText(newKey)}
                style={{ marginTop: 10 }}
                type="button"
              >
                Copy key
              </button>
            </div>
          )}
        </form>

        <section className="panel">
          <div className="panel-header">
            <h2>Existing keys</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Status</th>
                  <th>Last used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.length ? (
                  keys.map((key) => (
                    <tr key={key.id}>
                      <td>{key.name}</td>
                      <td className="mono">{key.keyPrefix}</td>
                      <td><StatusBadge status={key.status} /></td>
                      <td>{formatDate(key.lastUsedAt)}</td>
                      <td>
                        {key.status !== 'REVOKED' && (
                          <button
                            className="button-danger"
                            onClick={() => handleRevoke(key.id)}
                            type="button"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">No API keys yet</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
