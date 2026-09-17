import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'danger' | 'ghost';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary: 'bg-zinc-100 text-zinc-950 hover:bg-white active:bg-zinc-200 border-transparent font-medium shadow-sm',
    secondary: 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800 active:bg-zinc-850 border-zinc-800 font-medium',
    subtle: 'bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700 border-zinc-700/50',
    danger: 'bg-rose-950/80 text-rose-300 hover:bg-rose-900/90 active:bg-rose-950 border-rose-800/80 font-medium',
    ghost: 'bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 border-transparent',
  };

  const sizeStyles = {
    xs: 'text-[11px] px-2 py-1 rounded gap-1.5',
    sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1.5',
    md: 'text-xs px-3.5 py-2 rounded-md gap-2 font-medium',
    lg: 'text-sm px-4 py-2.5 rounded-lg gap-2.5 font-medium',
  };

  return (
    <button
      className={`inline-flex items-center justify-center border transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
};
