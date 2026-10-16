import { useEffect, useState } from 'react';

/*
 * Soft chrome blobs behind the console. Each blob is a soft radial-gradient layer that
 * drifts on the compositor (transform only, `will-change`), so it never forces repaints.
 * Drift pauses while the tab is hidden and is static under reduced motion.
 */
const blobs = [
  {
    animation: 'drift-a 38s ease-in-out infinite',
    background:
      'radial-gradient(closest-side at 40% 38%, #ffffff 0%, #d4d4da 48%, rgb(142 142 151 / 55%) 72%, transparent 100%)',
    className: '-left-[12vw] -top-[14vh] h-[62vh] w-[52vw] min-w-[22rem]',
  },
  {
    animation: 'drift-b 44s ease-in-out infinite',
    background:
      'radial-gradient(closest-side at 58% 42%, #f6f6f8 0%, #babac2 52%, rgb(110 110 119 / 45%) 76%, transparent 100%)',
    className: '-bottom-[18vh] -right-[10vw] h-[70vh] w-[56vw] min-w-[24rem]',
  },
  {
    animation: 'drift-c 52s ease-in-out infinite',
    background: 'radial-gradient(closest-side, #ffffff 0%, #cfcfd6 60%, transparent 100%)',
    className: '-right-[6vw] -top-[10vh] h-[40vh] w-[34vw] min-w-[16rem]',
  },
  {
    animation: 'drift-b 48s ease-in-out infinite reverse',
    background:
      'radial-gradient(closest-side, rgb(255 255 255 / 90%) 0%, rgb(199 199 206 / 70%) 60%, transparent 100%)',
    className: '-bottom-[12vh] left-[14vw] h-[38vh] w-[36vw] min-w-[16rem]',
  },
];

export default function BlobField() {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const update = () => setPaused(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {blobs.map((blob) => (
        <div
          className={`absolute rounded-full ${blob.className}`}
          key={blob.animation}
          style={{
            animation: blob.animation,
            animationPlayState: paused ? 'paused' : 'running',
            background: blob.background,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}
