import { pageTitle, siteUrl, SITE_NAME } from './meta.js';

/**
 * Per-page metadata using React 19's native <title>/<meta>/<link> hoisting.
 * Private (authenticated) pages pass `noindex` and get `noindex, nofollow`.
 */
export default function Seo({ description, noindex = false, path, title }) {
  const fullTitle = pageTitle(title);
  const origin = siteUrl();
  const canonical = origin && path ? `${origin}${path === '/' ? '/' : path}` : null;
  const image = origin ? `${origin}/og-image.png` : '/og-image.png';

  return (
    <>
      <title>{fullTitle}</title>
      {noindex ? (
        <meta content="noindex, nofollow" name="robots" />
      ) : (
        <>
          <meta content="index, follow" name="robots" />
          {description && <meta content={description} name="description" />}
          {canonical && <link href={canonical} rel="canonical" />}
          <meta content={SITE_NAME} property="og:site_name" />
          <meta content="website" property="og:type" />
          <meta content={fullTitle} property="og:title" />
          {description && <meta content={description} property="og:description" />}
          {canonical && <meta content={canonical} property="og:url" />}
          <meta content={image} property="og:image" />
          <meta content="1200" property="og:image:width" />
          <meta content="630" property="og:image:height" />
          <meta
            content="SpendWise AI wordmark on a light raised card with a black pill"
            property="og:image:alt"
          />
          <meta content="summary_large_image" name="twitter:card" />
          <meta content={fullTitle} name="twitter:title" />
          {description && <meta content={description} name="twitter:description" />}
          <meta content={image} name="twitter:image" />
        </>
      )}
    </>
  );
}
