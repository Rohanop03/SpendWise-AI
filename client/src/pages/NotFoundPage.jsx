import { useAuth } from '../auth/useAuth.js';
import Seo from '../seo/Seo.jsx';
import { PillLink } from '../ui/Pill.jsx';

/** A raised button pressed flat into its well: nothing to press here. */
function PressedButtonIllustration() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-36 w-56">
      <div className="neu-pressed absolute inset-0 rounded-[2.2rem]" />
      <div className="neu-pressed absolute inset-x-8 inset-y-9 rounded-full" />
      <div className="pill-ink absolute inset-x-12 inset-y-[3.25rem] rounded-full opacity-90" />
      <span className="num absolute -right-3 -top-3 rounded-full bg-(--ink) px-2.5 py-1 text-[11px] text-(--paper)">
        404
      </span>
    </div>
  );
}

function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  return (
    <section className="grid min-h-[68dvh] place-items-center px-5 py-20 text-center">
      <Seo noindex title="Page not found" />
      <div className="glass max-w-xl rounded-(--radius-panel) px-6 py-12 sm:px-12">
        <PressedButtonIllustration />
        <p className="eyebrow mt-10">404 · Not found</p>
        <h1 className="mt-3 text-[clamp(2rem,1.5rem+2vw,3rem)]">Nothing renews here.</h1>
        <p className="mx-auto mt-4 max-w-md leading-7 text-(--graphite)">
          This page is not part of SpendWise AI. The link may be old or mistyped.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <PillLink icon="arrowLeft" to="/" variant="ink">
            Return home
          </PillLink>
          {isAuthenticated && <PillLink to="/dashboard">Open dashboard</PillLink>}
        </div>
      </div>
    </section>
  );
}

export default NotFoundPage;
