import { Link } from 'react-router-dom';

import { useAuth } from '../auth/useAuth.js';
import { publicPages } from '../seo/meta.js';
import Seo from '../seo/Seo.jsx';
import Icon from '../ui/Icon.jsx';
import { PillLink } from '../ui/Pill.jsx';
import { ChromeSheen } from '../ui/Surface.jsx';

const steps = [
  {
    body: 'Create a free account and add each subscription: the service, what it costs, whether it bills monthly or yearly, and when it next renews.',
    icon: 'stack',
    title: 'Add your subscriptions',
  },
  {
    body: 'When you pay, record it. The next renewal date moves forward on its own — one month or one year — even for tricky dates like the 31st.',
    icon: 'receipt',
    title: 'Record your payments',
  },
  {
    body: 'Your dashboard shows what renews in the next 30 days, and reminders arrive ahead of each charge, on the schedule you pick.',
    icon: 'bell',
    title: 'Get reminded in time',
  },
  {
    body: 'Press “Analyze” and SpendWise points out what to review, explains why, and shows how much you could save each month.',
    icon: 'spark',
    title: 'Act on clear suggestions',
  },
];

// The system, explained without jargon. Each card maps to a real part of the design.
const behindTheScenes = [
  {
    body: 'The moment a payment is saved, the database itself moves that subscription’s renewal date forward. It happens in the same instant, so the date can never be forgotten or go stale.',
    icon: 'calendar',
    title: 'Renewal dates that update themselves',
  },
  {
    body: 'Upcoming renewals are worked out fresh from your data every time you look, so the list is always current and nothing is stored twice.',
    icon: 'bell',
    title: 'Reminders that are always up to date',
  },
  {
    body: 'A ready-made summary adds up what you paid per category for every month. Your charts and totals all read from the same summary, so the numbers always agree.',
    icon: 'chart',
    title: 'One source for every total',
  },
  {
    body: 'Three plain rules run inside the database: a subscription unused for over 60 days, one that costs more than similar plans, or two in the same category. Running them again never creates duplicates, and anything you dismissed stays dismissed.',
    icon: 'spark',
    title: 'Suggestions with simple rules',
  },
  {
    body: 'Whenever a cost, billing cycle, status or renewal date changes, a record of the old and new value is written automatically — that is the history you see on each subscription.',
    icon: 'undo',
    title: 'A history you don’t have to keep',
  },
  {
    body: 'Cancelling with a final payment is saved as one action: either both are recorded, or — if anything goes wrong — neither is. You never end up half-cancelled.',
    icon: 'check',
    title: 'All-or-nothing actions',
  },
  {
    body: 'Like the index at the back of a book, lookups jump straight to your records instead of reading everything, so pages stay fast as your history grows.',
    icon: 'search',
    title: 'Fast, even with years of data',
  },
  {
    body: 'Every request is tied to your account and checked before anything is read or changed. Passwords are stored only as a one-way fingerprint that cannot be reversed.',
    icon: 'user',
    title: 'Private to you',
  },
];

const flow = [
  ['You', 'Add a subscription or record a payment in the app.', 'user'],
  ['SpendWise server', 'Checks who you are and that the details make sense.', 'settings'],
  [
    'Database',
    'Saves it, updates renewal dates, keeps history and works out suggestions.',
    'stack',
  ],
];

const faqs = [
  [
    'How long does it take to set up?',
    'A few minutes. Add your main subscriptions first; you can record past payments whenever you like.',
  ],
  [
    'Is my information secure?',
    'Your records are visible only to your account, every request is verified, and your password is never stored in readable form.',
  ],
  [
    'Will suggestions change on their own?',
    'Only when your data changes. Run the analysis again any time — you get the same results for the same data, and what you dismissed stays dismissed.',
  ],
  [
    'What if I record a payment late?',
    'The renewal date still lands on the next date after the payment, so a late entry never leaves it in the past.',
  ],
  ['Does it cost anything?', 'No. SpendWise AI is free to use.'],
];

function HowItWorksPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      <Seo
        description={publicPages['/how-it-works'].description}
        path="/how-it-works"
        title={publicPages['/how-it-works'].title}
      />

      {/* Introduction */}
      <section
        aria-labelledby="how-title"
        className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-8 lg:px-10 lg:pt-16"
      >
        <div className="neu-raised rounded-(--radius-panel) p-6 sm:p-10">
          <p className="eyebrow">How it works</p>
          <h1
            className="mt-4 max-w-3xl text-[clamp(2.3rem,1.6rem+3.4vw,4rem)] leading-[1.05]"
            id="how-title"
          >
            From scattered charges to one <em className="script">clear</em> picture
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-(--graphite)">
            SpendWise AI keeps every subscription, payment and renewal in one place, keeps the dates
            right for you, and tells you where money is leaking — in four simple steps.
          </p>
        </div>
      </section>

      {/* Steps */}
      <section
        aria-labelledby="steps-title"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-10"
      >
        <h2 className="text-[clamp(1.8rem,1.4rem+1.8vw,2.6rem)]" id="steps-title">
          Four <em className="script">simple</em> steps
        </h2>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li
              className={`${index === 3 ? 'obsidian' : 'neu-raised'} relative flex flex-col rounded-(--radius-card) p-6`}
              key={step.title}
            >
              {index === 3 && <ChromeSheen />}
              <div className="flex items-center justify-between">
                <span className="num text-sm">{String(index + 1).padStart(2, '0')}</span>
                <span
                  aria-hidden="true"
                  className={`grid size-12 place-items-center rounded-2xl ${index === 3 ? 'border border-white/25' : 'neu-pressed'}`}
                >
                  <Icon className="size-5" name={step.icon} />
                </span>
              </div>
              <h3 className="mt-8 text-xl">{step.title}</h3>
              <p
                className={`mt-2 text-sm leading-6 ${index === 3 ? 'text-soft' : 'text-(--graphite)'}`}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* How the pieces fit */}
      <section
        aria-labelledby="flow-title"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-10"
      >
        <div className="glass rounded-(--radius-panel) p-6 sm:p-10">
          <h2 className="text-[clamp(1.8rem,1.4rem+1.8vw,2.6rem)]" id="flow-title">
            How the pieces fit together
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-(--graphite)">
            Three parts work together every time you tap a button.
          </p>
          <ol className="mt-8 grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {flow.map(([title, body, icon], index) => (
              <li className="contents" key={title}>
                <div className="neu-raised flex flex-col rounded-2xl p-5">
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="neu-pressed grid size-10 shrink-0 place-items-center rounded-xl"
                    >
                      <Icon className="size-5" name={icon} />
                    </span>
                    <span className="font-bold">{title}</span>
                  </span>
                  <p className="mt-3 text-sm leading-6 text-(--graphite)">{body}</p>
                </div>
                {index < flow.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="grid place-items-center text-(--graphite) md:px-1"
                  >
                    <Icon className="size-5 rotate-90 md:rotate-0" name="arrowRight" />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Behind the scenes */}
      <section
        aria-labelledby="scenes-title"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:px-10"
      >
        <p className="eyebrow">Behind the scenes</p>
        <h2 className="mt-3 text-[clamp(1.8rem,1.4rem+1.8vw,2.6rem)]" id="scenes-title">
          The <em className="script">quiet</em> work that keeps it right
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-(--graphite)">
          Most of the hard work happens inside the database, the moment your data changes — so the
          numbers you see are always consistent, whichever page you open.
        </p>
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {behindTheScenes.map((item) => (
            <li className="neu-raised flex gap-4 rounded-(--radius-card) p-6" key={item.title}>
              <span
                aria-hidden="true"
                className="neu-pressed grid size-12 shrink-0 place-items-center rounded-2xl"
              >
                <Icon className="size-5" name={item.icon} />
              </span>
              <div className="min-w-0">
                <h3 className="text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-(--graphite)">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section aria-labelledby="hiw-faq-title" className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
        <h2 className="text-[clamp(1.8rem,1.4rem+1.8vw,2.6rem)]" id="hiw-faq-title">
          Common questions
        </h2>
        <div className="mt-6 space-y-3">
          {faqs.map(([question, answer]) => (
            <details className="neu-raised group rounded-2xl p-5" key={question}>
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

      {/* Next step */}
      <section
        aria-labelledby="hiw-cta-title"
        className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-8 lg:px-10"
      >
        <div className="obsidian flex flex-col gap-6 rounded-(--radius-panel) p-6 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <ChromeSheen />
          <h2 className="text-2xl font-bold sm:text-3xl" id="hiw-cta-title">
            Ready to see your <em className="script">real</em> monthly cost?
          </h2>
          <div className="flex flex-wrap gap-3">
            {isAuthenticated ? (
              <PillLink iconRight="arrowRight" to="/dashboard" variant="paper">
                Go to Dashboard
              </PillLink>
            ) : (
              <>
                <PillLink iconRight="arrowRight" to="/register" variant="paper">
                  Create your free account
                </PillLink>
                <Link className="pill pill-on-ink" to="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default HowItWorksPage;
