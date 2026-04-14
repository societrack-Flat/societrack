import React from 'react';
import { Link } from 'react-router-dom';
import societrackLogo from '../assets/societrack-logo.png';

const VARIANTS = {
  light: {
    socie: 'text-[#0a223d]',
    track: 'text-[#84cc16]',
    tagLeft: 'text-[#0a223d]',
    tagRight: 'text-[#84cc16]',
    img: 'rounded-lg bg-white object-contain p-1',
  },
  dark: {
    socie: 'text-[#0a223d]',
    track: 'text-[#84cc16]',
    tagLeft: 'text-[#0a223d]',
    tagRight: 'text-[#84cc16]',
    img: 'rounded-xl bg-white object-contain p-1',
  },
  onDark: {
    socie: 'text-[#bfdbfe]',
    track: 'text-[#bef264]',
    tagLeft: 'text-[#bfdbfe]',
    tagRight: 'text-[#bef264]',
    img: 'rounded-xl bg-white object-contain p-1 shadow-lg shadow-lime-500/20',
  },
  landing: {
    socie: 'text-[#0a223d]',
    track: 'text-[#84cc16]',
    tagLeft: 'text-[#0a223d]',
    tagRight: 'text-[#84cc16]',
    img: 'rounded-xl bg-white shadow-lg shadow-green-500/20 ring-1 ring-gray-200/60 object-contain p-1',
  },
  /** Dark nav: SOCIE + SMART SOCIETY white; TRACK + SMART FINANCES brand green */
  landingWhite: {
    socie: 'text-white',
    track: 'text-[#84cc16]',
    tagLeft: 'text-white',
    tagRight: 'text-[#84cc16]',
    img: 'rounded-xl bg-white object-contain p-1 ring-1 ring-white/50 shadow-md shadow-black/20',
  },
  footer: {
    socie: 'text-[#e2e8f0]',
    track: 'text-[#bef264]',
    tagLeft: 'text-[#e2e8f0]',
    tagRight: 'text-[#bef264]',
    img: 'rounded-xl bg-white object-contain p-1',
  },
};

const SIZES = {
  xs: { img: 'w-8 h-8', main: 'text-[13px]', tag: 'text-[5px]' },
  sm: { img: 'w-9 h-9', main: 'text-[15px]', tag: 'text-[6px]' },
  md: { img: 'w-10 h-10', main: 'text-[17px]', tag: 'text-[6px]' },
  lg: { img: 'w-12 h-12', main: 'text-[21px]', tag: 'text-[7px]' },
};

const BrandLogo = ({ variant = 'light', size = 'md', className = '', to }) => {
  const v = VARIANTS[variant] || VARIANTS.light;
  const s = SIZES[size] || SIZES.md;

  const inner = (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      <img
        src={societrackLogo}
        alt="Societrack"
        className={`${s.img} ${v.img} shrink-0`}
        loading="eager"
      />
      <div className="flex flex-col justify-center min-w-0 leading-none">
        <div className="flex items-baseline gap-0 whitespace-nowrap font-sans font-extrabold uppercase tracking-normal">
          <span className={`${s.main} ${v.socie}`}>SOCIE</span>
          <span className={`${s.main} ${v.track}`}>TRACK</span>
        </div>
        {/* One line, very small — serif caps like reference */}
        <div
          className={`mt-[3px] flex flex-nowrap items-baseline gap-x-2 whitespace-nowrap font-[Georgia,Times_New_Roman,serif] font-normal uppercase leading-none tracking-wide ${s.tag}`}
        >
          <span className={v.tagLeft}>SMART SOCIETY.</span>
          <span className={v.tagRight}>SMART FINANCES.</span>
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center max-w-full">
        {inner}
      </Link>
    );
  }
  return inner;
};

export default BrandLogo;
