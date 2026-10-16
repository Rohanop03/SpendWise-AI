import { motion } from 'framer-motion';
import { useId } from 'react';

import { pressSpring } from './motion.js';

/**
 * Pressed segmented control. A group of toggle buttons (`aria-pressed`) sitting in an
 * inset track; the selected option is an obsidian pill that slides between options.
 */
export default function Segmented({
  className = '',
  label,
  labelHidden = false,
  onChange,
  options,
  size = 'md',
  value,
}) {
  const layoutId = useId();
  const labelId = `${layoutId}-label`;
  return (
    <div className={`min-w-0 max-w-full ${className}`}>
      {label && (
        <p className={labelHidden ? 'sr-only' : 'eyebrow mb-2'} id={labelId}>
          {label}
        </p>
      )}
      <div
        aria-labelledby={label ? labelId : undefined}
        className="neu-pressed depth-1 no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-full p-1"
        role="group"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <motion.button
              aria-pressed={selected}
              className={`relative isolate shrink-0 rounded-full font-bold transition-colors ${
                size === 'sm' ? 'min-h-9 px-3 text-xs' : 'min-h-10 px-4 text-sm'
              } ${selected ? 'text-(--paper)' : 'text-(--graphite) hover:text-(--ink)'}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              transition={pressSpring}
              type="button"
              whileTap={{ scale: 0.95 }}
            >
              {selected && (
                <motion.span
                  aria-hidden="true"
                  className="pill-ink absolute inset-0 -z-10 rounded-full"
                  layoutId={layoutId}
                  transition={{ damping: 34, stiffness: 420, type: 'spring' }}
                />
              )}
              {option.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
