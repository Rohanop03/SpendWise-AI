/*
 * Single source of truth for page metadata. Used by <Seo/> at runtime and by
 * scripts/prerender.mjs at build time. The canonical origin comes only from
 * VITE_SITE_URL; when it is unset, canonical/og:url are omitted rather than guessed.
 */

export const SITE_NAME = 'SpendWise AI';
export const THEME_COLOR = '#E8E8EB';

export function siteUrl() {
  const value = import.meta.env?.VITE_SITE_URL || '';
  return value.replace(/\/+$/, '');
}

export function pageTitle(title) {
  return title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Smart subscription manager`;
}

/** Public, indexable routes. Descriptions are 150–160 characters. */
export const publicPages = {
  '/': {
    description:
      'Track every subscription, see renewals before they charge, record payments and refunds, and get explainable rule-based savings suggestions. Free and private.',
    title: null,
  },
  '/how-it-works': {
    description:
      'See how SpendWise AI works: add subscriptions, record payments, get reminders and clear savings suggestions, plus what happens behind the scenes, in plain words.',
    title: 'How it works',
  },
  '/login': {
    description:
      'Log in to SpendWise AI to review upcoming renewals, recurring spend, payment history and explainable cost-saving recommendations for your subscriptions.',
    title: 'Log in',
  },
  '/register': {
    description:
      'Create a free SpendWise AI account to track subscriptions, get renewal reminders, record payments and receive transparent, rule-based cost optimisation tips.',
    title: 'Create an account',
  },
};

export const TEAM = ['Sayak Mondal', 'Rohan Chaudhary', 'Arush James'];

/** JSON-LD for the landing page. No ratings, reviews or offers. */
export function landingJsonLd() {
  const url = siteUrl() || undefined;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      description: publicPages['/'].description,
      name: SITE_NAME,
      ...(url ? { url } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      applicationCategory: 'FinanceApplication',
      author: TEAM.map((name) => ({ '@type': 'Person', name })),
      description: publicPages['/'].description,
      isAccessibleForFree: true,
      name: SITE_NAME,
      operatingSystem: 'Web',
      ...(url ? { url } : {}),
    },
  ];
}
