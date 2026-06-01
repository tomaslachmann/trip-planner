import { BedDouble, MapPin } from 'lucide-react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { Place } from '../types';

export function PlaceImage({
  place,
  height = 188,
  className,
  style,
  ...props
}: {
  place: Pick<Place, 'name' | 'imageUrl' | 'type'>;
  height?: number;
  style?: CSSProperties;
} & HTMLAttributes<HTMLDivElement>) {
  const baseStyle: CSSProperties = {
    height,
    borderRadius: 14,
    border: '1px solid var(--border)',
    overflow: 'hidden',
    background: 'var(--muted)',
    ...style,
  };

  if (place.imageUrl) {
    return (
      <div className={className} style={baseStyle} {...props}>
        <img
          alt={place.name}
          src={place.imageUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }

  const Icon = place.type === 'ACCOMMODATION' ? BedDouble : MapPin;
  return (
    <div className={cn('receipt center', className)} style={baseStyle} {...props}>
      <span className="row g6 t-xs mono muted flex justify-center align-center h-full"><Icon />foto místa</span>
    </div>
  );
}
