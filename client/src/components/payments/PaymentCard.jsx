import { Link } from 'react-router-dom';

import { formatCurrency } from '../../utils/cost.js';
import PaymentStatusBadge from './PaymentStatusBadge.jsx';

export default function PaymentCard({ payment }) {
  const hasRefund = Number(payment.totalRefunded) > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">
            {payment.serviceName || payment.customServiceName}
          </h3>
          {payment.planName && <p className="text-xs text-slate-400">{payment.planName}</p>}
        </div>
        <PaymentStatusBadge status={payment.paymentStatus} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/5 pt-3 text-xs">
        <div>
          <span className="block text-slate-500">Payment Date</span>
          <span className="font-medium text-slate-200">{payment.paymentDate}</span>
        </div>
        <div>
          <span className="block text-slate-500">Amount Paid</span>
          <span className="font-medium text-white">
            {formatCurrency(payment.amount, payment.currencyCode)}
          </span>
        </div>

        {payment.billingPeriodStart && payment.billingPeriodEnd && (
          <div className="col-span-2">
            <span className="block text-slate-500">Billing Period</span>
            <span className="text-slate-300">
              {payment.billingPeriodStart} &rarr; {payment.billingPeriodEnd}
            </span>
          </div>
        )}

        {hasRefund && (
          <>
            <div>
              <span className="block text-slate-500">Refunded</span>
              <span className="font-medium text-rose-400">
                -{formatCurrency(payment.totalRefunded, payment.currencyCode)}
              </span>
            </div>
            <div>
              <span className="block text-slate-500">Net Realized</span>
              <span className="font-semibold text-emerald-400">
                {formatCurrency(payment.netAmount, payment.currencyCode)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 border-t border-white/5 pt-3">
        <Link
          className="block w-full rounded-xl border border-white/10 bg-white/5 py-2 text-center text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
          to={`/payments/${payment.id}`}
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
