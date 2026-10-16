import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { formatDate } from '../utils/dates.js';

/**
 * Shows a date; when `value` changes (e.g. after a re-fetch) the characters flip in.
 * Purely presentational — the value always comes from the API.
 */
export default function FlipDate({ className = '', pattern = 'D MMM YYYY', value }) {
  const reduce = useReducedMotion();
  const text = value ? formatDate(value, pattern) : 'None';
  return (
    <span aria-live="polite" className={`num inline-flex [perspective:400px] ${className}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, rotateX: 0 }}
          className="inline-block"
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotateX: 90 }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -90 }}
          key={text}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
