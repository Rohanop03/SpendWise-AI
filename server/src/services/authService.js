import { AppError } from '../errors/AppError.js';
import {
  createRefreshToken,
  hashRefreshToken,
  parseRefreshToken,
  refreshTokenHashesMatch,
} from '../utils/tokens.js';

const invalidCredentialsError = () =>
  new AppError(401, 'Invalid email or password.', { code: 'INVALID_CREDENTIALS' });
const invalidSessionError = () =>
  new AppError(401, 'Authentication session is invalid or expired.', {
    code: 'INVALID_SESSION',
  });

export function createAuthService({
  accessTokens,
  database,
  passwordManager,
  refreshTokenExpiresDays,
  repository,
}) {
  const refreshLifetimeMilliseconds = refreshTokenExpiresDays * 24 * 60 * 60 * 1000;
  const dummyHashPromise = passwordManager.hash('not-a-real-password-value');

  function buildSession(userId) {
    const refresh = createRefreshToken();
    const expiresAt = new Date(Date.now() + refreshLifetimeMilliseconds);

    return { expiresAt, refresh, userId };
  }

  function createAuthenticationResult(user, session) {
    return {
      accessToken: accessTokens.sign({ sessionId: session.refresh.sessionId, userId: user.id }),
      refreshToken: session.refresh.token,
      refreshTokenMaxAge: refreshLifetimeMilliseconds,
      user,
    };
  }

  return {
    async changePassword(userId, { currentPassword, newPassword }) {
      const passwordHash = await repository.getPasswordHash(userId);

      if (!passwordHash || !(await passwordManager.compare(currentPassword, passwordHash))) {
        throw new AppError(401, 'Current password is incorrect.', {
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      const newPasswordHash = await passwordManager.hash(newPassword);
      await database.withTransaction((transaction) =>
        repository.revokeAllSessionsAndChangePassword(transaction, {
          passwordHash: newPasswordHash,
          userId,
        }),
      );

      return { message: 'Password changed. Sign in again on every device.' };
    },

    async login({ email, password }) {
      const credentials = await repository.findCredentialsByEmail(email);
      const comparisonHash = credentials?.passwordHash ?? (await dummyHashPromise);
      const passwordMatches = await passwordManager.compare(password, comparisonHash);

      if (!credentials || !passwordMatches) {
        throw invalidCredentialsError();
      }

      if (credentials.user.accountStatus !== 'active') {
        throw new AppError(403, 'This account is disabled.', { code: 'ACCOUNT_DISABLED' });
      }

      const session = buildSession(credentials.user.id);
      await repository.createSession({
        expiresAt: session.expiresAt,
        refreshTokenHash: session.refresh.hash,
        sessionId: session.refresh.sessionId,
        userId: credentials.user.id,
      });

      return createAuthenticationResult(credentials.user, session);
    },

    async logout(refreshToken) {
      const parsed = parseRefreshToken(refreshToken);

      if (!parsed) {
        return;
      }

      await database.withTransaction(async (transaction) => {
        const session = await repository.findSessionForUpdate(transaction, parsed.sessionId);

        if (!session || session.revokedAt) {
          return;
        }

        const presentedHash = hashRefreshToken(parsed.token);

        if (refreshTokenHashesMatch(presentedHash, session.refreshTokenHash)) {
          await repository.revokeSession(transaction, session.sessionId);
        }
      });
    },

    async refresh(refreshToken) {
      const parsed = parseRefreshToken(refreshToken);

      if (!parsed) {
        throw invalidSessionError();
      }

      const result = await database.withTransaction(async (transaction) => {
        const session = await repository.findSessionForUpdate(transaction, parsed.sessionId);

        if (!session || session.revokedAt) {
          return { state: 'invalid' };
        }

        const presentedHash = hashRefreshToken(parsed.token);

        if (!refreshTokenHashesMatch(presentedHash, session.refreshTokenHash)) {
          await repository.revokeSession(transaction, session.sessionId);
          return { state: 'reused' };
        }

        if (session.expiresAt <= new Date() || session.user.accountStatus !== 'active') {
          await repository.revokeSession(transaction, session.sessionId);
          return { state: 'invalid' };
        }

        const replacement = createRefreshToken(session.sessionId);
        await repository.rotateSession(transaction, {
          refreshTokenHash: replacement.hash,
          sessionId: session.sessionId,
        });

        return { replacement, session, state: 'rotated' };
      });

      if (result.state !== 'rotated') {
        throw invalidSessionError();
      }

      return {
        accessToken: accessTokens.sign({
          sessionId: result.session.sessionId,
          userId: result.session.user.id,
        }),
        refreshToken: result.replacement.token,
        refreshTokenMaxAge: Math.max(0, result.session.expiresAt.getTime() - Date.now()),
        user: result.session.user,
      };
    },

    async register({ email, name, password }) {
      const passwordHash = await passwordManager.hash(password);
      const session = buildSession(null);

      try {
        const user = await database.withTransaction((transaction) =>
          repository.createUserWithPreferencesAndSession(transaction, {
            name,
            email,
            passwordHash,
            refreshTokenHash: session.refresh.hash,
            sessionExpiresAt: session.expiresAt,
            sessionId: session.refresh.sessionId,
          }),
        );

        return createAuthenticationResult(user, session);
      } catch (error) {
        if (error.code === '23505') {
          throw new AppError(409, 'An account with that email already exists.', {
            code: 'EMAIL_IN_USE',
          });
        }

        throw error;
      }
    },
  };
}
