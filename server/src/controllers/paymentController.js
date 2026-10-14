export function createPaymentController(paymentService) {
  return {
    async create(request, response) {
      const payment = await paymentService.createPayment(
        request.user.id,
        request.params.id,
        request.validatedBody,
      );
      response.status(201).json({ payment });
    },

    async getById(request, response) {
      const payment = await paymentService.getPayment(request.user.id, request.params.id);
      response.status(200).json({ payment });
    },

    async list(request, response) {
      const result = await paymentService.listPayments(
        request.user.id,
        request.validatedQuery || request.query,
      );
      response.status(200).json(result);
    },

    async listForSubscription(request, response) {
      const result = await paymentService.listSubscriptionPayments(
        request.user.id,
        request.params.id,
        request.validatedQuery || request.query,
      );
      response.status(200).json(result);
    },

    async update(request, response) {
      const payment = await paymentService.updatePayment(
        request.user.id,
        request.params.id,
        request.validatedBody,
      );
      response.status(200).json({ payment });
    },
  };
}
