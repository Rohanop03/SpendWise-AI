import { Router } from 'express';

import { createCatalogController } from '../controllers/catalogController.js';
import { createCatalogRepository } from '../repositories/catalogRepository.js';
import { createCatalogService } from '../services/catalogService.js';

export function createCategoryRouter(database) {
  const router = Router();
  const repository = createCatalogRepository(database);
  const service = createCatalogService(repository);
  const controller = createCatalogController(service);

  router.get('/', controller.getCategories);

  return router;
}

export function createServiceRouter(database) {
  const router = Router();
  const repository = createCatalogRepository(database);
  const service = createCatalogService(repository);
  const controller = createCatalogController(service);

  router.get('/', controller.getServices);

  return router;
}
