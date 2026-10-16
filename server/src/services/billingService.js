import { getUserToday } from '../utils/reminderDates.js';

export function createBillingService({ billingRepository, clock = () => new Date() }) {
  // "Today" is the user's local date (same definition as the reminder worker).
  async function todayFor(userId) {
    return getUserToday(await billingRepository.getTimezone(userId), clock());
  }

  return {
    async getUpcomingRenewals(userId, { days = 30 } = {}) {
      const today = await todayFor(userId);
      const [items, overdue] = await Promise.all([
        billingRepository.getUpcomingRenewals({ days, today, userId }),
        billingRepository.getOverdueRenewals({ today, userId }),
      ]);

      return { daysWindow: days, items, overdue, today, total: items.length };
    },

    async getBillingOverview(userId, { days = 30 } = {}) {
      const today = await todayFor(userId);
      const [upcomingRenewals, overdueRenewals, recurringCosts] = await Promise.all([
        billingRepository.getUpcomingRenewals({ days, today, userId }),
        billingRepository.getOverdueRenewals({ today, userId }),
        billingRepository.getRecurringCosts({ userId }),
      ]);

      return {
        overdueRenewals,
        recurringCosts,
        stats: {
          activeCount: recurringCosts.reduce((sum, row) => sum + row.subscriptionCount, 0),
          daysWindow: days,
          overdueCount: overdueRenewals.length,
          upcomingCount: upcomingRenewals.length,
        },
        today,
        upcomingRenewals,
      };
    },
  };
}
