import { BedDouble, Bus, FerrisWheel, Landmark, Mountain, Utensils } from 'lucide-react';
import type { ElementType } from 'react';
import { categoryKey } from '../lib/format';

const meta: Record<string, { label: string; icon: ElementType; cls: string }> = {
  see: { label: 'Památka', icon: Landmark, cls: 'see' },
  food: { label: 'Jídlo', icon: Utensils, cls: 'food' },
  act: { label: 'Aktivita', icon: FerrisWheel, cls: 'act' },
  day: { label: 'Výlet', icon: Mountain, cls: 'day' },
  stay: { label: 'Ubytování', icon: BedDouble, cls: 'stay' },
  trans: { label: 'Doprava', icon: Bus, cls: 'trans' },
};

export function categoryMeta(type?: string) {
  return meta[categoryKey(type)] ?? meta.see;
}

export function categoryLabel(type?: string) {
  return categoryMeta(type).label;
}

export function CategoryBadge({ type }: { type?: string }) {
  const item = categoryMeta(type);
  const Icon = item.icon;
  return (
    <span className={`badge cat-${item.cls}`}>
      <Icon />
      {item.label}
    </span>
  );
}
