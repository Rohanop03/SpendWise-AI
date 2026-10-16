/**
 * Lighthouse CI puppeteer script: public URLs are audited logged out (they run first);
 * before the first private URL, sign in through the real login form with the test account
 * from LHCI_EMAIL / LHCI_PASSWORD. Credentials come from the environment only.
 */
let signedIn = false;

module.exports = async (browser, context) => {
  const { pathname } = new URL(context.url);
  const isPrivate =
    /^\/(dashboard|subscriptions|payments|billing|analytics|notifications|recommendations|account|settings)/.test(
      pathname,
    );
  if (!isPrivate || signedIn) return;

  const email = process.env.LHCI_EMAIL;
  const password = process.env.LHCI_PASSWORD;
  if (!email || !password) {
    throw new Error('Set LHCI_EMAIL and LHCI_PASSWORD to audit private routes.');
  }

  const page = await browser.newPage();
  await page.goto(new URL('/login', context.url).href, { waitUntil: 'networkidle0' });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await Promise.all([
    page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.close();
  signedIn = true;
};
