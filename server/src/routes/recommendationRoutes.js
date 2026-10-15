import { Router } from 'express';

import { createRecommendationController } from '../controllers/recommendationController.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createRecommendationRepository } from '../repositories/recommendationRepository.js';
import { createRecommendationExplanationService } from '../services/recommendationExplanationService.js';
import { createRecommendationService } from '../services/recommendationService.js';
import { recommendationQuerySchema, recommendationStatusSchema } from '../validation/schemas.js';

export function createRecommendationRouter(database, authenticate) {
  const router = Router();
  const repository = createRecommendationRepository(database);
  const explanationService = createRecommendationExplanationService();
  const service = createRecommendationService(database, repository, explanationService);
  const controller = createRecommendationController(service);
  router.use(authenticate);
  router.get('/', validateQuery(recommendationQuerySchema), controller.list);
  router.get('/summary', controller.summary);
  router.post('/generate', controller.generate);
  router.get('/:id', controller.get);
  router.patch('/:id', validateBody(recommendationStatusSchema), controller.update);
  router.post('/:id/explain', controller.explain);
  return { controller, repository, router, service };
}
