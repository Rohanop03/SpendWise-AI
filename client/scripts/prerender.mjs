/**
 * Post-build prerender of the public routes so crawlers get real HTML without JavaScript.
 *
 *   1. SSR-build src/entry-server.jsx into .ssr/ (temporary)
 *   2. render "/", "/login", "/register" into dist/<route>/index.html with their head tags
 *   3. write robots.txt (private routes disallowed), sitemap.xml (when VITE_SITE_URL is
 *      set) and llms.txt
 *
 * The client does not hydrate: it renders fresh and removes the [data-prerender] head
 * tags, so auth-dependent markup can never produce a hydration mismatch.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { build, loadEnv } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrOut = path.join(root, '.ssr');

const env = loadEnv('production', root, 'VITE_');
Object.assign(process.env, env);

await build({
  build: { emptyOutDir: true, outDir: ssrOut, ssr: 'src/entry-server.jsx' },
  configFile: path.join(root, 'vite.config.js'),
  logLevel: 'warn',
  mode: 'production',
  root,
});

const server = await import(pathToFileURL(path.join(ssrOut, 'entry-server.js')).href);
const template = await readFile(path.join(dist, 'index.html'), 'utf8');

// React 19 emits hoistable <title>/<meta>/<link> tags inline when rendering a fragment;
// the head is written separately, so strip them from the body markup.
const stripHoisted = (html) =>
  html
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\b[^>]*>/g, '')
    .replace(/<link\b[^>]*rel="canonical"[^>]*>/g, '');

const privatePaths = [
  '/dashboard',
  '/subscriptions',
  '/payments',
  '/billing',
  '/analytics',
  '/notifications',
  '/recommendations',
  '/account',
  '/settings',
];

for (const url of server.routes) {
  const body = stripHoisted(server.render(url));
  const html = template
    .replace(/\s*<title data-prerender>[\s\S]*?<\/title>/, '')
    .replace('<!--app-head-->', server.head(url))
    .replace('<!--app-html-->', body);
  const target =
    url === '/' ? path.join(dist, 'index.html') : path.join(dist, url.slice(1), 'index.html');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
  console.log(`prerendered ${url} → ${path.relative(root, target)}`);
}

// SPA fallback for private routes keeps the plain shell (no public content baked in).
await writeFile(
  path.join(dist, '200.html'),
  template
    .replace('<!--app-head-->', '<meta data-prerender name="robots" content="noindex, nofollow">')
    .replace('<!--app-html-->', ''),
);

const origin = server.siteUrl();
const robots = [
  'User-agent: *',
  'Allow: /$',
  'Allow: /login',
  'Allow: /register',
  ...privatePaths.map((item) => `Disallow: ${item}`),
  origin ? `\nSitemap: ${origin}/sitemap.xml` : '',
].join('\n');
await writeFile(path.join(dist, 'robots.txt'), `${robots.trim()}\n`);

if (origin) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = server.routes
    .map((url) => `  <url><loc>${origin}${url}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n');
  await writeFile(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
} else {
  console.warn('VITE_SITE_URL is not set: canonical URLs and sitemap.xml were skipped.');
}

const base = origin || '';
await writeFile(
  path.join(dist, 'llms.txt'),
  `# SpendWise AI

> A smart subscription manager: track recurring subscriptions, see renewals before they
> charge, keep a payment and refund ledger, and get explainable, rule-based cost
> optimisation suggestions. A DBMS lab project (PostgreSQL, raw SQL, no ORM) by
> Sayak Mondal, Rohan Chaudhary and Arush James.

## Public pages

- [Home](${base}/): what the app does, how it works, and the database design
- [Log in](${base}/login)
- [Create an account](${base}/register)

All other routes are private, per-user pages and are not indexed.
`,
);

await rm(ssrOut, { force: true, recursive: true });
