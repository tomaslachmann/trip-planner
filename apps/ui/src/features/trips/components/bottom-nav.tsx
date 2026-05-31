import { LayoutGrid, Map, Plus, Route, Wallet } from 'lucide-react';
import Link from 'next/link';
import type { ElementType } from 'react';
import { cn } from '@/lib/utils';
import type { TabKey } from '../types';

const items: Array<{ key: TabKey | 'add'; label: string; icon?: ElementType }> = [
  { key: 'map', label: 'Mapa', icon: Map },
  { key: 'plan', label: 'Plán', icon: Route },
  { key: 'add', label: 'Přidat' },
  { key: 'costs', label: 'Náklady', icon: Wallet },
  { key: 'more', label: 'Více', icon: LayoutGrid },
];

export function BottomNav({ active, tripHref, onAdd }: { active: TabKey; tripHref: (tab: TabKey) => string; onNav: (tab: TabKey) => void; onAdd: () => void }) {
  return (
    <div className="bottomnav">
      {items.map((item) => {
        if (item.key === 'add') {
          return (
            <button className="navitem nav-add" key="add" onClick={onAdd} type="button" aria-label="Přidat">
              <div className="plus"><Plus /></div>
            </button>
          );
        }
        const Icon = item.icon!;
        const key = item.key as TabKey;
        return (
          <Link className={cn('navitem', active === key && 'on')} href={tripHref(key)} key={key} scroll={false}>
            <Icon />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
