import React from 'react';

/**
 * PharmaCare AI Official Brand Logo
 * Uses the exact logo graphic provided for the project:
 * - 3D dual-tone ribbon medical cross (emerald green to royal blue gradient)
 * - Central 4-point AI neural constellation with glowing core
 * - Authentic brand typography: PHARMACARE AI
 */
export const Logo = ({
  size = 'md',
  showText = true,
  variant = 'horizontal', // 'horizontal' | 'vertical' | 'full' | 'icon'
  className = '',
  onClick,
}) => {
  // Dimension presets in pixels
  const iconSizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 72,
    '2xl': 96,
    '3xl': 128,
  };

  const pxSize = typeof size === 'number' ? size : iconSizes[size] || 40;

  // Standalone Icon Mark using exact graphic
  if (variant === 'icon' || !showText) {
    return (
      <div
        className={`inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        <img
          src="/logo-mark.png"
          alt="PharmaCare AI"
          width={pxSize}
          height={pxSize}
          className="object-contain drop-shadow-sm shrink-0"
          style={{ width: `${pxSize}px`, height: `${pxSize}px` }}
          loading="eager"
        />
      </div>
    );
  }

  // Exact Full Vertical Logo Lockup
  if (variant === 'vertical' || variant === 'full') {
    const fullHeight = typeof size === 'number' ? size : pxSize * 1.5;
    return (
      <div
        className={`inline-flex flex-col items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
      >
        <img
          src="/logo-transparent.png"
          alt="PharmaCare AI"
          className="object-contain drop-shadow-sm max-w-full"
          style={{ maxHeight: `${fullHeight}px`, width: 'auto' }}
          loading="eager"
        />
      </div>
    );
  }

  // Horizontal variant (Ideal for app header & compact toolbars)
  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <img
        src="/logo-mark.png"
        alt="PharmaCare AI"
        width={pxSize}
        height={pxSize}
        className="object-contain drop-shadow-sm shrink-0"
        style={{ width: `${pxSize}px`, height: `${pxSize}px` }}
        loading="eager"
      />
      <div className="flex flex-col leading-none">
        <span className="font-headline-md font-extrabold tracking-tight text-[#4b391e] text-base">
          PHARMACARE
        </span>
        <span className="font-headline-sm font-bold tracking-[0.25em] text-[#80796b] text-[10.5px] mt-0.5">
          AI
        </span>
      </div>
    </div>
  );
};

export default Logo;
