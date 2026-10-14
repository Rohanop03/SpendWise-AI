export function createCatalogController(catalogService) {
  return {
    async getCategories(_request, response) {
      const categories = await catalogService.listCategories();
      response.status(200).json({ categories });
    },

    async getServices(request, response) {
      const search = typeof request.query.search === 'string' ? request.query.search : undefined;
      const services = await catalogService.listServices({ search });
      response.status(200).json({ services });
    },
  };
}
