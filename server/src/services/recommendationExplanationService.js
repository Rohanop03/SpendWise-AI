function deterministicExplanation(recommendation) {
  const savings =
    Number(recommendation.potentialSavings) > 0
      ? ` The estimated saving is ${recommendation.currencyCode} ${recommendation.potentialSavings} per month; it is not guaranteed.`
      : ' No numeric saving is claimed because the available records do not support one.';
  return `${recommendation.recommendationText}.${savings} ${recommendation.suggestedAction}`;
}

function isSafeText(value) {
  return (
    typeof value === 'string' &&
    value.trim().length >= 10 &&
    value.trim().length <= 1200 &&
    !/<script|javascript:|```/i.test(value)
  );
}

export function createRecommendationExplanationService({ enabled = false, provider = null } = {}) {
  return {
    async explain(recommendation) {
      const fallback = deterministicExplanation(recommendation);
      if (!enabled || !provider) return { explanation: fallback, source: 'deterministic' };
      try {
        const facts = {
          currencyCode: recommendation.currencyCode,
          potentialSavings: recommendation.potentialSavings,
          recommendationText: recommendation.recommendationText,
          rule: recommendation.rule,
          serviceName: recommendation.subscription?.serviceName ?? null,
          suggestedAction: recommendation.suggestedAction,
          title: recommendation.title,
        };
        const response = await provider.explain(facts, { maxCharacters: 1200, timeoutMs: 4000 });
        if (!isSafeText(response)) return { explanation: fallback, source: 'deterministic' };
        return { explanation: response.trim(), source: 'provider' };
      } catch {
        return { explanation: fallback, source: 'deterministic' };
      }
    },
  };
}
