import ApiStatus from '../components/ApiStatus.jsx';

const plannedCapabilities = [
  {
    description:
      'Keep recurring services, billing cycles, and renewal dates organized in one place.',
    eyebrow: 'Planned · Stage 5',
    title: 'Subscription tracking',
  },
  {
    description: 'Turn recorded subscription and payment data into clear, currency-aware insights.',
    eyebrow: 'Planned · Stages 6–8',
    title: 'Spending clarity',
  },
  {
    description:
      'Surface explainable opportunities based on deterministic rules and real stored data.',
    eyebrow: 'Planned · Stage 10',
    title: 'Cost optimization',
  },
];

function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_22%,rgba(52,211,153,0.16),transparent_30%),radial-gradient(circle_at_82%_28%,rgba(34,211,238,0.13),transparent_27%),linear-gradient(to_bottom,#07111f,#020617)]" />
        <div className="mx-auto grid min-h-[670px] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-28">
          <div>
            <div className="mb-8">
              <ApiStatus />
            </div>
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
              A clearer view of recurring costs
            </p>
            <h1 className="max-w-4xl text-5xl font-black tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Smart subscription tracking, built for better decisions.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              SpendWise AI is being built to organize subscriptions, clarify recurring spending, and
              deliver grounded cost-optimization suggestions without inventing financial data.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 text-sm font-semibold">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                React + Vite
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                Express REST API
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-slate-200">
                PostgreSQL-backed authentication
              </span>
            </div>
          </div>

          <aside className="relative rounded-[2rem] border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-black/30 backdrop-blur sm:p-9">
            <div className="absolute -right-6 -top-6 size-24 rounded-full bg-emerald-300/15 blur-2xl" />
            <p className="text-sm font-semibold text-emerald-300">Secure accounts implemented</p>
            <h2 className="mt-3 text-2xl font-bold text-white">
              Stage 4 protects the user experience from the first request.
            </h2>
            <div className="mt-7 space-y-5">
              {[
                'Registration and bcrypt password protection',
                'Short-lived JWT access tokens',
                'Rotating PostgreSQL-backed refresh sessions',
                'Protected profile and preference management',
              ].map((item, index) => (
                <div className="flex gap-4" key={item}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-sm font-bold text-emerald-200">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-6 text-slate-400">
              Subscription and financial workflows remain planned for their later roadmap stages.
            </p>
          </aside>
        </div>
      </section>

      <section className="bg-slate-100 text-slate-950" id="planned-capabilities">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
              Product roadmap
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              What the foundation is designed to support
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              These product capabilities remain planned for later development stages.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {plannedCapabilities.map((capability) => (
              <article
                className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm"
                key={capability.title}
              >
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  {capability.eyebrow}
                </p>
                <h3 className="mt-5 text-xl font-bold text-slate-950">{capability.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{capability.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
