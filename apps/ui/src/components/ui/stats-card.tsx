import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type StatItem = {
  label: ReactNode;
  value: ReactNode;
  tone?: 'default' | 'amber' | 'green';
};

export function StatsCard({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <div className={cn('card sh', className)} style={{ display: 'flex' }}>
      {items.map((item, index) => (
        <div className="row" key={index} style={{ flex: 1 }}>
          {index > 0 && <div className="summary-sep" />}
          <div className="col flex1 center">
            <span className="t-h2 tnum" style={{ color: item.tone === 'amber' ? 'var(--amber)' : item.tone === 'green' ? 'var(--green)' : undefined }}>
              {item.value}
            </span>
            <span className="faint t-xs mt4">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
