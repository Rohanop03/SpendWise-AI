export function createCatalogService(catalogRepository) {
  return {
    async listCategories() {
      return catalogRepository.listCategories();
    },

    async listServices(options = {}) {
      return catalogRepository.listServices(options);
    },
  };
}
