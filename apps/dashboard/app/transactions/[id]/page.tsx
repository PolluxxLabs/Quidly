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
      <div className="grid-two">
        <article className="panel">
          <div className="panel-header">
            <h2>Payment intent</h2>
            {payment && <StatusBadge status={payment.status} />}
          </div>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">ID</span>
              <span className="info-value mono">{payment?.id ?? '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Amount</span>
              <span className="info-value">
                {payment ? formatCurrency(payment.amount, payment.currency) : '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Reference</span>
              <span className="info-value">{payment?.reference ?? '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Description</span>
              <span className="info-value">{payment?.description ?? '—'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Created</span>
              <span className="info-value">{formatDate(payment?.createdAt)}</span>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Crypto invoice</h2>
            {payment?.cryptoInvoice && (
              <StatusBadge status={payment.cryptoInvoice.status} />
            )}
          </div>
          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">Address</span>
              <span className="info-value mono">
                {payment?.cryptoInvoice?.address ?? '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Expected</span>
              <span className="info-value">
                {payment?.cryptoInvoice?.expectedAmount ?? '—'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Expires</span>
              <span className="info-value">
                {formatDate(payment?.cryptoInvoice?.expiresAt)}
              </span>
            </div>
          </div>
        </article>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Observed transfers</h2>
        </div>
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
              {payment?.cryptoInvoice?.transactions.length ? (
                payment.cryptoInvoice.transactions.map((tx) => (
                  <tr key={tx.txHash}>
                    <td className="mono">{tx.txHash}</td>
                    <td><StatusBadge status={tx.status} /></td>
                    <td>{tx.confirmations}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>
                    <div className="empty-state">No transfers observed yet</div>
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
