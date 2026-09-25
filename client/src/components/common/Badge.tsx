import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'blue' | 'amber' | 'emerald' | 'rose' | 'purple' | 'zinc';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'zinc',
  size = 'sm',
  dot = false,
  className = '',
}) => {
  const variantStyles = {
    neutral: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
    zinc: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    blue: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
    amber: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    emerald: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    rose: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    purple: 'bg-purple-950/60 text-purple-400 border-purple-800/60',
  };

  const dotColors = {
    neutral: 'bg-zinc-400',
    zinc: 'bg-zinc-400',
    blue: 'bg-sky-400',
    amber: 'bg-amber-400',
    emerald: 'bg-emerald-400',
    rose: 'bg-rose-400',
    purple: 'bg-purple-400',
  };

  const sizeStyles = {
    xs: 'text-[10px] px-1.5 py-0.5 font-medium',
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border tracking-tight ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />}
      <span>{children}</span>
    </span>
  );
};

export const PriorityBadge: React.FC<{ priority: string; size?: 'xs' | 'sm' }> = ({ priority, size = 'xs' }) => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
      return <Badge variant="rose" size={size} dot>Critical</Badge>;
    case 'HIGH':
      return <Badge variant="rose" size={size} dot>High</Badge>;
    case 'MEDIUM':
      return <Badge variant="amber" size={size} dot>Medium</Badge>;
    case 'LOW':
      return <Badge variant="neutral" size={size}>Low</Badge>;
    default:
      return <Badge variant="neutral" size={size}>{priority || 'Normal'}</Badge>;
  }
};

export const StatusBadge: React.FC<{ status: string; size?: 'xs' | 'sm' }> = ({ status, size = 'xs' }) => {
  const s = status?.toUpperCase() || '';
  if (s === 'WON' || ['COMPLETED', 'PAID', 'RESOLVED', 'ACTIVE'].includes(s)) {
    const label = s === 'WON' ? 'Deal Won' : status.replace(/_/g, ' ');
    return <Badge variant="emerald" size={size} dot>{label}</Badge>;
  }
  if (s === 'LOST' || ['OVERDUE', 'BLOCKED', 'CANCELLED', 'INACTIVE'].includes(s)) {
    const label = s === 'LOST' ? 'Deal Lost' : status.replace(/_/g, ' ');
    return <Badge variant="rose" size={size} dot>{label}</Badge>;
  }
  if (s === 'DEMO_DISCOVERY') {
    return <Badge variant="purple" size={size} dot>Demo / Discovery</Badge>;
  }
  if (s === 'NEGOTIATION') {
    return <Badge variant="blue" size={size} dot>Service Delivery & Negotiation</Badge>;
  }
  if (['IN_PROGRESS', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'PROPOSAL'].includes(s)) {
    return <Badge variant="blue" size={size} dot>{status.replace(/_/g, ' ')}</Badge>;
  }
  if (['UPCOMING', 'DUE', 'WAITING', 'PENDING'].includes(s)) {
    return <Badge variant="amber" size={size} dot>{status.replace(/_/g, ' ')}</Badge>;
  }
  return <Badge variant="neutral" size={size}>{status?.replace(/_/g, ' ') || 'New'}</Badge>;
};
