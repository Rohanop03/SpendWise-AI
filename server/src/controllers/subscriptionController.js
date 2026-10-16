export function createSubscriptionController(subscriptionService) {
  const id = (request) => request.validatedParams.id;

  return {
    async archive(request, response) {
      const subscription = await subscriptionService.archiveSubscription(request.user.id, id(request));
      response.status(200).json({ subscription });
    },

    async cancel(request, response) {
      const result = await subscriptionService.cancelSubscription(
        request.user.id,
        id(request),
        request.validatedBody,
      );
      response.status(200).json(result);
    },

    async create(request, response) {
      const subscription = await subscriptionService.createSubscription(
        request.user.id,
        request.validatedBody,
      );
      response.status(201).json({ subscription });
    },

    async delete(request, response) {
      await subscriptionService.deleteSubscription(request.user.id, id(request));
      response.status(204).end();
    },

    async getById(request, response) {
      const subscription = await subscriptionService.getSubscription(request.user.id, id(request));
      response.status(200).json({ subscription });
    },

    async history(request, response) {
      const items = await subscriptionService.getHistory(
        request.user.id,
        id(request),
        request.validatedQuery,
      );
      response.status(200).json({ items });
    },

    async list(request, response) {
      const result = await subscriptionService.listSubscriptions(
        request.user.id,
        request.validatedQuery,
      );
      response.status(200).json(result);
    },

    async markUsed(request, response) {
      const subscription = await subscriptionService.markUsed(
        request.user.id,
        id(request),
        request.validatedBody,
      );
      response.status(200).json({ subscription });
    },

    async restore(request, response) {
      const subscription = await subscriptionService.restoreSubscription(request.user.id, id(request));
      response.status(200).json({ subscription });
    },

    async update(request, response) {
      const subscription = await subscriptionService.updateSubscription(
        request.user.id,
        id(request),
        request.validatedBody,
      );
      response.status(200).json({ subscription });
    },
  };
}
