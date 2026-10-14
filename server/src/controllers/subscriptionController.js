export function createSubscriptionController(subscriptionService) {
  return {
    async archive(request, response) {
      const subscription = await subscriptionService.archiveSubscription(
        request.user.id,
        request.params.id,
      );
      response.status(200).json({ subscription });
    },

    async create(request, response) {
      const subscription = await subscriptionService.createSubscription(
        request.user.id,
        request.validatedBody,
      );
      response.status(201).json({ subscription });
    },

    async getById(request, response) {
      const subscription = await subscriptionService.getSubscription(
        request.user.id,
        request.params.id,
      );
      response.status(200).json({ subscription });
    },

    async list(request, response) {
      const result = await subscriptionService.listSubscriptions(
        request.user.id,
        request.validatedQuery,
      );
      response.status(200).json(result);
    },

    async restore(request, response) {
      const subscription = await subscriptionService.restoreSubscription(
        request.user.id,
        request.params.id,
      );
      response.status(200).json({ subscription });
    },

    async update(request, response) {
      const subscription = await subscriptionService.updateSubscription(
        request.user.id,
        request.params.id,
        request.validatedBody,
      );
      response.status(200).json({ subscription });
    },
  };
}
