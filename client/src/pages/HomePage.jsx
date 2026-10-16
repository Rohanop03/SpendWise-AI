import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import ApiStatus from '../components/ApiStatus.jsx';
import { BrandGlyph } from '../layout/BrandMark.jsx';
import { landingJsonLd, publicPages, TEAM } from '../seo/meta.js';
import Seo from '../seo/Seo.jsx';
import Icon from '../ui/Icon.jsx';
import { prefersReducedMotion, whenIdle } from '../ui/motion.js';
import { PillLink } from '../ui/Pill.jsx';
import { ChromeSheen } from '../ui/Surface.jsx';
import { useSmoothScroll } from '../ui/useSmoothScroll.js';

// Facts taken from server/db/migrations and docs/NORMALIZATION.md — not marketing numbers.
const designFacts = [
  '12 relational tables',
  'Normalised to 3NF (BCNF per relation)',
  '2 views · 1 audit trigger · 1 stored procedure',
  '22 indexes incl. a covering partial index',
  'Row-locked transactions for refunds',
  'Rule-based, explainable recommendations',
];

const problems = [
  {
    body: 'Annual plans and free trials renew quietly. By the time the charge lands, the cancellation window has closed.',
    glyph: 'calendar',
    title: 'Forgotten renewals',
  },
  {
    body: 'A service you stopped opening keeps billing every month, because nothing reminds you it exists.',
    glyph: 'pause',
    title: 'Subscriptions you stopped using',
  },
  {
    body: 'Two streaming plans, two cloud drives, two music apps — overlap hides when each lives in a different inbox.',
    glyph: 'stack',
    title: 'Duplicate services',
  },
  {
    body: 'Card statements, app stores and email receipts each show a slice. None shows the monthly total.',
    glyph: 'grid',
    title: 'No consolidated view',
  },
];

const steps = [
  [
    'Track',
    'Add catalog or custom subscriptions with price, currency, billing cycle and renewal date.',
    'stack',
  ],
  [
    'Aggregate',
    'SQL views normalise every plan to a monthly equivalent and keep currencies separate.',
    'chart',
  ],
  [
    'Remind',
    'A background worker raises renewal and trial reminders inside your chosen lead time.',
    'bell',
  ],
  [
    'Recommend',
    'Deterministic rules flag overlaps, high costs and trial ends — each with its reasoning.',
    'spark',
  ],
];

const features = [
  [
    'Subscription management',
    'Catalog and custom services, plans, statuses, soft archive and restore, search and filters.',
  ],
  [
    'Renewal dial & reminders',
    'See the next 30 days at a glance; reminders follow your lead-time preferences.',
  ],
  [
    'Payment & refund ledger',
    'Record payments, correct entries and log partial or full refunds against a balance.',
  ],
  [
    'Spending analytics',
    'Monthly cash flow, category share, billing cycles and payment status, exportable as CSV.',
  ],
  [
    'Explainable recommendations',
    'Every suggestion shows why it was made, its limitation, and hypothetical savings only.',
  ],
  [
    'Private by design',
    'Per-user isolation, short-lived tokens, HttpOnly refresh sessions, no bank connections.',
  ],
];

const underTheHood = [
  [
    'Keys & constraints',
    'Surrogate primary keys, composite foreign keys enforcing same-user ownership, CHECK constraints on money, dates and statuses.',
  ],
  [
    'Views',
    '`active_subscription_commitments` and `completed_payment_financials` feed analytics without duplicating data.',
  ],
  [
    'Trigger',
    '`trg_subscriptions_audit_terms` writes an audit event whenever price, status, cycle or renewal date changes.',
  ],
  [
    'Stored procedure',
    '`spendwise_retire_stale_recommendations` retires recommendations whose evidence no longer holds.',
  ],
  [
    'Indexes',
    '22 indexes, including a covering partial index on completed payments measured against 50,000 rows.',
  ],
  [
    'Transactions',
    'Refunds lock the payment row (`FOR UPDATE`) so concurrent refunds can never exceed the amount paid.',
  ],
  [
    'Normalisation',
    '3NF throughout, generally BCNF; historical payment amounts are deliberate, documented snapshots.',
  ],
  [
    'Money',
    '`NUMERIC(12,2)` everywhere, never summed across currencies without exchange-rate data.',
  ],
];

/** GSAP + ScrollTrigger reveals for sections below the fold (landing page only). */
function useScrollReveals(rootRef) {
  useEffect(() => {
    if (prefersReducedMotion() || typeof window.matchMedia !== 'function') return undefined;
    let context;
    let cancelled = false;
    const cancelIdle = whenIdle(() =>
      Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
        ([{ gsap }, { ScrollTrigger }]) => {
          if (cancelled || !rootRef.current) return;
          gsap.registerPlugin(ScrollTrigger);
          context = gsap.context(() => {
            gsap.utils.toArray('[data-reveal]').forEach((element) => {
              if (element.getBoundingClientRect().top < window.innerHeight) return;
              gsap.from(element, {
                duration: 0.8,
                ease: 'power3.out',
                opacity: 0,
                scrollTrigger: { start: 'top 88%', trigger: element },
                y: 28,
              });
            });
          }, rootRef);
        },
      ),
    );
    return () => {
      cancelled = true;
      cancelIdle();
      context?.revert();
    };
  }, [rootRef]);
}

function HomePage() {
  const { isAuthenticated } = useAuth();
  const root = useRef(null);
  useSmoothScroll(true);
  useScrollReveals(root);

  return (
    <div ref={root}>
      <Seo description={publicPages['/'].description} path="/" />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()) }}
        type="application/ld+json"
      />

      {/* Hero bento */}
      <section
        aria-labelledby="hero-title"
        className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8 lg:px-10 lg:pt-16"
      >
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="neu-raised relative overflow-hidden rounded-(--radius-panel) p-6 sm:p-10 lg:col-span-7 lg:row-span-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 hidden size-80 rounded-full opacity-80 lg:block"
              style={{
                background:
                  'radial-gradient(circle at 32% 28%, #ffffff 0%, #e4e4e8 22%, #a9a9b1 52%, #3a3a40 82%, #1c1c20 100%)',
                boxShadow:
                  'inset -18px -24px 60px rgb(0 0 0 / 35%), 0 40px 80px -30px rgb(12 12 14 / 45%)',
              }}
            />
            <div className="relative">
              <ApiStatus />
              <p className="eyebrow mt-8">SpendWise AI · Smart subscription manager</p>
              <h1
                className="mt-4 max-w-2xl text-[clamp(2.5rem,1.6rem+4vw,4.6rem)] leading-[1.02]"
                id="hero-title"
              >
                AI-powered subscription tracking and cost optimisation
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-(--graphite)">
                Every recurring charge in one place: renewals you can see coming, payments and
                refunds on a clean ledger, and savings suggestions that explain themselves.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <PillLink iconRight="arrowRight" to="/dashboard" variant="ink">
                      Go to Dashboard
                    </PillLink>
                    <PillLink to="/subscriptions">Manage Subscriptions</PillLink>
                  </>
                ) : (
                  <>
                    <PillLink iconRight="arrowRight" to="/register" variant="ink">
                      Get started
                    </PillLink>
                    <PillLink to="/login">Sign in</PillLink>
                  </>
                )}
              </div>
            </div>
          </div>

          <article
            aria-labelledby="example-title"
            className="obsidian rounded-(--radius-panel) p-6 sm:p-8 lg:col-span-5"
          >
            <ChromeSheen />
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold">
                Example
              </span>
              <span className="eyebrow !text-(--on-ink-soft)">Recommendation preview</span>
            </div>
            <p className="eyebrow mt-6 !text-(--on-ink-soft)">potential overlap</p>
            <h2 className="mt-2 text-2xl" id="example-title">
              Review X: it overlaps another plan you pay for
            </h2>
            <p className="display-num mt-4 text-5xl">₹499</p>
            <p className="mt-1 text-sm font-bold">
              would be saved per month if cancelled (hypothetical)
            </p>
            <p className="mt-4 text-sm leading-6 text-soft">
              <strong className="text-(--paper)">Why this was suggested:</strong> two active
              subscriptions in the same category renew within the same month. Illustrative values —
              not real user data.
            </p>
          </article>

          <ul
            aria-label="Design facts"
            className="glass flex flex-wrap content-start gap-2 rounded-(--radius-panel) p-5 lg:col-span-5"
          >
            {designFacts.map((fact) => (
              <li
                className="neu-raised depth-1 rounded-full px-3.5 py-2 text-sm font-bold"
                key={fact}
              >
                {fact}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Problem */}
      <section
        aria-labelledby="problem-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <p className="eyebrow" data-reveal>
          01 / The problem
        </p>
        <h2
          className="mt-3 max-w-3xl text-[clamp(1.9rem,1.4rem+2vw,3rem)]"
          data-reveal
          id="problem-title"
        >
          Subscriptions press on you every month — quietly.
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, index) => (
            <li className="neu-raised rounded-(--radius-card) p-6" data-reveal key={problem.title}>
              <span
                aria-hidden="true"
                className="neu-pressed grid size-14 place-items-center rounded-2xl"
                style={{ animation: `drift-a ${7 + index}s ease-in-out infinite` }}
              >
                <Icon className="size-6" name={problem.glyph} />
              </span>
              <h3 className="mt-6 text-lg">{problem.title}</h3>
              <p className="mt-2 text-sm leading-6 text-(--graphite)">{problem.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section
        aria-labelledby="how-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <p className="eyebrow" data-reveal>
          02 / How it works
        </p>
        <h2 className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,3rem)]" data-reveal id="how-title">
          Track → Aggregate → Remind → Recommend
        </h2>
        <ol className="mt-10 grid gap-5 lg:grid-cols-4">
          {steps.map(([title, body, icon], index) => (
            <li
              className={`${index === 3 ? 'obsidian' : 'neu-raised'} relative rounded-(--radius-card) p-6`}
              data-reveal
              key={title}
            >
              {index === 3 && <ChromeSheen />}
              <div className="flex items-center justify-between">
                <span className="num text-sm">{String(index + 1).padStart(2, '0')}</span>
                <Icon className="size-6" name={icon} />
              </div>
              <h3 className="mt-8 text-2xl">{title}</h3>
              <p
                className={`mt-2 text-sm leading-6 ${index === 3 ? 'text-soft' : 'text-(--graphite)'}`}
              >
                {body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section
        aria-labelledby="features-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <p className="eyebrow" data-reveal>
          03 / Features
        </p>
        <h2 className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,3rem)]" data-reveal id="features-title">
          What you can do with SpendWise AI
        </h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body]) => (
            <li className="neu-raised rounded-(--radius-card) p-6" data-reveal key={title}>
              <span aria-hidden="true" className="pill-ink block h-2 w-10 rounded-full" />
              <h3 className="mt-5 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-(--graphite)">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Under the hood */}
      <section
        aria-labelledby="hood-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <div className="neu-pressed rounded-(--radius-panel) p-6 sm:p-10" data-reveal>
          <p className="eyebrow">04 / Under the hood</p>
          <h2 className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,3rem)]" id="hood-title">
            A PostgreSQL design built for a DBMS lab
          </h2>
          <p className="mt-4 max-w-3xl leading-7 text-(--graphite)">
            For reviewers: raw parameterised SQL, no ORM. The database enforces the rules the
            interface relies on.
          </p>
          <dl className="mt-8 grid gap-4 md:grid-cols-2">
            {underTheHood.map(([term, detail]) => (
              <div className="neu-raised depth-2 rounded-2xl p-5" key={term}>
                <dt className="font-bold">{term}</dt>
                <dd className="mt-1.5 text-sm leading-6 text-(--graphite)">
                  {detail.replaceAll('`', '')}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Team + closing CTA */}
      <section
        aria-labelledby="team-title"
        className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-8 lg:px-10"
      >
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="neu-raised rounded-(--radius-panel) p-6 sm:p-8 lg:col-span-5" data-reveal>
            <p className="eyebrow">05 / Team</p>
            <h2 className="mt-3 text-2xl" id="team-title">
              Built by
            </h2>
            <ul className="mt-6 space-y-3">
              {TEAM.map((name) => (
                <li className="flex items-center gap-3" key={name}>
                  <span
                    aria-hidden="true"
                    className="neu-pressed depth-1 grid size-10 place-items-center rounded-full text-sm font-bold"
                  >
                    {name
                      .split(' ')
                      .map((part) => part[0])
                      .join('')}
                  </span>
                  <span className="font-bold">{name}</span>
                </li>
              ))}
            </ul>
          </div>
          <div
            className="obsidian flex flex-col justify-between gap-8 rounded-(--radius-panel) p-6 sm:p-10 lg:col-span-7"
            data-reveal
          >
            <ChromeSheen />
            <div className="flex items-center gap-4">
              <BrandGlyph className="size-12" />
              <p className="text-2xl font-bold sm:text-3xl">See every renewal before it charges.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isAuthenticated ? (
                <PillLink iconRight="arrowRight" to="/dashboard" variant="paper">
                  Open your dashboard
                </PillLink>
              ) : (
                <>
                  <PillLink iconRight="arrowRight" to="/register" variant="paper">
                    Create a free account
                  </PillLink>
                  <Link className="pill pill-on-ink" to="/login">
                    I already have an account
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
