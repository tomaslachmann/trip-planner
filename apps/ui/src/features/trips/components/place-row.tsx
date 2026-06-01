import { Bookmark, CalendarPlus, Check, Clock, MessageCircle, Pencil, ThumbsUp, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Place } from '../types';
import { categoryMeta } from './category';
import { normalizePlaceStatus, placeStatusMeta } from '../lib/decision';

function weatherLabel(value?: string) {
  if (value === 'INDOOR') return 'Uvnitř';
  if (value === 'OUTDOOR') return 'Venku';
  return 'Mix';
}

function voteCounts(place: Place) {
  const votes = place.votes ?? [];
  return {
    must: votes.filter((vote) => vote.value === 'MUST_HAVE').length,
    up: votes.filter((vote) => vote.value === 'UP').length,
    maybe: votes.filter((vote) => vote.value === 'MAYBE').length,
    no: votes.filter((vote) => vote.value === 'DOWN').length,
  };
}

function placeScore(place: Place) {
  const votes = voteCounts(place);
  const total = votes.must + votes.up + votes.maybe + votes.no;
  if (!total) return { score: 0, mood: 'Bez hlasů', cls: 'muted', voters: 0 };

  const score = Math.round((votes.must * 100 + votes.up * 72 + votes.maybe * 40) / total);
  let mood = 'Smíšené';
  let cls = 'amber';
  if (score >= 78 && votes.no === 0) {
    mood = 'Top';
    cls = 'green';
  } else if (score >= 62) {
    mood = 'Oblíbené';
    cls = 'green';
  } else if (votes.no >= 2 && votes.must >= 2) {
    mood = 'Sporné';
    cls = 'red';
  }
  return { score, mood, cls, voters: total };
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
  const votes = voteCounts(place);
  const comments = place.comments?.length ?? 0;
  const normalizedStatus = normalizePlaceStatus(place.status);
  const status = placeStatusMeta[normalizedStatus];
  const score = placeScore(place);
  const approved = normalizedStatus === 'APPROVED';
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
        <Badge variant="outline" className={cn('badge', score.cls)} style={{ flex: '0 0 auto' }} title={`${score.voters} hlasů`}>
          <TrendingUp size={12} />{score.score} · {score.mood}
        </Badge>
      </div>

      {(onApprove || onShortlist || onAdd || onMore || approved) && (
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
                  <Button variant="ghost" size="sm" type="button" onClick={onShortlist} disabled={dragging}>
                    <Bookmark />Shortlist
                  </Button>
                )}
              </>
            )}
            {onAdd && (
              <Button variant="ghost" size="sm" type="button" onClick={onAdd} disabled={dragging}>
                <CalendarPlus />Plán
              </Button>
            )}
            <span className="flex1" />
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
