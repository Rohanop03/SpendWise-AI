function AuthCard({ children, description, title }) {
  return (
    <section className="mx-auto w-full max-w-lg px-5 py-16 sm:py-24">
      <div className="rounded-3xl border border-white/10 bg-white/[0.055] p-7 shadow-2xl shadow-black/30 sm:p-9">
        <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
        <p className="mt-3 leading-7 text-slate-400">{description}</p>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export default AuthCard;
