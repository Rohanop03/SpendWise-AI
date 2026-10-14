import { getDaysDifference, isOverdue } from '../utils/billingDates.js';
import { addMoney, divideMoney, fromCents } from '../utils/money.js';

export function calculateSubscriptionMonthlyEquivalent(price, billingCycle) {
  switch (billingCycle) {
    case 'yearly':
      return divideMoney(price, 12);
    case 'quarterly':
      return divideMoney(price, 3);
    case 'monthly':
    default:
      return fromCents(Math.round(Number(price) * 100));
  }
}

export function groupRecurringCostsByCurrency(subscriptions) {
  const currencyTotals = {};

  for (const sub of subscriptions) {
    if (sub.status !== 'active' && sub.status !== 'trial') {
      continue;
    }

    const currency = sub.currencyCode.toUpperCase();
    const monthlyEquivalent = calculateSubscriptionMonthlyEquivalent(sub.price, sub.billingCycle);

    if (!currencyTotals[currency]) {
      currencyTotals[currency] = {
        currencyCode: currency,
        monthlyEquivalent: '0.00',
        subscriptionCount: 0,
      };
    }

    currencyTotals[currency].monthlyEquivalent = addMoney(
      currencyTotals[currency].monthlyEquivalent,
      monthlyEquivalent,
    );
    currencyTotals[currency].subscriptionCount += 1;
  }

  return Object.values(currencyTotals).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
}

export function createBillingService({ billingRepository }) {
  return {
    async getUpcomingRenewals(userId, { days = 30 } = {}) {
      const subscriptions = await billingRepository.getActiveAndTrialSubscriptions({ userId });
      const daysWindow = Number(days) || 30;

      const items = [];

      for (const sub of subscriptions) {
        if (!sub.nextRenewalDate) {
          continue;
        }

        const daysUntil = getDaysDifference(sub.nextRenewalDate);
        if (daysUntil === null) {
          continue;
        }

        const overdue = isOverdue(sub.nextRenewalDate);

        // Include if overdue OR within the upcoming window
        if (overdue || daysUntil <= daysWindow) {
          items.push({
            billingCycle: sub.billingCycle,
            categoryName: sub.categoryName,
            currencyCode: sub.currencyCode,
            customServiceName: sub.customServiceName,
            daysUntilRenewal: daysUntil,
            isOverdue: overdue,
            monthlyEquivalent: calculateSubscriptionMonthlyEquivalent(sub.price, sub.billingCycle),
            nextRenewalDate: sub.nextRenewalDate,
            overdueNotice: overdue ? 'Renewal date passed — payment status unconfirmed' : null,
            planName: sub.planName,
            price: sub.price,
            serviceId: sub.serviceId,
            serviceName: sub.serviceName,
            status: sub.status,
            subscriptionId: sub.id,
            trialEndDate: sub.trialEndDate,
          });
        }
      }

      // Sort by daysUntilRenewal ascending (overdue first, then soonest)
      items.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

      return {
        daysWindow,
        items,
        total: items.length,
      };
    },

    async getBillingOverview(userId, { days = 30 } = {}) {
      const subscriptions = await billingRepository.getActiveAndTrialSubscriptions({ userId });
      const daysWindow = Number(days) || 30;

      const recurringCosts = groupRecurringCostsByCurrency(subscriptions);

      const upcomingItems = [];
      const overdueItems = [];
      let activeCount = 0;
      let trialCount = 0;

      for (const sub of subscriptions) {
        if (sub.status === 'active') activeCount += 1;
        if (sub.status === 'trial') trialCount += 1;

        if (!sub.nextRenewalDate) {
          continue;
        }

        const daysUntil = getDaysDifference(sub.nextRenewalDate);
        if (daysUntil === null) {
          continue;
        }

        const overdue = isOverdue(sub.nextRenewalDate);
        const renewalItem = {
          billingCycle: sub.billingCycle,
          categoryName: sub.categoryName,
          currencyCode: sub.currencyCode,
          customServiceName: sub.customServiceName,
          daysUntilRenewal: daysUntil,
          isOverdue: overdue,
          monthlyEquivalent: calculateSubscriptionMonthlyEquivalent(sub.price, sub.billingCycle),
          nextRenewalDate: sub.nextRenewalDate,
          overdueNotice: overdue ? 'Renewal date passed — payment status unconfirmed' : null,
          planName: sub.planName,
          price: sub.price,
          serviceId: sub.serviceId,
          serviceName: sub.serviceName,
          status: sub.status,
          subscriptionId: sub.id,
          trialEndDate: sub.trialEndDate,
        };

        if (overdue) {
          overdueItems.push(renewalItem);
        } else if (daysUntil <= daysWindow) {
          upcomingItems.push(renewalItem);
        }
      }

      upcomingItems.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
      overdueItems.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);

      return {
        overdueRenewals: overdueItems,
        recurringCosts,
        stats: {
          activeCount,
          daysWindow,
          overdueCount: overdueItems.length,
          totalSubscriptions: subscriptions.length,
          trialCount,
          upcomingCount: upcomingItems.length,
        },
        upcomingRenewals: upcomingItems,
      };
    },
  };
}
