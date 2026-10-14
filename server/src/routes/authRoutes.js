import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { createAuthController } from '../controllers/authController.js';
import { createAuthenticate } from '../middleware/authenticate.js';
import { createTrustedOriginMiddleware } from '../middleware/requireTrustedOrigin.js';
import { validateBody } from '../middleware/validate.js';
import { createAccountRepository } from '../repositories/accountRepository.js';
import { createAuthService } from '../services/authService.js';
import { createPasswordManager } from '../utils/password.js';
import { createAccessTokenManager } from '../utils/tokens.js';
import { changePasswordSchema, loginSchema, registerSchema } from '../validation/schemas.js';

export function createAuthRouter(database, appConfig) {
  const router = Router();
  const repository = createAccountRepository(database);
  const accessTokens = createAccessTokenManager({
    expiresIn: appConfig.jwtAccessExpiresIn,
    secret: appConfig.jwtAccessSecret,
  });
  const authService = createAuthService({
    accessTokens,
    database,
    passwordManager: createPasswordManager(appConfig.bcryptCost),
    refreshTokenExpiresDays: appConfig.refreshTokenExpiresDays,
    repository,
  });
  const controller = createAuthController({ authService, cookieSecure: appConfig.cookieSecure });
  const authenticate = createAuthenticate({ accessTokens, repository });
  const requireTrustedOrigin = createTrustedOriginMiddleware(appConfig.corsOrigin);
  const credentialRateLimit = rateLimit({
    handler: (_request, response) => {
      response.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts. Please try again later.',
        status: 'error',
      });
    },
    legacyHeaders: false,
    limit: appConfig.authRateLimitMax,
    standardHeaders: 'draft-8',
    windowMs: 15 * 60 * 1000,
  });

  router.post(
    '/register',
    requireTrustedOrigin,
    credentialRateLimit,
    validateBody(registerSchema),
    controller.register,
  );
  router.post(
    '/login',
    requireTrustedOrigin,
    credentialRateLimit,
    validateBody(loginSchema),
    controller.login,
  );
  router.post('/refresh', requireTrustedOrigin, controller.refresh);
  router.post('/logout', requireTrustedOrigin, controller.logout);
  router.get('/me', authenticate, controller.me);
  router.post(
    '/change-password',
    authenticate,
    requireTrustedOrigin,
    validateBody(changePasswordSchema),
    controller.changePassword,
  );

  return { authenticate, router };
}
