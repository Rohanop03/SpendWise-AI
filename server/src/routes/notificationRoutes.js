import { Router } from 'express';

import { createNotificationController } from '../controllers/notificationController.js';
import { validateQuery } from '../middleware/validate.js';
import { createNotificationRepository } from '../repositories/notificationRepository.js';
import { createNotificationService } from '../services/notificationService.js';
import { notificationQuerySchema } from '../validation/schemas.js';

export function createNotificationRouter(database, authenticate) {
  const router = Router();
  const repository = createNotificationRepository(database);
  const service = createNotificationService(repository);
  const controller = createNotificationController(service);
  router.use(authenticate);
  router.get('/', validateQuery(notificationQuerySchema), controller.list);
  router.get('/unread-count', controller.countUnread);
  router.patch('/read-all', controller.markAllRead);
  router.patch('/:id/read', controller.markRead);
  return { controller, repository, router, service };
}
