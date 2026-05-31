import { CalendarPlus, Clock, MessageCircle, ThumbsUp } from 'lucide-react';
import type { Place } from '../types';
import { CategoryBadge, categoryLabel, categoryMeta } from './category';

export function PlaceRow({
  place,
  selected,
  dragging,
  onSelect,
  onAdd,
}: {
  place: Place;
  selected?: boolean;
  dragging?: boolean;
  onSelect: () => void;
  onAdd?: () => void;
}) {
  const meta = categoryMeta(place.type);
  const Icon = meta.icon;
  const votes = place.votes?.length ?? 0;
  const comments = place.comments?.length ?? 0;
  return (
    <div className="col" style={{ padding: '13px 0' }}>
      <div className="row pressable" onClick={onSelect}>
        <div className={`lead-ic cat-${meta.cls}`} style={{ background: `var(--c-${meta.cls}-bg)`, color: `var(--c-${meta.cls})` }}>
          <Icon />
        </div>
        <div className="col flex1" style={{ minWidth: 0 }}>
          <div className="row between g8">
            <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</span>
            <span className={`badge ${selected ? 'solid' : 'muted'}`}>{selected ? 'Vybráno' : categoryLabel(place.type)}</span>
          </div>
          <div className="row g10 mt4 muted t-xs">
            <span className="row g4"><ThumbsUp />{votes}</span>
            <span className="row g4"><MessageCircle />{comments}</span>
            <span className="row g4"><Clock />{place.durationMin ?? 90}m</span>
            <span className="medi" style={{ color: 'var(--fg)' }}>{place.estimatedCost ? `${place.estimatedCost}` : 'Zdarma'}</span>
          </div>
        </div>
      </div>
      {onAdd && (
        <div className="row g8 mt10" style={{ paddingLeft: 52 }}>
          <button className="btn outline sm" type="button" onClick={onAdd} disabled={dragging}>
            <CalendarPlus />Plán
          </button>
          <CategoryBadge type={place.type} />
        </div>
      )}
    </div>
  );
}
