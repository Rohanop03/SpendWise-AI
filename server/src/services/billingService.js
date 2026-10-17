// "Today" is the user's local date (same definition as the reminder worker); the repository
// computes it inside each query from user_preferences.timezone, so it adds no round trip.
export function createBillingService({ billingRepository }) {
  return {
    async getUpcomingRenewals(userId, { days = 30 } = {}) {
      const [items, overdue] = await Promise.all([
        billingRepository.getUpcomingRenewals({ days, userId }),
        billingRepository.getOverdueRenewals({ userId }),
      ]);
      const today =
        items[0]?.today ?? overdue[0]?.today ?? (await billingRepository.getToday(userId));

      return {
        daysWindow: days,
        items: items.map(strip),
        overdue: overdue.map(strip),
        today,
        total: items.length,
      };
    },

    async getBillingOverview(userId, { days = 30 } = {}) {
      const [upcomingRenewals, overdueRenewals, recurringCosts] = await Promise.all([
        billingRepository.getUpcomingRenewals({ days, userId }),
        billingRepository.getOverdueRenewals({ userId }),
        billingRepository.getRecurringCosts({ userId }),
      ]);
      const today =
        upcomingRenewals[0]?.today ??
        overdueRenewals[0]?.today ??
        (await billingRepository.getToday(userId));

      return {
        overdueRenewals: overdueRenewals.map(strip),
        recurringCosts,
        stats: {
          activeCount: recurringCosts.reduce((sum, row) => sum + row.subscriptionCount, 0),
          daysWindow: days,
          overdueCount: overdueRenewals.length,
          upcomingCount: upcomingRenewals.length,
        },
        today,
        upcomingRenewals: upcomingRenewals.map(strip),
      };
    },
  };
}

function strip({ today: _today, ...item }) {
  return item;
}
