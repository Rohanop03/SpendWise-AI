import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';

import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { landingJsonLd, pageTitle, publicPages, siteUrl, SITE_NAME } from './seo/meta.js';

/** Build-time render of a public route (used only by scripts/prerender.mjs). */
export function render(url) {
  return renderToString(
    <StaticRouter location={url}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StaticRouter>,
  );
}

const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

/** Static head tags for a public route, from the same config <Seo/> uses at runtime. */
export function head(url) {
  const page = publicPages[url];
  const title = pageTitle(page.title);
  const origin = siteUrl();
  const canonical = origin ? `${origin}${url}` : null;
  const image = origin ? `${origin}/og-image.png` : '/og-image.png';
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(page.description)}">`,
    '<meta name="robots" content="index, follow">',
    canonical && `<link rel="canonical" href="${escape(canonical)}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(page.description)}">`,
    canonical && `<meta property="og:url" content="${escape(canonical)}">`,
    `<meta property="og:image" content="${escape(image)}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(page.description)}">`,
    `<meta name="twitter:image" content="${escape(image)}">`,
  ].filter(Boolean);
  return tags.map((tag) => tag.replace(/^<(\w+)/, '<$1 data-prerender')).join('\n    ');
}

export const routes = Object.keys(publicPages);
export const jsonLd = landingJsonLd;
export { siteUrl };
