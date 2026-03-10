'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
import { StatusBadge } from '../../components/status-badge';
import { apiRequest } from '../../lib/api';
import { formatDate } from '../../lib/format';

type WebhookDelivery = {
  id: string;
  eventType: string;
  status: string;
  targetUrl: string;
  attemptCount: number;
  responseCode: number | null;
  responseBody: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export default function WebhookLogsPage() {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  async function load() {
    const response = await apiRequest<WebhookDelivery[]>(
      '/merchant/webhooks/deliveries',
    );
    setDeliveries(response);
  }

  useEffect(() => {
    load().catch(() => setDeliveries([]));
  }, []);

  async function handleReplay(id: string) {
    await apiRequest(`/merchant/webhooks/deliveries/${id}/replay`, {
      method: 'POST',
    });
    await load();
  }

  return (
    <DashboardShell
      title="Webhook logs"
      description="Inspect webhook delivery history and replay failed events."
    >
      <section className="panel">
        <div className="panel-header">
          <h2>Delivery history</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Response</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliveries.length ? (
                deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td className="mono">{delivery.eventType}</td>
                    <td><StatusBadge status={delivery.status} /></td>
                    <td>{delivery.attemptCount}</td>
                    <td>
                      {delivery.responseCode ? (
                        <span className={delivery.responseCode < 300 ? 'status succeeded' : 'status failed'}>
                          {delivery.responseCode}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{formatDate(delivery.createdAt)}</td>
                    <td>
                      <button
                        className="button-ghost"
                        onClick={() => handleReplay(delivery.id)}
                        style={{ padding: '5px 12px', fontSize: 12 }}
                        type="button"
                      >
                        Replay
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">No webhook deliveries yet</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
