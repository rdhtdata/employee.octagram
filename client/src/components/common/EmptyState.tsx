import React from 'react';
import { Button } from './Button.js';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 ${className}`}
    >
      {icon && (
        <div className="w-10 h-10 rounded-full bg-zinc-850 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
