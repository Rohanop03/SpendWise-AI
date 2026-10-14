import { AppError } from '../errors/AppError.js';

const authenticationRequired = () =>
  new AppError(401, 'Authentication is required.', { code: 'AUTHENTICATION_REQUIRED' });

export function createAuthenticate({ accessTokens, repository }) {
  return async function authenticate(request, _response, next) {
    const authorization = request.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      next(authenticationRequired());
      return;
    }

    try {
      const payload = accessTokens.verify(authorization.slice(7));

      if (
        typeof payload !== 'object' ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        !Number.isInteger(payload.iat) ||
        !Number.isInteger(payload.exp)
      ) {
        throw authenticationRequired();
      }

      const user = await repository.findActiveIdentity({
        sessionId: payload.sid,
        userId: payload.sub,
      });

      if (!user || user.accountStatus !== 'active') {
        throw authenticationRequired();
      }

      request.user = user;
      request.auth = { sessionId: payload.sid };
      next();
    } catch {
      next(authenticationRequired());
    }
  };
}
