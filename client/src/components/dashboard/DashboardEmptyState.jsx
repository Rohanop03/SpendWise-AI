import { Link } from 'react-router-dom';

export default function DashboardEmptyState() {
  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/5 p-7 text-center sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Start here</p>
      <h2 className="mt-3 text-2xl font-black text-white">Build your subscription picture</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        Add your first subscription to see current recurring commitments and renewal dates. Spending
        charts remain empty until you explicitly record completed payments—SpendWise never invents
        transactions.
      </p>
      <Link
        className="mt-6 inline-flex rounded-xl bg-emerald-300 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-200"
        to="/subscriptions/new"
      >
        Add first subscription
      </Link>
    </section>
  );
}
