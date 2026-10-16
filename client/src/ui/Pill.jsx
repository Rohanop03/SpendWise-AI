import { motion } from 'framer-motion';
import { forwardRef } from 'react';
import { Link } from 'react-router-dom';

import Icon from './Icon.jsx';
import { pressSpring } from './motion.js';

const MotionLink = motion.create(Link);

const variants = {
  ghost: 'pill-ghost',
  ink: 'pill-ink',
  onInk: 'pill-on-ink',
  outline: 'pill-outline',
  paper: 'pill-paper',
  raised: 'neu-press',
};

function classes({ className = '', size, variant = 'raised' }) {
  return ['pill', variants[variant], size === 'sm' ? 'pill-sm' : '', className].join(' ').trim();
}

function Content({ children, icon, iconRight }) {
  return (
    <>
      {icon && <Icon className="size-[1.1em] shrink-0" name={icon} />}
      {children}
      {iconRight && <Icon className="size-[1.1em] shrink-0" name={iconRight} />}
    </>
  );
}

/**
 * Pill button. Raised by default; presses inward on pointer-down (CSS `--press`) and
 * springs back on release (Framer Motion transform spring).
 */
export const Pill = forwardRef(function Pill(
  { children, className, icon, iconRight, size, type = 'button', variant, ...props },
  ref,
) {
  return (
    <motion.button
      className={classes({ className, size, variant })}
      ref={ref}
      transition={pressSpring}
      type={type}
      whileTap={props.disabled ? undefined : { scale: 0.97 }}
      {...props}
    >
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </motion.button>
  );
});

export const PillLink = forwardRef(function PillLink(
  { children, className, icon, iconRight, size, variant, ...props },
  ref,
) {
  return (
    <MotionLink
      className={classes({ className, size, variant })}
      ref={ref}
      transition={pressSpring}
      whileTap={{ scale: 0.97 }}
      {...props}
    >
      <Content icon={icon} iconRight={iconRight}>
        {children}
      </Content>
    </MotionLink>
  );
});

/** Circular icon-only control with a required accessible name. */
export const IconButton = forwardRef(function IconButton(
  { className = '', icon, label, variant = 'raised', ...props },
  ref,
) {
  return (
    <motion.button
      aria-label={label}
      className={`pill ${variants[variant]} size-11 !p-0 ${className}`}
      ref={ref}
      title={label}
      transition={pressSpring}
      type="button"
      whileTap={{ scale: 0.94 }}
      {...props}
    >
      <Icon name={icon} />
    </motion.button>
  );
});

/** Inline text link with an arrow, used for "see more" style navigation. */
export function TextLink({ children, className = '', ...props }) {
  return (
    <Link
      className={`group inline-flex items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline ${className}`}
      {...props}
    >
      {children}
      <Icon className="size-4 transition-transform group-hover:translate-x-0.5" name="arrowRight" />
    </Link>
  );
}

/** "← Back to …" link used above detail and form pages. */
export function BackLink({ children, className = '', ...props }) {
  return (
    <Link
      className={`group mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline ${className}`}
      {...props}
    >
      <Icon className="size-4 transition-transform group-hover:-translate-x-0.5" name="arrowLeft" />
      {children}
    </Link>
  );
}
