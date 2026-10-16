import { useEffect, useRef, useState } from 'react';

/**
 * Custom cursor for fine pointers: a small frosted disc that trails the pointer, presses
 * inward while the button is held, and shows a short label (from `data-cursor`) over
 * interactive rows. The system cursor is never hidden. Off on touch and reduced motion.
 */
export default function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState('');
  const disc = useRef(null);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const fine = window.matchMedia('(pointer: fine) and (hover: hover)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(fine.matches && !calm.matches);
    update();
    fine.addEventListener?.('change', update);
    calm.addEventListener?.('change', update);
    return () => {
      fine.removeEventListener?.('change', update);
      calm.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let x = -100;
    let y = -100;
    let cx = -100;
    let cy = -100;
    let pressed = false;
    let raf = 0;
    let lastLabel = '';

    const tick = () => {
      cx += (x - cx) * 0.28;
      cy += (y - cy) * 0.28;
      if (disc.current) {
        disc.current.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${pressed ? 0.78 : 1})`;
      }
      raf = requestAnimationFrame(tick);
    };

    const onMove = (event) => {
      x = event.clientX;
      y = event.clientY;
      const target = event.target instanceof Element ? event.target : null;
      const overText = target?.closest('input, textarea, select, [contenteditable="true"]');
      const tagged = overText ? null : target?.closest('[data-cursor]');
      const next = tagged?.getAttribute('data-cursor') || '';
      if (disc.current) disc.current.style.opacity = overText ? '0' : '1';
      if (next !== lastLabel) {
        lastLabel = next;
        setLabel(next);
      }
    };
    const onDown = () => {
      pressed = true;
    };
    const onUp = () => {
      pressed = false;
    };
    const onLeave = () => {
      if (disc.current) disc.current.style.opacity = '0';
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      aria-hidden="true"
      className={`glass glass-solid pointer-events-none fixed left-0 top-0 z-[90] grid place-items-center rounded-full transition-[width,height,opacity] duration-200 ${
        label ? 'h-12 w-12' : 'h-5 w-5'
      }`}
      ref={disc}
      style={{ opacity: 0, willChange: 'transform' }}
    >
      {label && <span className="num text-[9px] font-medium tracking-wider">{label}</span>}
    </div>
  );
}
