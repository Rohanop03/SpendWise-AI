import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import ApiStatus from '../components/ApiStatus.jsx';
import { BrandGlyph } from '../layout/BrandMark.jsx';
import { landingJsonLd, publicPages } from '../seo/meta.js';
import Seo from '../seo/Seo.jsx';
import Icon from '../ui/Icon.jsx';
import { prefersReducedMotion, whenIdle } from '../ui/motion.js';
import { PillLink } from '../ui/Pill.jsx';
import { ChromeSheen } from '../ui/Surface.jsx';
import { useSmoothScroll } from '../ui/useSmoothScroll.js';

const heroPoints = [
  'See renewals before they charge',
  'Spot subscriptions you stopped using',
  'One monthly total, per currency',
];

// What it does for you, paired with the feature that delivers it.
const benefits = [
  {
    body: 'Every renewal date sits on one timeline, and reminders arrive inside the lead time you choose — so annual plans and trials never surprise you.',
    feature: 'Renewal timeline & reminders',
    icon: 'calendar',
    title: 'No more surprise charges',
  },
  {
    body: 'Tap “Mark as used” when you use a service. Anything idle for more than 60 days is flagged as a cancel candidate, with what you would save.',
    feature: 'Usage tracking',
    icon: 'pause',
    title: 'Stop paying for what you forgot',
  },
  {
    body: 'Two streaming plans or two cloud drives? Duplicate categories and plans priced above similar ones are surfaced automatically.',
    feature: 'Smart suggestions',
    icon: 'spark',
    title: 'Cut the overlap',
  },
  {
    body: 'Monthly and yearly plans are converted to one comparable monthly figure, and spending is broken down by month, year and category.',
    feature: 'Spending analytics',
    icon: 'chart',
    title: 'Know your real monthly cost',
  },
];

const features = [
  [
    'Add any service',
    'Pick from popular services or type your own, with cost, cycle and category.',
  ],
  ['Record payments', 'Log what you paid; the next renewal date moves forward by itself.'],
  ['Cancel cleanly', 'Mark a subscription cancelled and record its final payment in one step.'],
  ['Full history', 'Every payment and every change to cost, cycle or status, kept for you.'],
  ['Any currency', 'Each currency is totalled separately — nothing is silently converted.'],
  ['Works everywhere', 'Phone, tablet or desktop, with keyboard shortcuts on larger screens.'],
];

// Verifiable facts about the product — no invented customers or ratings.
const trust = [
  [
    'Your data stays yours',
    'Each account only ever sees its own records; every request is checked.',
  ],
  ['Passwords never stored', 'Only a one-way hash is kept, so nobody can read your password.'],
  [
    'No bank connection',
    'You enter what you want to track. No card, bank or inbox access is needed.',
  ],
  [
    'Tested on every change',
    'Hundreds of automated checks cover the database, the API and every screen.',
  ],
];

const faqs = [
  [
    'Is SpendWise AI free?',
    'Yes. It is a university DBMS project and free to use — there is no paid tier.',
  ],
  [
    'Does it cancel subscriptions for me?',
    'No. SpendWise AI tells you what to review and what you could save; you cancel with the provider yourself, then mark it cancelled here.',
  ],
  [
    'Do I have to connect my bank or card?',
    'Never. You add subscriptions and payments yourself, so nothing is read from your accounts.',
  ],
  [
    'How are “potential savings” worked out?',
    'From your own records: the monthly cost of an unused or duplicate subscription, or how far a plan sits above similar plans. They are estimates, not guarantees.',
  ],
  [
    'Which currencies are supported?',
    'Any 3-letter currency code. Totals are kept per currency and never mixed.',
  ],
];

/** Scroll reveals for sections below the fold (GSAP loads when the browser is idle). */
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

function PrimaryActions({ isAuthenticated, onInk = false }) {
  if (isAuthenticated) {
    return (
      <PillLink iconRight="arrowRight" to="/dashboard" variant={onInk ? 'paper' : 'ink'}>
        Go to Dashboard
      </PillLink>
    );
  }
  return (
    <>
      <PillLink iconRight="arrowRight" to="/register" variant={onInk ? 'paper' : 'ink'}>
        Get started — it’s free
      </PillLink>
      <Link className={onInk ? 'pill pill-on-ink' : 'pill pill-ghost'} to="/how-it-works">
        See how it works
      </Link>
    </>
  );
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

      {/* Hero */}
      <section
        aria-labelledby="hero-title"
        className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-8 lg:px-10 lg:pt-16"
      >
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="neu-raised relative overflow-hidden rounded-(--radius-panel) p-6 sm:p-10 lg:col-span-7">
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
                className="mt-4 max-w-2xl text-[clamp(2.4rem,1.6rem+4vw,4.4rem)] leading-[1.04]"
                id="hero-title"
              >
                Stop paying for subscriptions you <em className="script">forgot</em> about
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-(--graphite)">
                Track every recurring charge in one place, see each renewal coming, and get clear
                suggestions on what to cancel — with the exact amount you would save.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <PrimaryActions isAuthenticated={isAuthenticated} />
              </div>
              <ul className="mt-8 flex flex-wrap gap-2" aria-label="Highlights">
                {heroPoints.map((point) => (
                  <li
                    className="neu-raised depth-1 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-bold"
                    key={point}
                  >
                    <Icon className="size-4 shrink-0" name="check" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Product preview: what a suggestion looks like inside the app. */}
          <div className="grid gap-5 lg:col-span-5">
            <article
              aria-labelledby="example-title"
              className="obsidian rounded-(--radius-panel) p-6 sm:p-8"
            >
              <ChromeSheen />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold">
                  In the app
                </span>
                <span className="eyebrow !text-(--on-ink-soft)">Smart suggestion</span>
              </div>
              <p className="eyebrow mt-6 !text-(--on-ink-soft)">Unused subscription</p>
              <h2 className="mt-2 text-2xl" id="example-title">
                Cancel City Gym — unused for 74 days
              </h2>
              <p className="display-num mt-4 text-5xl">₹1,499</p>
              <p className="mt-1 text-sm font-bold">you would save every month</p>
              <p className="mt-4 text-sm leading-6 text-soft">
                Example values. Your suggestions are worked out from your own subscriptions.
              </p>
            </article>
            <div className="glass rounded-(--radius-panel) p-6">
              <p className="eyebrow">Next renewals</p>
              <ul className="mt-4 space-y-3 text-sm">
                {[
                  ['Netflix', 'in 3 days', '₹649'],
                  ['Home Broadband', 'in 9 days', '₹999'],
                  ['Microsoft 365', 'in 4 months', '₹6,199 / yr'],
                ].map(([name, when, amount]) => (
                  <li className="flex items-center justify-between gap-3" key={name}>
                    <span className="min-w-0">
                      <span className="block font-bold">{name}</span>
                      <span className="text-xs text-(--graphite)">{when}</span>
                    </span>
                    <span className="num shrink-0">{amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section
        aria-labelledby="benefits-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <p className="eyebrow" data-reveal>
          Why SpendWise
        </p>
        <h2
          className="mt-3 max-w-3xl text-[clamp(1.9rem,1.4rem+2vw,3rem)]"
          data-reveal
          id="benefits-title"
        >
          Subscriptions add up quietly. SpendWise makes them <em className="script">visible</em>.
        </h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <li
              className="neu-raised flex flex-col rounded-(--radius-card) p-6"
              data-reveal
              key={benefit.title}
            >
              <span
                aria-hidden="true"
                className="neu-pressed grid size-14 place-items-center rounded-2xl"
              >
                <Icon className="size-6" name={benefit.icon} />
              </span>
              <h3 className="mt-6 text-lg">{benefit.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-(--graphite)">{benefit.body}</p>
              <p className="eyebrow mt-5">{benefit.feature}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section
        aria-labelledby="features-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow" data-reveal>
              Everything in one place
            </p>
            <h2
              className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,3rem)]"
              data-reveal
              id="features-title"
            >
              What you can <em className="script">do</em>
            </h2>
          </div>
          <Link className="pill pill-ghost" data-reveal to="/how-it-works">
            How it works <Icon className="size-4" name="arrowRight" />
          </Link>
        </div>
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

      {/* Trust */}
      <section
        aria-labelledby="trust-title"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-8 lg:px-10"
      >
        <div className="neu-pressed rounded-(--radius-panel) p-6 sm:p-10" data-reveal>
          <p className="eyebrow">Built to be trusted</p>
          <h2 className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,3rem)]" id="trust-title">
            Private, careful and <em className="script">transparent</em>
          </h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trust.map(([term, detail]) => (
              <div className="neu-raised depth-2 rounded-2xl p-5" key={term}>
                <dt className="font-bold">{term}</dt>
                <dd className="mt-1.5 text-sm leading-6 text-(--graphite)">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-title" className="mx-auto max-w-4xl px-4 py-16 sm:px-8">
        <p className="eyebrow" data-reveal>
          Questions
        </p>
        <h2 className="mt-3 text-[clamp(1.9rem,1.4rem+2vw,3rem)]" data-reveal id="faq-title">
          Frequently asked
        </h2>
        <div className="mt-8 space-y-3">
          {faqs.map(([question, answer]) => (
            <details className="neu-raised group rounded-2xl p-5" data-reveal key={question}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                <span>{question}</span>
                <Icon
                  className="size-4 shrink-0 transition-transform group-open:rotate-180"
                  name="chevronDown"
                />
              </summary>
              <p className="mt-3 text-sm leading-6 text-(--graphite)">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section
        aria-labelledby="cta-title"
        className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-8 lg:px-10"
      >
        <div
          className="obsidian flex flex-col justify-between gap-8 rounded-(--radius-panel) p-6 sm:p-10"
          data-reveal
        >
          <ChromeSheen />
          <div className="flex items-center gap-4">
            <BrandGlyph className="size-12 shrink-0" />
            <h2 className="text-2xl font-bold sm:text-3xl" id="cta-title">
              See every renewal <em className="script">before</em> it charges.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryActions isAuthenticated={isAuthenticated} onInk />
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
