'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DashboardShell } from '../../components/dashboard-shell';
import { StatusBadge } from '../../components/status-badge';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/format';

type PaymentListItem = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  reference: string | null;
};

export default function TransactionsPage() {
  const [payments, setPayments] = useState<PaymentListItem[]>([]);

  useEffect(() => {
    apiRequest<PaymentListItem[]>('/merchant/payments')
      .then(setPayments)
      .catch(() => setPayments([]));
  }, []);

  return (
    <DashboardShell
      title="Transactions"
      description="Inspect payment intents, references, and lifecycle state for each Base USDC invoice."
    >
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <Link href={`/transactions/${payment.id}`}>{payment.id}</Link>
                  </td>
                  <td>{payment.reference ?? '—'}</td>
                  <td>{formatCurrency(payment.amount, payment.currency)}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                  </td>
                  <td>{formatDate(payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
