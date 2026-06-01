import { Bookmark, CalendarPlus, Check, Clock, GripVertical, MessageCircle, Pencil, ThumbsUp } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Place } from '../types';
import { categoryMeta } from './category';
import { normalizePlaceStatus, placeStatusMeta, placeVoteCounts } from '../lib/decision';
import { PlaceScoreBadge } from './place-score-badge';
import { StatusActionButton } from './status-action-button';

function weatherLabel(value?: string) {
  if (value === 'INDOOR') return 'Uvnitř';
  if (value === 'OUTDOOR') return 'Venku';
  return 'Mix';
}

function priceLabel(value: Place['estimatedCost']) {
  if (value === undefined || value === null || value === '') return 'Zdarma';
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (Number.isFinite(numeric)) return `${Math.round(Number(numeric)).toLocaleString('cs-CZ')} €`;
  return String(value);
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
  dragHandleProps,
}: {
  place: Place;
  selected?: boolean;
  dragging?: boolean;
  onSelect: () => void;
  onAdd?: () => void;
  onApprove?: () => void;
  onShortlist?: () => void;
  onMore?: () => void;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}) {
  const meta = categoryMeta(place.type);
  const Icon = meta.icon;
  const votes = placeVoteCounts(place);
  const comments = place.comments?.length ?? 0;
  const normalizedStatus = normalizePlaceStatus(place.status);
  const status = placeStatusMeta[normalizedStatus];
  const approved = normalizedStatus === 'APPROVED';
  const shortlisted = normalizedStatus === 'SHORTLISTED';
  return (
    <Card className={cn('p-[16px] shadow-[var(--sh-sm)] transition', selected && 'outline outline-2 outline-[var(--primary)]', dragging && 'dragging')}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="row g12 pressable" style={{ minWidth: 0 }} onClick={onSelect}>
          <div className="lead-ic" style={{ background: `var(--c-${meta.cls}-bg)`, color: `var(--c-${meta.cls})` }}>
            <Icon size={20} />
          </div>
          <div className="col" style={{ minWidth: 0 }}>
            <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{place.name}</span>
            <span className="faint t-xs mt4">{meta.label} · {weatherLabel(place.weatherSuitability)}</span>
          </div>
        </div>
        <Badge variant="outline" className={cn('badge', selected ? 'solid' : status.cls)} style={{ flex: '0 0 auto' }}>
          {selected ? 'Vybráno' : status.label}
        </Badge>
      </div>

      <div className="row between mt14" style={{ gap: 10 }}>
        <div className="row g12 muted t-xs" style={{ flexWrap: 'wrap' }}>
          <span className="row g4"><ThumbsUp size={13} />{votes.must + votes.up}</span>
          <span className="row g4"><MessageCircle size={13} />{comments}</span>
          <span className="row g4"><Clock size={13} />{place.durationMin ?? 90}m</span>
          <span className="medi" style={{ color: 'var(--fg)' }}>{priceLabel(place.estimatedCost)}</span>
        </div>
        <PlaceScoreBadge place={place} style={{ flex: '0 0 auto' }} />
      </div>

      {(onApprove || onShortlist || onAdd || onMore || approved || dragHandleProps) && (
        <>
          <Separator className="mt14" />
          <div className="row g6 mt14 wrap">
            {approved ? (
              <Badge variant="outline" className="badge green"><Check size={12} />Schváleno</Badge>
            ) : (
              <>
                {onApprove && (
                  <Button variant="outline" size="sm" type="button" onClick={onApprove} disabled={dragging}>
                    <Check />Schválit
                  </Button>
                )}
                {onShortlist && (
                  <StatusActionButton active={shortlisted} tone="amber" variant={shortlisted ? 'outline' : 'ghost'} size="sm" type="button" onClick={onShortlist} disabled={dragging}>
                    <Bookmark />Shortlist
                  </StatusActionButton>
                )}
              </>
            )}
            {onAdd && (
              <Button variant="ghost" size="sm" type="button" onClick={onAdd} disabled={dragging}>
                <CalendarPlus />Plán
              </Button>
            )}
            <span className="flex1" />
            {dragHandleProps && (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label="Přetáhnout místo"
                className="h-[34px] w-[34px] rounded-sm cursor-grab active:cursor-grabbing"
                {...dragHandleProps}
              >
                <GripVertical size={15} />
              </Button>
            )}
            {onMore && (
              <Button variant="ghost" size="icon" type="button" onClick={onMore} disabled={dragging} aria-label="Upravit místo" className="h-[34px] w-[34px] rounded-sm">
                <Pencil size={15} />
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
