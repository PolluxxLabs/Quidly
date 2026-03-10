'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardShell } from '../../../components/dashboard-shell';
import { StatusBadge } from '../../../components/status-badge';
import { apiRequest } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/format';

type PaymentDetails = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
  reference: string | null;
  description: string | null;
  cryptoInvoice: {
    address: string;
    expectedAmount: string;
    status: string;
    expiresAt: string;
    transactions: Array<{
      txHash: string;
      confirmations: number;
      status: string;
    }>;
  } | null;
};

export default function TransactionDetailsPage() {
  const params = useParams<{ id: string }>();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);

  useEffect(() => {
    apiRequest<PaymentDetails>(`/merchant/payments/${params.id}`)
      .then(setPayment)
      .catch(() => setPayment(null));
  }, [params.id]);

  return (
    <DashboardShell
      title="Payment details"
      description="Trace invoice state, transfer confirmations, and on-chain destination data."
    >
      <section className="grid-two">
        <article className="panel">
          <h2>Intent</h2>
          <p>ID: {payment?.id ?? '—'}</p>
          <p>Reference: {payment?.reference ?? '—'}</p>
          <p>Description: {payment?.description ?? '—'}</p>
          <p>
            Amount:{' '}
            {payment
              ? formatCurrency(payment.amount, payment.currency)
              : '—'}
          </p>
          <p>Created: {formatDate(payment?.createdAt)}</p>
          {payment ? <StatusBadge status={payment.status} /> : null}
        </article>

        <article className="panel">
          <h2>Crypto invoice</h2>
          <p>Address: {payment?.cryptoInvoice?.address ?? '—'}</p>
          <p>Expected amount: {payment?.cryptoInvoice?.expectedAmount ?? '—'}</p>
          <p>Expires: {formatDate(payment?.cryptoInvoice?.expiresAt)}</p>
          {payment?.cryptoInvoice ? (
            <StatusBadge status={payment.cryptoInvoice.status} />
          ) : null}
        </article>
      </section>

      <section className="panel">
        <h2>Observed transfers</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tx hash</th>
                <th>Status</th>
                <th>Confirmations</th>
              </tr>
            </thead>
            <tbody>
              {payment?.cryptoInvoice?.transactions.map((transaction) => (
                <tr key={transaction.txHash}>
                  <td>{transaction.txHash}</td>
                  <td>
                    <StatusBadge status={transaction.status} />
                  </td>
                  <td>{transaction.confirmations}</td>
                </tr>
              )) ?? null}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  );
}
