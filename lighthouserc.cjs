/**
 * Lighthouse CI (mobile, production build). Run with `npm run lhci`.
 *
 * Prerequisites:
 *  - `npm run build` (prerendered public routes in client/dist)
 *  - the API running on :5000 with a migrated database (`npm run dev:server`)
 *  - LHCI_EMAIL / LHCI_PASSWORD for an existing test account (private routes are
 *    audited while logged in via scripts/lhci-login.cjs). Never commit these values.
 *
 * The site is served on :5173 because the API's CORS_ORIGIN / trusted-origin check
 * expects that origin.
 */
const base = 'http://localhost:5173';
const publicUrls = [`${base}/`, `${base}/login`, `${base}/register`];
const privateUrls = [`${base}/dashboard`, `${base}/subscriptions`];

module.exports = {
  ci: {
    assert: {
      assertMatrix: [
        {
          aggregationMethod: 'median-run',
          assertions: {
            'categories:accessibility': ['error', { minScore: 1 }],
            'categories:best-practices': ['error', { minScore: 1 }],
            'categories:performance': ['error', { minScore: 0.9 }],
            'categories:seo': ['error', { minScore: 1 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
            'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
          },
          matchingUrlPattern: '^http://localhost:5173/(login|register)?$',
        },
        {
          aggregationMethod: 'median-run',
          assertions: {
            'categories:accessibility': ['error', { minScore: 1 }],
            'categories:best-practices': ['error', { minScore: 1 }],
            'categories:performance': ['error', { minScore: 0.85 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.05 }],
            'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
          },
          matchingUrlPattern: '^http://localhost:5173/(dashboard|subscriptions)$',
        },
      ],
    },
    collect: {
      // Three runs per URL; assertions use the median run so the first URL is not judged
      // on a cold browser start alone.
      numberOfRuns: 3,
      puppeteerLaunchOptions: { args: ['--no-sandbox'] },
      puppeteerScript: './scripts/lhci-login.cjs',
      settings: {
        disableStorageReset: true,
        formFactor: 'mobile',
        preset: undefined,
      },
      startServerCommand: 'node client/scripts/serve-dist.mjs 5173',
      startServerReadyPattern: 'Serving',
      url: [...publicUrls, ...privateUrls],
    },
    upload: { outputDir: '.lighthouseci', target: 'filesystem' },
  },
};
