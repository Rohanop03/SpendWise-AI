export function createBillingController(billingService) {
  return {
    async overview(request, response) {
      const result = await billingService.getBillingOverview(
        request.user.id,
        request.validatedQuery || request.query,
      );
      response.status(200).json(result);
    },

    async upcoming(request, response) {
      const result = await billingService.getUpcomingRenewals(
        request.user.id,
        request.validatedQuery || request.query,
      );
      response.status(200).json(result);
    },
  };
}
