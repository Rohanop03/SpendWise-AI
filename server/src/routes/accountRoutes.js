import { Router } from 'express';

import { createAccountController } from '../controllers/accountController.js';
import { validateBody } from '../middleware/validate.js';
import { createAccountRepository } from '../repositories/accountRepository.js';
import { createAccountService } from '../services/accountService.js';
import { preferencesUpdateSchema, profileUpdateSchema } from '../validation/schemas.js';

export function createAccountRouter(database, authenticate) {
  const router = Router();
  const controller = createAccountController(
    createAccountService(createAccountRepository(database)),
  );

  router.use(authenticate);
  router.patch('/me', validateBody(profileUpdateSchema), controller.updateProfile);
  router.get('/me/preferences', controller.getPreferences);
  router.patch(
    '/me/preferences',
    validateBody(preferencesUpdateSchema),
    controller.updatePreferences,
  );

  return router;
}
