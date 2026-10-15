import { createHash } from 'node:crypto';

import { fromCents, toCents } from '../utils/money.js';

export const RECOMMENDATION_RULE_VERSION = 'stage10-v1';

const DAY_MS = 86_400_000;

function monthlyCents(subscription) {
  const divisors = { monthly: 1, quarterly: 3, yearly: 12 };
  return Math.round(toCents(subscription.price) / divisors[subscription.billingCycle]);
}

function daysUntil(date, today) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

function fingerprint(candidate) {
  return createHash('sha256')
    .update(JSON.stringify({ evidence: candidate.evidence, savings: candidate.estimatedSavings }))
    .digest('hex');
}

function complete(candidate) {
  return {
    ...candidate,
    ruleVersion: RECOMMENDATION_RULE_VERSION,
    sourceFingerprint: fingerprint(candidate),
  };
}

function portfolioByCurrency(subscriptions) {
  const groups = new Map();
  for (const subscription of subscriptions) {
    if (!groups.has(subscription.currencyCode)) groups.set(subscription.currencyCode, []);
    groups.get(subscription.currencyCode).push({
      ...subscription,
      monthlyCents: monthlyCents(subscription),
    });
  }
  return groups;
}

export function generateRecommendationCandidates({ historical, subscriptions, today }) {
  const eligible = subscriptions.filter(
    (subscription) => !subscription.archivedAt && ['active', 'trial'].includes(subscription.status),
  );
  const candidates = [];
  const portfolios = portfolioByCurrency(eligible);

  const duplicateGroups = new Map();
  for (const subscription of eligible) {
    const identity = subscription.serviceId
      ? `catalog:${subscription.serviceId}`
      : `custom:${subscription.serviceName.trim().toLocaleLowerCase().replace(/\s+/g, ' ')}`;
    const key = `${identity}:${subscription.currencyCode}`;
    if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
    duplicateGroups.get(key).push(subscription);
  }
  for (const [identity, group] of duplicateGroups) {
    if (group.length < 2) continue;
    const normalized = group
      .map((subscription) => ({ ...subscription, monthlyCents: monthlyCents(subscription) }))
      .sort((a, b) => a.monthlyCents - b.monthlyCents || Number(a.id) - Number(b.id));
    const savingsSubscription = normalized[0];
    const catalogMatch = group.every((item) => item.serviceId);
    candidates.push(
      complete({
        confidence: catalogMatch ? 'high' : 'medium',
        currencyCode: savingsSubscription.currencyCode,
        estimatedSavings: fromCents(savingsSubscription.monthlyCents),
        evidence: {
          basis: catalogMatch ? 'same_catalog_service' : 'same_normalized_custom_name',
          limitation: 'This is hypothetical and depends on whether both subscriptions are needed.',
          monthlyAmounts: normalized.map((item) => fromCents(item.monthlyCents)),
          savingsSubscriptionId: savingsSubscription.id,
        },
        explanation: `You have ${group.length} current subscriptions for the same service. Review them before deciding whether one is unnecessary.`,
        key: `exact-duplicate:${identity}`,
        priority: 'high',
        savingsPeriod: 'monthly',
        subscriptions: normalized.map((item, index) => ({
          id: item.id,
          role: index === 0 ? 'subject' : 'comparison',
        })),
        suggestedAction: 'Compare the subscriptions and provider terms before discontinuing one.',
        title: 'Possible duplicate subscriptions',
        type: 'exact_duplicate',
      }),
    );
  }

  for (const [currency, portfolio] of portfolios) {
    const total = portfolio.reduce((sum, item) => sum + item.monthlyCents, 0);
    if (portfolio.length < 2 || total <= 0) continue;
    for (const item of portfolio) {
      const shareBasisPoints = Math.round((item.monthlyCents * 10_000) / total);
      if (shareBasisPoints < 3500 || item.monthlyCents <= 0) continue;
      const evidence = {
        monthlyPortfolioTotal: fromCents(total),
        normalizedMonthlyCost: fromCents(item.monthlyCents),
        portfolioShareBasisPoints: shareBasisPoints,
        savingsSubscriptionId: item.id,
      };
      candidates.push(
        complete({
          confidence: 'high',
          currencyCode: currency,
          estimatedSavings: fromCents(item.monthlyCents),
          evidence,
          explanation: `${item.serviceName} represents ${(shareBasisPoints / 100).toFixed(2)}% of your current ${currency} monthly recurring commitments.`,
          key: `high-cost:${item.id}:${currency}`,
          priority: shareBasisPoints >= 5000 ? 'high' : 'medium',
          savingsPeriod: 'monthly',
          subscriptions: [{ id: item.id, role: 'subject' }],
          suggestedAction: 'Review whether this recurring commitment still matches your needs.',
          title: 'High recurring-cost subscription',
          type: 'high_recurring_cost',
        }),
      );

      if (item.billingCycle === 'monthly') {
        candidates.push(
          complete({
            confidence: 'medium',
            currencyCode: null,
            estimatedSavings: null,
            evidence: {
              annualizedCurrentCommitment: fromCents(item.monthlyCents * 12),
              currencyCode: currency,
              limitation: 'No alternative plan or provider discount is assumed.',
            },
            explanation: `${item.serviceName} is billed monthly and has a significant portfolio share. No cheaper plan is known or assumed.`,
            key: `billing-plan:${item.id}`,
            priority: 'low',
            savingsPeriod: null,
            subscriptions: [{ id: item.id, role: 'subject' }],
            suggestedAction:
              'Review the provider’s current billing options without assuming a discount exists.',
            title: 'Review billing plan options',
            type: 'billing_plan_review',
          }),
        );
      }
    }
  }

  const categoryGroups = new Map();
  for (const subscription of eligible) {
    const key = `${subscription.categoryId}:${subscription.currencyCode}`;
    if (!categoryGroups.has(key)) categoryGroups.set(key, []);
    categoryGroups.get(key).push(subscription);
  }
  for (const [identity, group] of categoryGroups) {
    if (group.length < 3) continue;
    candidates.push(
      complete({
        confidence: 'low',
        currencyCode: null,
        estimatedSavings: null,
        evidence: {
          basis: 'shared_broad_category',
          categoryName: group[0].categoryName,
          limitation: 'A shared category does not prove duplicate functionality.',
        },
        explanation: `${group.length} current subscriptions share the ${group[0].categoryName} category. This is only a prompt for review, not proof of overlap.`,
        key: `category-overlap:${identity}`,
        priority: 'low',
        savingsPeriod: null,
        subscriptions: group.map((item) => ({ id: item.id, role: 'comparison' })),
        suggestedAction: 'Compare the features you actually need across these services.',
        title: 'Review possible category overlap',
        type: 'potential_overlap',
      }),
    );
  }

  for (const item of eligible) {
    if (item.nextRenewalDate) {
      const remaining = daysUntil(item.nextRenewalDate, today);
      if (remaining >= 0 && remaining <= 30 && monthlyCents(item) > 0) {
        candidates.push(
          complete({
            confidence: 'high',
            currencyCode: item.currencyCode,
            estimatedSavings: fromCents(monthlyCents(item)),
            evidence: {
              daysUntilRenewal: remaining,
              renewalDate: item.nextRenewalDate,
              savingsSubscriptionId: item.id,
            },
            explanation: `${item.serviceName} renews in ${remaining} day${remaining === 1 ? '' : 's'}. Review it before the renewal date.`,
            key: `renewal-review:${item.id}:${item.nextRenewalDate}`,
            priority: remaining <= 7 ? 'high' : 'medium',
            savingsPeriod: 'monthly',
            subscriptions: [{ id: item.id, role: 'subject' }],
            suggestedAction:
              'Review the subscription and provider cancellation terms before renewal.',
            title: 'Upcoming renewal review',
            type: 'renewal_review',
          }),
        );
      }
    }
    if (item.status === 'trial' && item.trialEndDate) {
      const remaining = daysUntil(item.trialEndDate, today);
      if (remaining >= 0 && remaining <= 14) {
        candidates.push(
          complete({
            confidence: 'high',
            currencyCode: null,
            estimatedSavings: null,
            evidence: {
              daysUntilTrialEnd: remaining,
              limitation: 'The post-trial charge and conversion behavior are not assumed.',
              trialEndDate: item.trialEndDate,
            },
            explanation: `${item.serviceName}'s recorded trial ends in ${remaining} day${remaining === 1 ? '' : 's'}.`,
            key: `trial-review:${item.id}:${item.trialEndDate}`,
            priority: remaining <= 3 ? 'high' : 'medium',
            savingsPeriod: null,
            subscriptions: [{ id: item.id, role: 'subject' }],
            suggestedAction: 'Review the trial terms before the recorded end date.',
            title: 'Trial ending soon',
            type: 'trial_review',
          }),
        );
      }
    }
  }

  const historicalByCurrency = new Map();
  for (const item of historical) {
    if (!historicalByCurrency.has(item.currencyCode))
      historicalByCurrency.set(item.currencyCode, []);
    historicalByCurrency.get(item.currencyCode).push(item);
  }
  for (const [currency, items] of historicalByCurrency) {
    const totalGross = items.reduce((sum, item) => sum + toCents(item.grossPayments), 0);
    const paymentCount = items.reduce((sum, item) => sum + item.completedPaymentCount, 0);
    if (items.length < 2 || paymentCount < 3 || totalGross <= 0) continue;
    for (const item of items) {
      const gross = toCents(item.grossPayments);
      const shareBasisPoints = Math.round((gross * 10_000) / totalGross);
      if (shareBasisPoints < 4000) continue;
      candidates.push(
        complete({
          confidence: 'high',
          currencyCode: null,
          estimatedSavings: null,
          evidence: {
            completedRefunds: item.completedRefunds,
            currencyCode: currency,
            grossPayments: item.grossPayments,
            netCashFlow: item.netCashFlow,
            periodEnd: today,
            periodStart: item.periodStart,
            spendingShareBasisPoints: shareBasisPoints,
          },
          explanation: `${item.serviceName} accounts for ${(shareBasisPoints / 100).toFixed(2)}% of recorded completed ${currency} payments in the analysis period.`,
          key: `spending-concentration:${item.subscriptionId}:${currency}`,
          priority: shareBasisPoints >= 6000 ? 'high' : 'medium',
          savingsPeriod: null,
          subscriptions: [{ id: item.subscriptionId, role: 'subject' }],
          suggestedAction:
            'Review this historical spending concentration; it is not a projected saving.',
          title: 'Historical spending concentration',
          type: 'spending_concentration',
        }),
      );
    }
  }

  return candidates.slice(0, 100);
}
