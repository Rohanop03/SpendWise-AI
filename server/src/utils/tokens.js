import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import jwt from 'jsonwebtoken';

const accessTokenAlgorithm = 'HS256';
const accessTokenAudience = 'spendwise-web';
const accessTokenIssuer = 'spendwise-api';
const refreshSecretBytes = 32;
const refreshTokenPattern =
  /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenHashesMatch(left, right) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createRefreshToken(sessionId = randomUUID()) {
  const secret = randomBytes(refreshSecretBytes).toString('base64url');
  const token = `${sessionId}.${secret}`;

  return { hash: hashRefreshToken(token), sessionId, token };
}

export function parseRefreshToken(token) {
  const match = typeof token === 'string' ? refreshTokenPattern.exec(token) : null;

  return match ? { sessionId: match[1].toLowerCase(), token } : null;
}

export function createAccessTokenManager({ expiresIn, secret }) {
  return {
    sign({ sessionId, userId }) {
      return jwt.sign({ sid: sessionId }, secret, {
        algorithm: accessTokenAlgorithm,
        audience: accessTokenAudience,
        expiresIn,
        issuer: accessTokenIssuer,
        subject: String(userId),
      });
    },
    verify(token) {
      return jwt.verify(token, secret, {
        algorithms: [accessTokenAlgorithm],
        audience: accessTokenAudience,
        issuer: accessTokenIssuer,
        requiredClaims: ['sub', 'sid', 'iat', 'exp'],
      });
    },
  };
}

export const accessTokenContract = Object.freeze({
  algorithm: accessTokenAlgorithm,
  audience: accessTokenAudience,
  issuer: accessTokenIssuer,
});
