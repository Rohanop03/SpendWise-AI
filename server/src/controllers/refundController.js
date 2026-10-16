export function createRefundController(refundService) {
  return {
    async create(request, response) {
      const result = await refundService.createRefund(
        request.user.id,
        request.validatedParams.id,
        request.validatedBody,
      );
      response.status(201).json(result);
    },

    async list(request, response) {
      const result = await refundService.listRefunds(request.user.id, request.validatedParams.id);
      response.status(200).json(result);
    },
  };
}
