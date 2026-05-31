'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ConfirmDestructiveAction({
  label,
  confirmLabel = 'Smazat',
  onConfirm,
  size = 'sm',
  iconOnly = false,
  className,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  size?: 'sm' | 'icon';
  iconOnly?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <Button className={className} variant="ghost" size={size} type="button" onClick={() => setArmed(true)} aria-label={label}>
        <Trash2 size={14} />{iconOnly ? null : label}
      </Button>
    );
  }

  return (
    <div className={`row g6 ${className ?? ''}`}>
      <Button variant="destructive" size="sm" type="button" onClick={onConfirm}>
        <Trash2 size={14} />{confirmLabel}
      </Button>
      <Button variant="ghost" size="icon" type="button" onClick={() => setArmed(false)} aria-label="Zrušit mazání">
        <X size={14} />
      </Button>
    </div>
  );
}
