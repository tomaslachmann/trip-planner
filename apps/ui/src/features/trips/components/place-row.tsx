import { Bookmark, CalendarPlus, Check, Clock, Ellipsis, MessageCircle, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Place } from '../types';
import { CategoryBadge, categoryMeta } from './category';

function weatherLabel(value?: string) {
  if (value === 'INDOOR') return 'Indoor';
  if (value === 'OUTDOOR') return 'Outdoor';
  return 'Mixed';
}

export function PlaceRow({
  place,
  selected,
  dragging,
  onSelect,
  onAdd,
  onApprove,
  onShortlist,
  onMore,
}: {
  place: Place;
  selected?: boolean;
  dragging?: boolean;
  onSelect: () => void;
  onAdd?: () => void;
  onApprove?: () => void;
  onShortlist?: () => void;
  onMore?: () => void;
}) {
  const meta = categoryMeta(place.type);
  const Icon = meta.icon;
  const mustVotes = place.votes?.filter((vote) => vote.value === 'MUST_HAVE').length ?? 0;
  const upVotes = place.votes?.filter((vote) => vote.value === 'UP').length ?? 0;
  const votes = mustVotes + upVotes;
  const comments = place.comments?.length ?? 0;
  const status = mustVotes > 0 ? { label: 'Schválené', cls: 'green' } : upVotes > 0 ? { label: 'Shortlist', cls: 'amber' } : { label: 'Návrh', cls: 'muted' };
  return (
    <div className="col" style={{ padding: '13px 0' }}>
      <div className="row pressable" onClick={onSelect}>
        <div className={`lead-ic cat-${meta.cls}`} style={{ background: `var(--c-${meta.cls}-bg)`, color: `var(--c-${meta.cls})` }}>
          <Icon />
        </div>
        <div className="col flex1" style={{ minWidth: 0 }}>
          <div className="row between g8">
            <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</span>
            <span className={`badge ${selected ? 'solid' : status.cls}`}>{selected ? 'Vybráno' : status.label}</span>
          </div>
          <div className="row g10 mt4 muted t-xs">
            <span className="row g4"><ThumbsUp />{votes}</span>
            <span className="row g4"><MessageCircle />{comments}</span>
            <span className="row g4"><Clock />{place.durationMin ?? 90}m</span>
            <span className="medi" style={{ color: 'var(--fg)' }}>{place.estimatedCost ? `${place.estimatedCost}` : 'Zdarma'}</span>
          </div>
          <div className="row g6 mt8">
            <span className="badge muted">{weatherLabel(place.weatherSuitability)}</span>
          </div>
        </div>
      </div>
      {(onApprove || onShortlist || onMore) && (
        <div className="row g8 mt10" style={{ paddingLeft: 52 }}>
          {onApprove && (
            <Button variant="outline" size="sm" type="button" onClick={onApprove} disabled={dragging}>
              <Check />Schválit
            </Button>
          )}
          {onShortlist && (
            <Button variant="ghost" size="sm" type="button" onClick={onShortlist} disabled={dragging}>
              <Bookmark />Shortlist
            </Button>
          )}
          {onMore && (
            <Button variant="ghost" size="sm" type="button" onClick={onMore} disabled={dragging} aria-label="Další akce">
              <Ellipsis />
            </Button>
          )}
        </div>
      )}
      {onAdd && (
        <div className="row g8 mt10" style={{ paddingLeft: 52 }}>
          <Button variant="outline" size="sm" type="button" onClick={onAdd} disabled={dragging}>
            <CalendarPlus />Plán
          </Button>
          <CategoryBadge type={place.type} />
        </div>
      )}
    </div>
  );
}
