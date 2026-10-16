import { useEffect, useRef, useState } from 'react';

/** Width of an element via ResizeObserver (falls back to `fallback` where unavailable). */
export function useElementWidth(fallback = 640) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width) || fallback);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fallback]);
  return [ref, width];
}
