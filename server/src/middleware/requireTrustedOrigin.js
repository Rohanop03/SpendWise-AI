import { AppError } from '../errors/AppError.js';

export function createTrustedOriginMiddleware(trustedOrigin) {
  return function requireTrustedOrigin(request, _response, next) {
    const origin = request.get('Origin');
    const requestedWith = request.get('X-Requested-With');

    if (origin !== trustedOrigin || requestedWith !== 'XMLHttpRequest') {
      next(new AppError(403, 'Request origin could not be verified.', { code: 'CSRF_REJECTED' }));
      return;
    }

    next();
  };
}
