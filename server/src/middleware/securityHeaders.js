/**
 * Security headers middleware.
 * Configures defensive HTTP response headers without breaking client SPA assets or CORS.
 */
export function securityHeaders(config) {
  return function securityHeadersMiddleware(_request, response, next) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('X-XSS-Protection', '0');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (config?.nodeEnv === 'production' && config?.cookieSecure) {
      response.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    next();
  };
}
