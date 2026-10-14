import { Link } from 'react-router-dom';

import { formatCurrency } from '../../utils/cost.js';
import PaymentStatusBadge from './PaymentStatusBadge.jsx';

export default function PaymentTable({ payments = [] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Payment Date</th>
              <th className="px-6 py-4">Billing Period</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-right">Refunded</th>
              <th className="px-6 py-4 text-right">Net Realized</th>
              <th className="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {payments.map((payment) => {
              const hasRefund = Number(payment.totalRefunded) > 0;

              return (
                <tr className="transition hover:bg-white/[0.02]" key={payment.id}>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-white">
                      {payment.serviceName || payment.customServiceName}
                    </div>
                    {payment.planName && (
                      <div className="text-xs text-slate-400">{payment.planName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-200">
                    {payment.paymentDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                    {payment.billingPeriodStart && payment.billingPeriodEnd ? (
                      <span>
                        {payment.billingPeriodStart} &rarr; {payment.billingPeriodEnd}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PaymentStatusBadge status={payment.paymentStatus} />
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-white whitespace-nowrap">
                    {formatCurrency(payment.amount, payment.currencyCode)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    {hasRefund ? (
                      <span className="text-rose-400">
                        -{formatCurrency(payment.totalRefunded, payment.currencyCode)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold whitespace-nowrap">
                    {payment.paymentStatus === 'completed' ? (
                      <span className="text-emerald-400">
                        {formatCurrency(payment.netAmount, payment.currencyCode)}
                      </span>
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <Link
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300"
                      to={`/payments/${payment.id}`}
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
