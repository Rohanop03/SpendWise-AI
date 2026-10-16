import { motion, useReducedMotion } from 'framer-motion';

import { BrandGlyph } from '../layout/BrandMark.jsx';

/** Centered glass card floating over the chrome blob field. */
function AuthCard({ children, description, footer, title }) {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto flex w-full max-w-[29rem] flex-col px-4 py-12 sm:py-20">
      <motion.div
        animate={{ y: 0 }}
        className="glass rounded-(--radius-panel) p-6 sm:p-9"
        initial={reduce ? false : { y: 12 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <BrandGlyph className="size-12" />
        <h1 className="mt-6 text-[clamp(1.9rem,1.5rem+1.4vw,2.4rem)]">{title}</h1>
        <p className="mt-3 leading-7 text-(--graphite)">{description}</p>
        <div className="mt-8">{children}</div>
      </motion.div>
      {footer && <div className="mt-6 text-center text-sm text-(--graphite)">{footer}</div>}
    </section>
  );
}

export default AuthCard;
