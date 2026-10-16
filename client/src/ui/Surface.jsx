import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { useEntrance } from './motion.js';

const looks = {
  glass: 'glass',
  obsidian: 'obsidian',
  pressed: 'neu-pressed',
  raised: 'neu-raised',
};

/**
 * Card surface. `look` carries meaning: raised = at rest / actionable, pressed = committed,
 * glass = floating information, obsidian = needs attention.
 */
export function Card({
  animateIn = true,
  as = 'section',
  children,
  className = '',
  delay = 0,
  look = 'raised',
  padded = true,
  ...props
}) {
  const Component = motion[as] || motion.section;
  const entrance = useEntrance(delay);
  const motionProps = animateIn ? entrance : {};
  return (
    <Component
      className={`${looks[look]} min-w-0 rounded-(--radius-card) ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...motionProps}
      {...props}
    >
      {look === 'obsidian' && <ChromeSheen />}
      {children}
    </Component>
  );
}

/** Header row used inside cards: title + optional description + trailing action. */
export function CardHeader({ action, as: Heading = 'h2', description, eyebrow, title }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <Heading className="text-lg sm:text-xl">{title}</Heading>
        {description && (
          <p className="mt-1.5 max-w-prose text-sm leading-6 text-(--graphite) [.obsidian_&]:text-(--on-ink-soft)">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * Liquid-chrome highlight clipped inside obsidian cards. The turbulence filter (defined
 * once in <SvgDefs/>) is rasterised once; only the wrapper drifts, on the compositor.
 * The drift is CSS and stops under reduced motion.
 */
export function ChromeSheen() {
  // Decorative and costly to rasterise, so it mounts after first paint (never in the
  // prerendered HTML) and fades in.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setTimeout(() => setReady(true), 120));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-[30%] -top-[45%] -z-10 h-[120%] w-[75%] opacity-[0.22]"
      style={{
        animation: 'fade-in 600ms ease-out, drift-c 26s ease-in-out infinite',
        willChange: 'transform',
      }}
    >
      <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 400 400">
        <g filter="url(#liquid-chrome)">
          <ellipse cx="250" cy="150" fill="url(#chrome-swirl)" rx="150" ry="95" />
          <ellipse cx="170" cy="250" fill="url(#chrome-swirl)" opacity="0.6" rx="90" ry="40" />
        </g>
      </svg>
    </div>
  );
}
