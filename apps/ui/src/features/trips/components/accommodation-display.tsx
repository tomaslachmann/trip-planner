import { BedDouble, Star } from 'lucide-react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { Accommodation } from '../types';

export function accommodationTypeLabel(stay?: Pick<Accommodation, 'type' | 'provider'> | null) {
  const raw = stay?.type?.trim();
  if (!raw || raw === 'property_card') return 'Ubytování';
  return raw.replace(/_/g, ' ');
}

export function accommodationPriceLabel(stay?: Pick<Accommodation, 'priceDisplay' | 'priceTotal' | 'currency'> | null) {
  if (!stay) return 'Cena není dostupná';
  if (stay.priceDisplay?.trim()) return stay.priceDisplay;
  if (typeof stay.priceTotal === 'number' && Number.isFinite(stay.priceTotal)) {
    return `${Math.round(stay.priceTotal).toLocaleString('cs-CZ')} ${stay.currency ?? 'EUR'}`;
  }
  return 'Cena není dostupná';
}

function ratingNumber(value?: number | string | null) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return numeric !== undefined && numeric !== null && Number.isFinite(numeric) ? numeric : null;
}

function ratingClass(score: number | null, scale: 5 | 10) {
  if (score === null) return 'muted';
  const normalized = scale === 5 ? score * 2 : score;
  if (normalized >= 8.5) return 'green';
  if (normalized >= 7) return 'amber';
  return 'red';
}

function formatRating(value: number | null) {
  if (value === null) return '-';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function AccommodationRatingBadge({
  reviewScore,
  rating,
  reviewCount,
  compact = false,
  className,
}: {
  reviewScore?: number | string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  compact?: boolean;
  className?: string;
}) {
  const score = ratingNumber(reviewScore);
  const fallbackRating = ratingNumber(rating);
  const value = score ?? fallbackRating;
  const scale: 5 | 10 = score !== null ? 10 : 5;
  const count = ratingNumber(reviewCount);
  const suffix = compact ? '' : ' hodnocení';
  return (
    <span className={cn('badge', ratingClass(value, scale), className)} title={count !== null ? `${count.toLocaleString('cs-CZ')} recenzí` : undefined}>
      <Star />{formatRating(value)}{suffix}{count !== null && !compact ? ` (${count.toLocaleString('cs-CZ')})` : ''}
    </span>
  );
}

export function AccommodationPhoto({
  stay,
  size = 54,
  className,
  style,
  ...props
}: {
  stay: Pick<Accommodation, 'name' | 'photoUrl'>;
  size?: number;
  style?: CSSProperties;
} & HTMLAttributes<HTMLDivElement>) {
  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 12,
    border: '1px solid var(--border)',
    flex: '0 0 auto',
    overflow: 'hidden',
    background: 'var(--muted)',
    ...style,
  };

  if (!stay.photoUrl) {
    return (
      <div className={cn('center', className)} style={baseStyle} {...props}>
        <BedDouble size={Math.max(18, Math.round(size * 0.38))} color="var(--muted-fg)" />
      </div>
    );
  }

  return (
    <div className={className} style={baseStyle} {...props}>
      <img
        alt={stay.name}
        src={stay.photoUrl}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}
