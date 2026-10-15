function deterministicExplanation(recommendation) {
  const savings = recommendation.estimatedSavings
    ? ` The stored hypothetical opportunity is ${recommendation.currencyCode} ${recommendation.estimatedSavings} per ${recommendation.savingsPeriod}; it is not guaranteed.`
    : ' No numeric saving is claimed because the available records do not support one.';
  return `${recommendation.explanation}${savings} ${recommendation.suggestedAction}`;
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
          confidence: recommendation.confidence,
          currencyCode: recommendation.currencyCode,
          estimatedSavings: recommendation.estimatedSavings,
          explanation: recommendation.explanation,
          savingsPeriod: recommendation.savingsPeriod,
          serviceNames: recommendation.subscriptions.map((item) => item.serviceName),
          suggestedAction: recommendation.suggestedAction,
          title: recommendation.title,
          type: recommendation.type,
        };
        const response = await provider.explain(facts, { timeoutMs: 4000, maxCharacters: 1200 });
        if (!isSafeText(response)) return { explanation: fallback, source: 'deterministic' };
        return { explanation: response.trim(), source: 'provider' };
      } catch {
        return { explanation: fallback, source: 'deterministic' };
      }
    },
  };
}
