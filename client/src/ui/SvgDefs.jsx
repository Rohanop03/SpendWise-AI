import { patternFor } from './patterns.js';

/*
 * Shared SVG definitions, rendered once at the app root:
 *  - six greyscale category patterns (charts never use hue),
 *  - the liquid-chrome turbulence filter for obsidian cards,
 *  - the chrome gradient used by blobs, sheens and the renewal dial.
 */

/** Small legend swatch showing the pattern used for a series. */
export function PatternSwatch({ index, className = 'size-4' }) {
  const pattern = patternFor(index);
  return (
    <svg aria-hidden="true" className={`shrink-0 rounded-[4px] ${className}`} viewBox="0 0 16 16">
      <rect
        fill={pattern.fill}
        height="15"
        rx="3"
        stroke="#0B0B0D"
        strokeWidth="1"
        width="15"
        x="0.5"
        y="0.5"
      />
    </svg>
  );
}

export default function SvgDefs() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute size-0 overflow-hidden"
      focusable="false"
    >
      <defs>
        <pattern height="6" id="pat-solid" patternUnits="userSpaceOnUse" width="6">
          <rect fill="#0B0B0D" height="6" width="6" />
        </pattern>
        <pattern height="6" id="pat-60" patternUnits="userSpaceOnUse" width="6">
          <rect fill="#5E5E66" height="6" width="6" />
        </pattern>
        <pattern height="6" id="pat-30" patternUnits="userSpaceOnUse" width="6">
          <rect fill="#B3B3BB" height="6" width="6" />
        </pattern>
        <pattern
          height="7"
          id="pat-hatch"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
          width="7"
        >
          <rect fill="#EFEFF2" height="7" width="7" />
          <rect fill="#0B0B0D" height="7" width="2.6" />
        </pattern>
        <pattern height="6" id="pat-dots" patternUnits="userSpaceOnUse" width="6">
          <rect fill="#EFEFF2" height="6" width="6" />
          <circle cx="3" cy="3" fill="#0B0B0D" r="1.35" />
        </pattern>
        <pattern height="6" id="pat-outline" patternUnits="userSpaceOnUse" width="6">
          <rect fill="#F7F7F9" height="6" width="6" />
        </pattern>

        <linearGradient id="chrome-swirl" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor="#D9D9DE" />
          <stop offset="62%" stopColor="#9A9AA3" />
          <stop offset="100%" stopColor="#2A2A2F" />
        </linearGradient>

        <radialGradient id="chrome-bead" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#E6E6EA" />
          <stop offset="100%" stopColor="#9A9AA3" />
        </radialGradient>

        <filter height="160%" id="liquid-chrome" width="160%" x="-30%" y="-30%">
          <feTurbulence
            baseFrequency="0.012 0.02"
            numOctaves="2"
            result="noise"
            seed="7"
            type="fractalNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="60"
            xChannelSelector="R"
            yChannelSelector="G"
          />
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
    </svg>
  );
}
