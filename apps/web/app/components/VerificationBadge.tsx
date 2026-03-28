'use client';

import { Badge } from '@/app/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, AlertCircle, Ban, SearchX } from 'lucide-react';
import { VerificationBadge as BadgeType } from '@phygital-trace/shared';

interface Props {
  badge: BadgeType;
  size?: 'sm' | 'md' | 'lg';
}

const badgeConfig: Record<BadgeType, { label: string; className: string; icon: React.ElementType }> = {
  VERIFIED: {
    label: 'VERIFIED',
    className: 'verification-badge-verified',
    icon: CheckCircle
  },
  PENDING: {
    label: 'PENDING',
    className: 'verification-badge-pending',
    icon: Clock
  },
  SUSPICIOUS: {
    label: 'SUSPICIOUS',
    className: 'verification-badge-suspicious',
    icon: AlertTriangle
  },
  TAMPERED: {
    label: 'TAMPERED',
    className: 'verification-badge-tampered',
    icon: AlertCircle
  },
  REVOKED: {
    label: 'REVOKED',
    className: 'verification-badge-revoked',
    icon: Ban
  },
  NOT_FOUND: {
    label: 'NOT FOUND',
    className: 'verification-badge-not-found',
    icon: SearchX
  }
};

export function VerificationBadge({ badge, size = 'md' }: Props) {
  const config = badgeConfig[badge] || badgeConfig.NOT_FOUND;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1 gap-1',
    md: 'text-sm px-3 py-1.5 gap-1.5',
    lg: 'text-base px-4 py-2 gap-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <Badge className={`${config.className} ${sizeClasses[size]} inline-flex items-center font-semibold border`}>
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
    </Badge>
  );
}
