'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
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
      description="Create server-side merchant credentials and copy them once at issuance."
    >
      <section className="grid-two">
        <form className="panel" onSubmit={handleCreate}>
          <h2>Create key</h2>
          <label className="field">
            <span>Key name</span>
            <input onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <button className="button" type="submit">
            Generate key
          </button>

          {newKey ? (
            <>
              <p className="muted">Copy this now. It is only shown once.</p>
              <div className="code">{newKey}</div>
              <button
                className="button-ghost"
                onClick={() => navigator.clipboard.writeText(newKey)}
                type="button"
              >
                Copy API key
              </button>
            </>
          ) : null}
        </form>

        <section className="panel">
          <h2>Existing keys</h2>
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
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td>{key.keyPrefix}</td>
                    <td>{key.status}</td>
                    <td>{formatDate(key.lastUsedAt)}</td>
                    <td>
                      <button
                        className="button-danger"
                        onClick={() => handleRevoke(key.id)}
                        type="button"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}
