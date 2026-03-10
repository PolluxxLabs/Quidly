'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
import { StatusBadge } from '../../components/status-badge';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';

type OverviewResponse = {
  totals: {
    payments: number;
    succeeded: number;
    confirming: number;
    awaitingPayment: number;
    expired: number;
    successfulVolume: string;
  };
  recentPayments: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);

  useEffect(() => {
    apiRequest<OverviewResponse>('/merchant/payments/overview')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <DashboardShell
      title="Overview"
      description="Live merchant view of Base USDC payment creation, confirmation, and expiry."
    >
      <section className="stats">
        <article className="stat">
          <span>Total payments</span>
          <strong>{data?.totals.payments ?? 0}</strong>
        </article>
        <article className="stat">
          <span>Succeeded</span>
          <strong>{data?.totals.succeeded ?? 0}</strong>
        </article>
        <article className="stat">
          <span>Confirming</span>
          <strong>{data?.totals.confirming ?? 0}</strong>
        </article>
        <article className="stat">
          <span>Awaiting payment</span>
          <strong>{data?.totals.awaitingPayment ?? 0}</strong>
        </article>
        <article className="stat">
          <span>Expired</span>
          <strong>{data?.totals.expired ?? 0}</strong>
        </article>
        <article className="stat">
          <span>Successful volume</span>
          <strong>{formatCurrency(data?.totals.successfulVolume ?? 0, 'USD')}</strong>
        </article>
      </section>

      <section className="panel">
        <h2>Recent payments</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentPayments.map((payment) => (
                <tr key={payment.id}>
                  <td>{payment.id}</td>
                  <td>{formatCurrency(payment.amount, payment.currency)}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td>{formatDate(payment.createdAt)}</td>
                </tr>
              )) ?? null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
