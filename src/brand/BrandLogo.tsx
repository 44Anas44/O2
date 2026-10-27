import React from 'react';
import { BRAND } from './index';

/** Logo de la marque : image si fournie, sinon monogramme (initiales). */
export function BrandLogo({ size = 36, className = '', src }: {size?: number;className?: string;src?: string;}) {
  const image = src || BRAND.logo;
  if (image) {
    return (
      <img
        src={image}
        alt={BRAND.name}
        style={{ height: size, maxWidth: size * 3 }}
        className={`w-auto object-contain ${className}`} />);


  }
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={`flex shrink-0 items-center justify-center rounded-lg bg-brand-500 font-bold text-white ${className}`}>
      {BRAND.initials}
    </span>);

}
