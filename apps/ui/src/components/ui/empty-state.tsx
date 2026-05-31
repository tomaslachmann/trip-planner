import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('col center jcc', className)} style={{ padding: '28px 20px' }}>
      {icon && <div className="empty-ic">{icon}</div>}
      <span className="t-h3 mt12 center">{title}</span>
      {text && <span className="muted t-sm center mt8">{text}</span>}
      {action && <div className="mt16">{action}</div>}
    </div>
  );
}
