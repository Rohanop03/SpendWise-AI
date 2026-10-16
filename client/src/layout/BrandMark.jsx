/** The pressed-pill glyph: an obsidian capsule resting in a pressed well. */
export function BrandGlyph({ className = 'size-10' }) {
  return (
    <span
      aria-hidden="true"
      className={`neu-pressed depth-1 grid shrink-0 place-items-center rounded-[38%] ${className}`}
    >
      <span className="pill-ink block h-[42%] w-[64%] rounded-full" />
    </span>
  );
}

export default function BrandMark({ compact = false, subtitle = 'Subscription clarity' }) {
  return (
    <span className="flex items-center gap-3">
      <BrandGlyph />
      {!compact && (
        <span className="leading-tight max-[359px]:sr-only">
          <span className="block text-base font-bold tracking-[-0.02em]">SpendWise AI</span>
          {subtitle && (
            <span className="hidden text-[0.7rem] text-(--graphite) sm:block">{subtitle}</span>
          )}
        </span>
      )}
    </span>
  );
}
