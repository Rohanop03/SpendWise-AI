export const THEME_STORAGE_KEY = 'spendwise-theme';

export function getPreferredTheme() {
  if (typeof window === 'undefined') return 'light';

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function persistTheme(theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The selected theme still applies for the current page when storage is unavailable.
  }
}
