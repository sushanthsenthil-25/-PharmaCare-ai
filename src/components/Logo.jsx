import React from 'react';

/**
 * PharmaCare AI Official Brand Logo
 * High-fidelity vector SVG matching the authentic brand mark:
 * - Teal rounded medical cross with organic interlocking ribbon contours (#218c8d)
 * - Deep royal blue neural network / molecular AI lattice (#1a56bc)
 * - Modern dark espresso typography: PHARMACARE AI (#3a2617)
 */
export const Logo = ({
  size = 'md',
  showText = true,
  variant = 'horizontal', // 'horizontal' | 'vertical' | 'icon'
  className = '',
  onClick,
}) => {
  // Dimension presets
  const iconSizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
    '2xl': 96,
  };

  const pxSize = typeof size === 'number' ? size : iconSizes[size] || 40;

  // The authentic icon mark SVG
  const IconMark = () => (
    <svg
      viewBox="0 0 500 500"
      width={pxSize}
      height={pxSize}
      className="shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Single curved half of the medical cross */}
        <path
          id="cross-ribbon-half"
          d="
            M 232 72
            C 255 72, 276 84, 276 116
            C 276 146, 292 165, 322 165
            C 354 165, 374 186, 374 215
            C 374 244, 354 265, 322 265
            C 292 265, 276 284, 276 314
            C 276 346, 255 358, 232 358
            C 214 358, 202 344, 218 326
          "
        />
      </defs>

      {/* Outer Teal Ribbon Medical Cross with 180° Rotational Symmetry */}
      <g
        stroke="#1e898e"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Right & Top ribbon */}
        <use href="#cross-ribbon-half" />
        {/* Left & Bottom ribbon (exact 180° rotation) */}
        <use href="#cross-ribbon-half" transform="rotate(180, 250, 215)" />
      </g>

      {/* Inner AI Neural Network / Molecular Lattice (Royal Blue) */}
      <g
        stroke="#1a56bc"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="#1a56bc"
      >
        {/* Outer Facet Boundary Lines */}
        <line x1="250" y1="135" x2="295" y2="160" />
        <line x1="295" y1="160" x2="315" y2="215" />
        <line x1="315" y1="215" x2="295" y2="270" />
        <line x1="295" y1="270" x2="250" y2="295" />
        <line x1="250" y1="295" x2="205" y2="270" />
        <line x1="205" y1="270" x2="185" y2="215" />
        <line x1="185" y1="215" x2="205" y2="160" />
        <line x1="205" y1="160" x2="250" y2="135" />

        {/* Outer to Inner Struts */}
        <line x1="250" y1="135" x2="250" y2="175" />
        <line x1="295" y1="160" x2="280" y2="190" />
        <line x1="315" y1="215" x2="285" y2="215" />
        <line x1="295" y1="270" x2="280" y2="240" />
        <line x1="250" y1="295" x2="250" y2="255" />
        <line x1="205" y1="270" x2="220" y2="240" />
        <line x1="185" y1="215" x2="215" y2="215" />
        <line x1="205" y1="160" x2="220" y2="190" />

        {/* Inner Octagonal Ring Edges */}
        <line x1="250" y1="175" x2="280" y2="190" />
        <line x1="280" y1="190" x2="285" y2="215" />
        <line x1="285" y1="215" x2="280" y2="240" />
        <line x1="280" y1="240" x2="250" y2="255" />
        <line x1="250" y1="255" x2="220" y2="240" />
        <line x1="220" y1="240" x2="215" y2="215" />
        <line x1="215" y1="215" x2="220" y2="190" />
        <line x1="220" y1="190" x2="250" y2="175" />

        {/* Diagonal Cross-Bracing Across The Sphere */}
        <line x1="220" y1="190" x2="280" y2="240" strokeWidth="2.5" />
        <line x1="220" y1="240" x2="280" y2="190" strokeWidth="2.5" />
        <line x1="250" y1="175" x2="250" y2="255" strokeWidth="2.5" />
        <line x1="215" y1="215" x2="285" y2="215" strokeWidth="2.5" />

        {/* Central Hub Radiators */}
        <line x1="250" y1="215" x2="250" y2="175" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="280" y2="190" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="285" y2="215" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="280" y2="240" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="250" y2="255" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="220" y2="240" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="215" y2="215" strokeWidth="4.5" />
        <line x1="250" y1="215" x2="220" y2="190" strokeWidth="4.5" />

        {/* Nodes (Neural Circles) */}
        {/* Center Node */}
        <circle cx="250" cy="215" r="9.5" />

        {/* Inner Ring Nodes */}
        <circle cx="250" cy="175" r="6" />
        <circle cx="280" cy="190" r="6" />
        <circle cx="285" cy="215" r="6" />
        <circle cx="280" cy="240" r="6" />
        <circle cx="250" cy="255" r="6" />
        <circle cx="220" cy="240" r="6" />
        <circle cx="215" cy="215" r="6" />
        <circle cx="220" cy="190" r="6" />

        {/* Outer Ring Nodes */}
        <circle cx="250" cy="135" r="7" />
        <circle cx="295" cy="160" r="7" />
        <circle cx="315" cy="215" r="8" />
        <circle cx="295" cy="270" r="7" />
        <circle cx="250" cy="295" r="7" />
        <circle cx="205" cy="270" r="7" />
        <circle cx="185" cy="215" r="8" />
        <circle cx="205" cy="160" r="7" />
      </g>
    </svg>
  );

  if (variant === 'icon' || !showText) {
    return (
      <div
        className={`inline-flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        <IconMark />
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div
        className={`flex flex-col items-center text-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        <IconMark />
        <div className="flex flex-col items-center">
          <span className="font-headline-lg font-extrabold tracking-wider text-[#3a2617] text-lg leading-tight">
            PHARMACARE
          </span>
          <span className="font-headline-sm font-bold tracking-[0.25em] text-[#3a2617] text-sm leading-none mt-0.5">
            AI
          </span>
        </div>
      </div>
    );
  }

  // Horizontal variant (default for Header app bar)
  return (
    <div
      className={`inline-flex items-center gap-2.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <IconMark />
      <div className="flex flex-col leading-none">
        <span className="font-headline-md font-extrabold tracking-tight text-[#3a2617] text-base">
          PHARMACARE
        </span>
        <span className="font-headline-sm font-bold tracking-[0.2em] text-[#1e898e] text-[10px] mt-0.5">
          AI
        </span>
      </div>
    </div>
  );
};

export default Logo;
