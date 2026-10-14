import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <section className="grid min-h-[68vh] place-items-center px-5 py-20 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
          404 · Not found
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
          This route is not available.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-400">
          Only the SpendWise AI foundation is available in Stage 2. Future feature routes will be
          added in their planned stages.
        </p>
        <Link
          className="mt-9 inline-flex rounded-full bg-emerald-300 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
          to="/"
        >
          Return home
        </Link>
      </div>
    </section>
  );
}

export default NotFoundPage;
