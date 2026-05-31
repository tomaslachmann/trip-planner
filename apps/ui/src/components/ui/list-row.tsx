import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      className={cn('listrow full', onClick && 'pressable', className)}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
    >
      {icon && <span className="lead-ic">{icon}</span>}
      <span className="col flex1" style={{ minWidth: 0 }}>
        <span className="t-h3 ellipsis">{title}</span>
        {subtitle && <span className="muted t-xs mt4">{subtitle}</span>}
      </span>
      {trailing ?? (onClick ? <ChevronRight className="faint" /> : null)}
    </Comp>
  );
}
