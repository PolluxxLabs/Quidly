'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
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
      description="Replay merchant webhook deliveries and inspect retry metadata without touching the payment engine."
    >
      <section className="panel">
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
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td>{delivery.eventType}</td>
                  <td>{delivery.status}</td>
                  <td>{delivery.attemptCount}</td>
                  <td>{delivery.responseCode ?? '—'}</td>
                  <td>{formatDate(delivery.createdAt)}</td>
                  <td>
                    <button
                      className="button-ghost"
                      onClick={() => handleReplay(delivery.id)}
                      type="button"
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
