export const testAppConfig = Object.freeze({
  authRateLimitMax: 1000,
  bcryptCost: 4,
  cookieSecure: false,
  corsOrigin: 'http://localhost:5173',
  jwtAccessExpiresIn: '15m',
  jwtAccessSecret: 'test-only-signing-secret-with-at-least-32-characters',
  nodeEnv: 'test',
  refreshTokenExpiresDays: 7,
});
