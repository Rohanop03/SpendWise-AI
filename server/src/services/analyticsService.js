import { fromCents, subtractMoney, toCents } from '../utils/money.js';

function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);
  // Protect against spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Analytics are month-granular because they read the monthly_spend_by_category view.
 * Any startDate/endDate is widened to whole calendar months: the repository receives the
 * first day of the first and last month, and responses report the effective range.
 */
export function toMonthRange({ endDate, startDate } = {}) {
  const monthStart = (date) => (date ? `${date.slice(0, 7)}-01` : null);
  const monthEnd = (date) => {
    if (!date) return null;
    const [year, month] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  };
  return {
    period: { endDate: monthEnd(endDate), granularity: 'month', startDate: monthStart(startDate) },
    query: { endDate: monthStart(endDate), startDate: monthStart(startDate) },
  };
}

export function createAnalyticsService(analyticsRepository) {
  return {
    async getFinancialOverview({ currencyCode, endDate, startDate, userId }) {
      const range = toMonthRange({ endDate, startDate });
      const raw = await analyticsRepository.getFinancialOverview({
        currencyCode,
        ...range.query,
        userId,
      });

      // Index payments by currency
      const paymentsByCurrency = new Map();
      for (const row of raw.payments) {
        paymentsByCurrency.set(row.currency_code, row);
      }

      // Index refunds by currency
      const refundsByCurrency = new Map();
      for (const row of raw.refunds) {
        refundsByCurrency.set(row.currency_code, row);
      }

      // Index recurring estimates by currency
      const recurringByCurrency = new Map();
      for (const row of raw.recurring) {
        recurringByCurrency.set(row.currency_code, row);
      }

      // All active currencies present in user's data
      const allCurrencies = new Set([
        ...paymentsByCurrency.keys(),
        ...refundsByCurrency.keys(),
        ...recurringByCurrency.keys(),
      ]);

      const currencySummaries = [];
      const sortedCurrencies = Array.from(allCurrencies).sort();

      for (const code of sortedCurrencies) {
        const p = paymentsByCurrency.get(code) || {};
        const r = refundsByCurrency.get(code) || {};
        const rec = recurringByCurrency.get(code) || {};

        const grossStr = fromCents(toCents(p.gross_payments || 0));
        const refundsStr = fromCents(toCents(r.completed_refunds || 0));
        const netCashFlowStr = subtractMoney(grossStr, refundsStr);

        currencySummaries.push({
          activeSubscriptionCount: Number(rec.active_subscription_count || 0),
          completedPaymentCount: Number(p.completed_payment_count || 0),
          completedRefunds: refundsStr,
          currencyCode: code,
          estimatedMonthlyRecurring: fromCents(toCents(rec.estimated_monthly_recurring || 0)),
          estimatedYearlyRecurring: fromCents(toCents(rec.estimated_yearly_recurring || 0)),
          failedAmount: fromCents(toCents(p.failed_amount || 0)),
          failedPaymentCount: Number(p.failed_payment_count || 0),
          grossPayments: grossStr,
          netCashFlow: netCashFlowStr,
          pendingAmount: fromCents(toCents(p.pending_amount || 0)),
          pendingPaymentCount: Number(p.pending_payment_count || 0),
          refundCount: Number(r.refund_count || 0),
        });
      }

      return {
        currencySummaries,
        period: range.period,
      };
    },

    async getSpendingTrends({ currencyCode, endDate, interval = 'monthly', startDate, userId }) {
      const range = toMonthRange({ endDate, startDate });
      const rows = await analyticsRepository.getSpendingTrends({
        currencyCode,
        ...range.query,
        interval,
        userId,
      });

      const trends = rows.map((row) => {
        const grossStr = fromCents(toCents(row.gross_payments));
        const refundsStr = fromCents(toCents(row.completed_refunds));
        const netCashFlowStr = subtractMoney(grossStr, refundsStr);

        return {
          completedPaymentCount: Number(row.completed_payment_count || 0),
          completedRefunds: refundsStr,
          currencyCode: row.currency_code,
          grossPayments: grossStr,
          netCashFlow: netCashFlowStr,
          period: row.period,
          refundCount: Number(row.refund_count || 0),
        };
      });

      return {
        period: { ...range.period, interval },
        trends,
      };
    },

    async getCategoryAnalytics({
      categoryId,
      currencyCode,
      endDate,
      minAmount,
      startDate,
      userId,
    }) {
      const range = toMonthRange({ endDate, startDate });
      const rows = await analyticsRepository.getCategoryAnalytics({
        categoryId,
        currencyCode,
        ...range.query,
        minAmount,
        userId,
      });

      // Calculate total gross spending per currency for percentage computation
      const totalGrossByCurrency = new Map();
      for (const row of rows) {
        const currentCents = totalGrossByCurrency.get(row.currency_code) || 0;
        totalGrossByCurrency.set(row.currency_code, currentCents + toCents(row.gross_payments));
      }

      const categories = rows.map((row) => {
        const grossStr = fromCents(toCents(row.gross_payments));
        const refundsStr = fromCents(toCents(row.completed_refunds));
        const netCashFlowStr = subtractMoney(grossStr, refundsStr);

        const totalCents = totalGrossByCurrency.get(row.currency_code) || 0;
        let percentageOfGross = 0;
        if (totalCents > 0) {
          const catCents = toCents(row.gross_payments);
          percentageOfGross = Math.round((catCents / totalCents) * 10000) / 100;
        }

        return {
          categoryId: String(row.category_id),
          categoryName: row.category_name,
          completedPaymentCount: Number(row.completed_payment_count || 0),
          completedRefunds: refundsStr,
          currencyCode: row.currency_code,
          grossPayments: grossStr,
          netCashFlow: netCashFlowStr,
          percentageOfGross,
          refundCount: Number(row.refund_count || 0),
        };
      });

      return {
        categories,
        period: range.period,
      };
    },

    async getSubscriptionAnalytics({
      currencyCode,
      endDate,
      limit = 20,
      offset = 0,
      sortBy = 'grossPayments',
      sortOrder = 'desc',
      startDate,
      subscriptionId,
      userId,
    }) {
      const range = toMonthRange({ endDate, startDate });
      const { rows, totalCount } = await analyticsRepository.getSubscriptionAnalytics({
        currencyCode,
        ...range.query,
        limit,
        offset,
        sortBy,
        sortOrder,
        subscriptionId,
        userId,
      });

      const subscriptions = rows.map((row) => {
        const grossStr = fromCents(toCents(row.gross_payments));
        const refundsStr = fromCents(toCents(row.completed_refunds));
        const netCashFlowStr = subtractMoney(grossStr, refundsStr);

        return {
          archivedAt: row.archived_at || null,
          billingCycle: row.billing_cycle,
          categoryId: String(row.category_id),
          categoryName: row.category_name,
          completedPaymentCount: Number(row.completed_payment_count || 0),
          completedRefunds: refundsStr,
          currencyCode: row.currency_code,
          currentCost: fromCents(toCents(row.current_cost)),
          estimatedMonthlyCost: fromCents(toCents(row.estimated_monthly_cost || 0)),
          grossPayments: grossStr,
          netCashFlow: netCashFlowStr,
          refundCount: Number(row.refund_count || 0),
          serviceName: row.service_name,
          status: row.status,
          subscriptionId: String(row.subscription_id),
        };
      });

      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        subscriptions,
      };
    },

    async getTopSubscriptions({
      currencyCode,
      endDate,
      limit = 5,
      startDate,
      type = 'recurring',
      userId,
    }) {
      const range = toMonthRange({ endDate, startDate });
      const rows = await analyticsRepository.getTopSubscriptions({
        currencyCode,
        ...range.query,
        limit,
        type,
        userId,
      });

      const subscriptions = rows.map((row) => {
        if (type === 'recurring') {
          return {
            billingCycle: row.billing_cycle,
            categoryName: row.category_name,
            currencyCode: row.currency_code,
            currentCost: fromCents(toCents(row.current_cost)),
            normalizedMonthlyCost: fromCents(toCents(row.normalized_monthly_cost)),
            serviceName: row.service_name,
            status: row.status,
            subscriptionId: String(row.subscription_id),
          };
        }

        return {
          billingCycle: row.billing_cycle,
          categoryName: row.category_name,
          completedPaymentCount: Number(row.completed_payment_count || 0),
          currencyCode: row.currency_code,
          currentCost: fromCents(toCents(row.current_cost)),
          grossPayments: fromCents(toCents(row.gross_payments)),
          serviceName: row.service_name,
          status: row.status,
          subscriptionId: String(row.subscription_id),
        };
      });

      return {
        limit,
        subscriptions,
        type,
      };
    },

    async getBillingCycleAnalytics({ currencyCode, userId }) {
      const rows = await analyticsRepository.getBillingCycleAnalytics({
        currencyCode,
        userId,
      });

      const billingCycles = rows.map((row) => ({
        billingCycle: row.billing_cycle,
        currencyCode: row.currency_code,
        estimatedMonthlyTotal: fromCents(toCents(row.estimated_monthly_total)),
        estimatedYearlyTotal: fromCents(toCents(row.estimated_yearly_total)),
        subscriptionCount: Number(row.subscription_count || 0),
      }));

      return { billingCycles };
    },

    async getPaymentStatusAnalytics({ currencyCode, endDate, startDate, userId }) {
      const range = toMonthRange({ endDate, startDate });
      const rows = await analyticsRepository.getPaymentStatusAnalytics({
        currencyCode,
        ...range.query,
        userId,
      });

      // Group by currency
      const byCurrency = new Map();
      for (const row of rows) {
        if (!byCurrency.has(row.currency_code)) {
          byCurrency.set(row.currency_code, {
            cancelled: { amount: '0.00', count: 0, label: 'Cancelled' },
            completed: { amount: '0.00', count: 0, label: 'Realized' },
            currencyCode: row.currency_code,
            failed: { amount: '0.00', count: 0, label: 'Unsuccessful' },
            pending: { amount: '0.00', count: 0, label: 'Unconfirmed' },
          });
        }
        const entry = byCurrency.get(row.currency_code);
        const statusKey = row.payment_status;
        if (entry[statusKey]) {
          entry[statusKey].count = Number(row.payment_count || 0);
          entry[statusKey].amount = fromCents(toCents(row.total_amount || 0));
        }
      }

      return {
        period: range.period,
        statuses: Array.from(byCurrency.values()),
      };
    },

    async getRefundAnalytics({ currencyCode, endDate, limit = 20, startDate, userId }) {
      const range = toMonthRange({ endDate, startDate });
      const { recentRefunds, summaries } = await analyticsRepository.getRefundAnalytics({
        currencyCode,
        ...range.query,
        limit,
        userId,
      });

      const formattedSummaries = summaries.map((row) => ({
        currencyCode: row.currency_code,
        fullyRefundedCount: Number(row.fully_refunded_count || 0),
        partiallyRefundedCount: Number(row.partially_refunded_count || 0),
        refundedPaymentCount: Number(row.refunded_payment_count || 0),
        totalRefundAmount: fromCents(toCents(row.total_refund_amount)),
      }));

      const formattedRecent = recentRefunds.map((row) => ({
        categoryName: row.category_name,
        currencyCode: row.currency_code,
        originalPaymentAmount: fromCents(toCents(row.payment_amount)),
        paymentDate: row.payment_date,
        paymentId: String(row.payment_id),
        reason: row.reason || null,
        refundAmount: fromCents(toCents(row.refund_amount)),
        refundDate: row.refund_date,
        refundId: String(row.refund_id),
        refundStatus: row.refund_status,
        serviceName: row.service_name,
      }));

      return {
        period: range.period,
        recentRefunds: formattedRecent,
        summaries: formattedSummaries,
      };
    },

    async getCustomReport({
      categoryId,
      currencyCode,
      endDate,
      startDate,
      subscriptionId,
      userId,
    }) {
      const range = toMonthRange({ endDate, startDate });
      const [overview, categories, subscriptions, trends, paymentStatuses, refunds] =
        await Promise.all([
          this.getFinancialOverview({ currencyCode, endDate, startDate, userId }),
          this.getCategoryAnalytics({ categoryId, currencyCode, endDate, startDate, userId }),
          this.getSubscriptionAnalytics({
            currencyCode,
            endDate,
            limit: 100,
            offset: 0,
            sortBy: 'grossPayments',
            sortOrder: 'desc',
            startDate,
            subscriptionId,
            userId,
          }),
          this.getSpendingTrends({
            currencyCode,
            endDate,
            interval: 'monthly',
            startDate,
            userId,
          }),
          this.getPaymentStatusAnalytics({ currencyCode, endDate, startDate, userId }),
          this.getRefundAnalytics({ currencyCode, endDate, limit: 10, startDate, userId }),
        ]);

      return {
        categoryBreakdown: categories.categories,
        monthlyTrends: trends.trends,
        overview: overview.currencySummaries,
        paymentStatuses: paymentStatuses.statuses,
        period: range.period,
        refunds: refunds.summaries,
        subscriptionBreakdown: subscriptions.subscriptions,
      };
    },

    async exportCustomReportCsv({
      categoryId,
      currencyCode,
      endDate,
      startDate,
      subscriptionId,
      userId,
    }) {
      const report = await this.getCustomReport({
        categoryId,
        currencyCode,
        endDate,
        startDate,
        subscriptionId,
        userId,
      });

      const lines = [];

      // Metadata Header
      lines.push('SpendWise AI Financial Report');
      lines.push(
        `Generated At,${escapeCsvCell(new Date().toISOString())},Start Date,${escapeCsvCell(
          report.period.startDate || 'All Time',
        )},End Date,${escapeCsvCell(report.period.endDate || 'All Time')}`,
      );
      lines.push('');

      // Section 1: Financial Overview by Currency
      lines.push('--- FINANCIAL OVERVIEW BY CURRENCY ---');
      lines.push(
        'Currency,Gross Payments,Completed Refunds,Net Cash Flow,Completed Count,Refund Count,Pending Count,Pending Amount,Failed Count,Failed Amount,Estimated Monthly Recurring,Estimated Yearly Recurring',
      );
      for (const row of report.overview) {
        lines.push(
          [
            escapeCsvCell(row.currencyCode),
            escapeCsvCell(row.grossPayments),
            escapeCsvCell(row.completedRefunds),
            escapeCsvCell(row.netCashFlow),
            escapeCsvCell(row.completedPaymentCount),
            escapeCsvCell(row.refundCount),
            escapeCsvCell(row.pendingPaymentCount),
            escapeCsvCell(row.pendingAmount),
            escapeCsvCell(row.failedPaymentCount),
            escapeCsvCell(row.failedAmount),
            escapeCsvCell(row.estimatedMonthlyRecurring),
            escapeCsvCell(row.estimatedYearlyRecurring),
          ].join(','),
        );
      }
      lines.push('');

      // Section 2: Category Breakdown
      lines.push('--- CATEGORY BREAKDOWN ---');
      lines.push(
        'Category,Currency,Gross Payments,Completed Refunds,Net Cash Flow,Payment Count,% of Gross Spending',
      );
      for (const cat of report.categoryBreakdown) {
        lines.push(
          [
            escapeCsvCell(cat.categoryName),
            escapeCsvCell(cat.currencyCode),
            escapeCsvCell(cat.grossPayments),
            escapeCsvCell(cat.completedRefunds),
            escapeCsvCell(cat.netCashFlow),
            escapeCsvCell(cat.completedPaymentCount),
            escapeCsvCell(`${cat.percentageOfGross}%`),
          ].join(','),
        );
      }
      lines.push('');

      // Section 3: Monthly Trends
      lines.push('--- MONTHLY CASH FLOW TRENDS ---');
      lines.push('Period,Currency,Gross Payments,Completed Refunds,Net Cash Flow,Payment Count');
      for (const t of report.monthlyTrends) {
        lines.push(
          [
            escapeCsvCell(t.period),
            escapeCsvCell(t.currencyCode),
            escapeCsvCell(t.grossPayments),
            escapeCsvCell(t.completedRefunds),
            escapeCsvCell(t.netCashFlow),
            escapeCsvCell(t.completedPaymentCount),
          ].join(','),
        );
      }
      lines.push('');

      // Section 4: Subscription Breakdown
      lines.push('--- SUBSCRIPTION BREAKDOWN ---');
      lines.push(
        'Service,Category,Status,Cycle,Currency,Current Cost,Gross Payments,Completed Refunds,Net Cash Flow,Payment Count,Est Monthly Cost',
      );
      for (const sub of report.subscriptionBreakdown) {
        lines.push(
          [
            escapeCsvCell(sub.serviceName),
            escapeCsvCell(sub.categoryName),
            escapeCsvCell(sub.status),
            escapeCsvCell(sub.billingCycle),
            escapeCsvCell(sub.currencyCode),
            escapeCsvCell(sub.currentCost),
            escapeCsvCell(sub.grossPayments),
            escapeCsvCell(sub.completedRefunds),
            escapeCsvCell(sub.netCashFlow),
            escapeCsvCell(sub.completedPaymentCount),
            escapeCsvCell(sub.estimatedMonthlyCost),
          ].join(','),
        );
      }

      return lines.join('\r\n');
    },
  };
}
