export function createRecommendationController(service) {
  return {
    explain: async (request, response) =>
      response.status(200).json(await service.explain(request.user.id, request.params.id)),
    generate: async (request, response) =>
      response.status(200).json(await service.generate(request.user.id)),
    get: async (request, response) =>
      response
        .status(200)
        .json({ recommendation: await service.get(request.user.id, request.params.id) }),
    list: async (request, response) =>
      response.status(200).json(await service.list(request.user.id, request.validatedQuery)),
    summary: async (request, response) =>
      response.status(200).json(await service.summary(request.user.id)),
    update: async (request, response) =>
      response.status(200).json({
        recommendation: await service.update(
          request.user.id,
          request.params.id,
          request.validatedBody.status,
        ),
      }),
  };
}
