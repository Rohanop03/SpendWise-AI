import { useEffect } from 'react';

import { prefersReducedMotion, whenIdle } from './motion.js';

/**
 * Lenis smooth scrolling for long pages (landing, reports). Loaded at idle; disabled under
 * reduced motion. Anchor links keep working (`anchors: true`) and keyboard scrolling is
 * left to the browser.
 */
export function useSmoothScroll(enabled = true) {
  useEffect(() => {
    if (!enabled || prefersReducedMotion() || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    let lenis;
    let raf = 0;
    let cancelled = false;
    const cancelIdle = whenIdle(() =>
      import('lenis').then(({ default: Lenis }) => {
        if (cancelled) return;
        lenis = new Lenis({ anchors: true, lerp: 0.12, smoothWheel: true });
        window.__lenis = lenis;
        const loop = (time) => {
          lenis.raf(time);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      }),
    );
    return () => {
      cancelled = true;
      cancelIdle();
      cancelAnimationFrame(raf);
      lenis?.destroy();
      if (window.__lenis === lenis) delete window.__lenis;
    };
  }, [enabled]);
}
