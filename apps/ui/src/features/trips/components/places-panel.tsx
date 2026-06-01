import { ArrowUpDown, MapPin, Search } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import type { Place, TripMember } from '../types';
import { PlaceRow } from './place-row';
import { normalizePlaceStatus, placeRecommendationScore, topPlaces } from '../lib/decision';
import { PlaceScoreBadge } from './place-score-badge';
import { statusActionClass, type StatusTone } from './status-action-button';

type StatusFilter = 'all' | 'PROPOSED' | 'SHORTLISTED' | 'APPROVED' | 'REJECTED';

const statusFilters: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Vše' },
  { key: 'PROPOSED', label: 'Návrhy' },
  { key: 'SHORTLISTED', label: 'Užší výběr' },
  { key: 'APPROVED', label: 'Schválené' },
  { key: 'REJECTED', label: 'Zamítnuté' },
];

const statusFilterTone: Partial<Record<StatusFilter, StatusTone>> = {
  SHORTLISTED: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

function DraggablePlace({
  place,
  onSelect,
  selected,
  onApprove,
  onShortlist,
  onAdd,
  onMore,
}: {
  place: Place;
  onSelect: () => void;
  selected?: boolean;
  onApprove?: () => void;
  onShortlist?: () => void;
  onAdd?: () => void;
  onMore: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `place:${place.id}` });
  const dragHandleProps = { ...attributes, ...(listeners ?? {}) } as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'dragging' : undefined}
    >
      <PlaceRow
        place={place}
        selected={selected}
        dragging={isDragging}
        onSelect={onSelect}
        onAdd={onAdd}
        onApprove={onApprove}
        onShortlist={onShortlist}
        onMore={onMore}
        dragHandleProps={dragHandleProps}
      />
    </div>
  );
}

export function PlacesPanel({
  places,
  members = [],
  actorUserId,
  actorRole,
  selectedPlaceId,
  onSelect,
  onVotePlace,
  onStatusChange,
  onAddPlaceToItinerary,
  onEditPlace,
}: {
  places: Place[];
  members?: TripMember[];
  actorUserId?: string;
  actorRole?: string;
  selectedPlaceId?: string;
  onSelect: (placeId: string) => void;
  onVotePlace: (placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') => void;
  onStatusChange?: (placeId: string, status: 'PROPOSED' | 'SHORTLISTED' | 'APPROVED' | 'REJECTED') => void;
  onAddPlaceToItinerary?: (placeId: string) => void;
  onEditPlace: (placeId: string) => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortVotes, setSortVotes] = useState(false);

  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = places.filter((place) => {
      const matchesStatus = filter === 'all' || normalizePlaceStatus(place.status) === filter;
      const matchesSearch = !query || place.name.toLowerCase().includes(query) || (place.description ?? '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
    if (!sortVotes) return list;
    return [...list].sort((a, b) => placeRecommendationScore(b, members) - placeRecommendationScore(a, members));
  }, [filter, members, places, search, sortVotes]);
  const recommended = topPlaces(places, members, 3);
  const canChangeStatus = (place: Place) => !!onStatusChange && (place.createdById === actorUserId || actorRole === 'OWNER' || actorRole === 'ADMIN');

  return (
    <div className="col flex1" style={{ minHeight: 0 }}>
      <div className="px18" style={{ paddingBottom: 10, paddingTop: 12, flex: '0 0 auto' }}>
        <div className="row g8">
          <div className="input muted-bg flex1">
            <Search size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hledat místa..." />
          </div>
          <Button size="icon" variant={sortVotes ? 'secondary' : 'outline'} type="button" onClick={() => setSortVotes((value) => !value)} title="Seřadit podle hlasů">
            <ArrowUpDown />
          </Button>
        </div>
        <div className="chips mt12">
          {statusFilters.map((item) => {
            const tone = statusFilterTone[item.key];
            return (
              <button
                key={item.key}
                className={cn('chip', filter === item.key && 'on', filter === item.key && tone && statusActionClass(tone, true))}
                type="button"
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
        {recommended.length > 0 && (
          <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
            <div className="row between mb8">
              <span className="t-h3">Nejlepší místa</span>
              <span className="badge green">Doporučeno</span>
            </div>
            <div className="row g8 wrap">
              {recommended.map(({ place }) => (
                <button
                  className="row g6 pressable"
                  type="button"
                  key={place.id}
                  onClick={() => onSelect(place.id)}
                  style={{ border: 0, background: 'transparent', padding: 0, color: 'inherit' }}
                >
                  <span className="badge muted">{place.name}</span>
                  <PlaceScoreBadge place={place} />
                </button>
              ))}
            </div>
          </Card>
        )}
        {visiblePlaces.length === 0 && (
          <Card>
            <EmptyState icon={<MapPin />} title={places.length === 0 ? 'Zatím tu nejsou žádná místa.' : 'Žádná místa neodpovídají filtru.'} text={places.length === 0 ? 'Použij spodní tlačítko plus a přidej první místo.' : 'Zkus jiné hledání nebo filtr.'} />
          </Card>
        )}
        <div className="col g12">
          {visiblePlaces.map((place) => (
            <div key={place.id}>
              <DraggablePlace
                place={place}
                selected={selectedPlaceId === place.id}
                onSelect={() => onSelect(place.id)}
                onAdd={onAddPlaceToItinerary ? () => onAddPlaceToItinerary(place.id) : undefined}
                onApprove={canChangeStatus(place) ? () => {
                  onStatusChange?.(place.id, 'APPROVED');
                  onVotePlace(place.id, 'MUST_HAVE');
                } : undefined}
                onShortlist={canChangeStatus(place) ? () => {
                  onStatusChange?.(place.id, 'SHORTLISTED');
                  onVotePlace(place.id, 'UP');
                } : undefined}
                onMore={() => onEditPlace(place.id)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
