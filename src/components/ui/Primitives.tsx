import React from 'react';

type Tone = 'brand' | 'neutral' | 'warning' | 'danger' | 'ink';

const toneClasses: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  neutral: 'bg-ink-50 text-ink-600 ring-ink-100',
  warning: 'bg-amber-50 text-amber-700 ring-amber-100',
  danger: 'bg-red-50 text-red-700 ring-red-100',
  ink: 'bg-ink-900 text-white ring-ink-900'
};

export function Badge({
  children,
  tone = 'neutral'



}: {children: React.ReactNode;tone?: Tone;}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${toneClasses[tone]}`}>
      
      {children}
    </span>);

}

export function Panel({
  children,
  className = ''



}: {children: React.ReactNode;className?: string;}) {
  return (
    <section
      className={`rounded-xl border border-ink-100 bg-white shadow-card ${className}`}>
      
      {children}
    </section>);

}

export function PanelHeader({
  title,
  subtitle,
  action




}: {title: string;subtitle?: string;action?: React.ReactNode;}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink-100 px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {subtitle ?
        <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> :
        null}
      </div>
      {action}
    </div>);

}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-sm' : 'px-4 py-2.5 text-sm';
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary:
    'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50',
    ghost: 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
    danger: 'border border-red-200 bg-white text-red-600 hover:bg-red-50'
  }[variant];
  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...props} />);

}

export function Field({
  label,
  hint,
  children,
  className = ''





}: {label: string;hint?: string;children: React.ReactNode;className?: string;}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-400">{hint}</span> : null}
    </label>);

}

export const inputClass =
'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function EmptyState({
  icon,
  title,
  description




}: {icon: React.ReactNode;title: string;description?: string;}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50 text-ink-400">
        {icon}
      </div>
      <p className="text-sm font-medium text-ink-800">{title}</p>
      {description ?
      <p className="max-w-sm text-sm text-ink-500">{description}</p> :
      null}
    </div>);

}