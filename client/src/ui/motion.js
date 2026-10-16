import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export const easeOut = [0.22, 1, 0.36, 1];

/** Spring used for every press -> release interaction. */
export const pressSpring = { damping: 30, stiffness: 500, type: 'spring' };

/**
 * Props for a card that rises from flat into raised depth. Framer only animates on
 * mount, so re-renders never replay it. Returns nothing under reduced motion.
 */
export function useEntrance(delay = 0) {
  const reduce = useReducedMotion();
  if (reduce) return {};
  return {
    animate: { opacity: 1, y: 0 },
    initial: { opacity: 0, y: 14 },
    transition: { delay: Math.min(delay, 0.4), duration: 0.5, ease: easeOut },
  };
}

/** Animates a number toward `value` (count-up). Instant under reduced motion. */
export function useCountUp(value, { duration = 900 } = {}) {
  // No matchMedia (very old browsers, jsdom) is treated like reduced motion: show the value.
  const reduce =
    useReducedMotion() || typeof window === 'undefined' || typeof window.matchMedia !== 'function';
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (!Number.isFinite(value)) return undefined;
    if (reduce || !window.requestAnimationFrame) {
      from.current = value;
      return undefined;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(origin + (value - origin) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration, reduce, value]);

  return reduce ? value : display;
}

/** Run `callback` when the browser is idle (or after `timeout` ms). Returns a cancel fn. */
export function whenIdle(callback, timeout = 1200) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(callback, 300);
  return () => clearTimeout(id);
}

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}

export function useMediaQuery(query, fallback = false) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : fallback,
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener?.('change', update);
    return () => list.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}
