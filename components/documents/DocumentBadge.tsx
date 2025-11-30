'use client';

/**
 * Phase 19: Document Badge Component
 * Small badge showing document count for entities
 */

import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DocumentBadgeProps {
  count: number;
  onClick?: () => void;
  showZero?: boolean;
  size?: 'sm' | 'md';
}

export function DocumentBadge({
  count,
  onClick,
  showZero = false,
  size = 'sm',
}: DocumentBadgeProps) {
  if (count === 0 && !showZero) {
    return null;
  }

  return (
    <Badge
      variant={count > 0 ? 'default' : 'outline'}
      className={`
        transition-colors
        ${size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'}
        ${onClick ? 'cursor-pointer hover:bg-primary/80' : ''}
      `}
      onClick={onClick}
      title={`${count} document${count !== 1 ? 's' : ''} attached`}
    >
      <FileText className={size === 'sm' ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-1.5'} />
      {count}
    </Badge>
  );
}
