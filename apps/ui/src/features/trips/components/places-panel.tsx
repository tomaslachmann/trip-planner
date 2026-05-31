import { ArrowUpDown, MapPin, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import type { Place } from '../types';
import { PlaceRow } from './place-row';

type StatusFilter = 'all' | 'proposed' | 'shortlisted' | 'approved';

const statusFilters: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: 'Vše' },
  { key: 'proposed', label: 'Návrhy' },
  { key: 'shortlisted', label: 'Shortlist' },
  { key: 'approved', label: 'Schválené' },
];

function placeScore(place: Place) {
  return (place.votes ?? []).reduce((sum, vote) => {
    if (vote.value === 'MUST_HAVE') return sum + 3;
    if (vote.value === 'UP') return sum + 2;
    if (vote.value === 'MAYBE') return sum + 1;
    if (vote.value === 'DOWN') return sum - 1;
    return sum;
  }, 0);
}

function placeStatus(place: Place): StatusFilter {
  const values = place.votes ?? [];
  if (values.some((vote) => vote.value === 'MUST_HAVE')) return 'approved';
  if (values.some((vote) => vote.value === 'UP')) return 'shortlisted';
  return 'proposed';
}

function DraggablePlace({
  place,
  onSelect,
  selected,
  onApprove,
  onShortlist,
  onMore,
}: {
  place: Place;
  onSelect: () => void;
  selected?: boolean;
  onApprove: () => void;
  onShortlist: () => void;
  onMore: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `place:${place.id}` });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={isDragging ? 'dragging' : undefined}
      {...listeners}
      {...attributes}
    >
      <PlaceRow
        place={place}
        selected={selected}
        dragging={isDragging}
        onSelect={onSelect}
        onApprove={onApprove}
        onShortlist={onShortlist}
        onMore={onMore}
      />
    </div>
  );
}

export function PlacesPanel({
  places,
  selectedPlaceId,
  onSelect,
  onVotePlace,
  onEditPlace,
}: {
  places: Place[];
  selectedPlaceId?: string;
  onSelect: (placeId: string) => void;
  onVotePlace: (placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') => void;
  onEditPlace: (placeId: string) => void;
}) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sortVotes, setSortVotes] = useState(false);

  const visiblePlaces = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = places.filter((place) => {
      const matchesStatus = filter === 'all' || placeStatus(place) === filter;
      const matchesSearch = !query || place.name.toLowerCase().includes(query) || (place.description ?? '').toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
    if (!sortVotes) return list;
    return [...list].sort((a, b) => placeScore(b) - placeScore(a));
  }, [filter, places, search, sortVotes]);

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
          {statusFilters.map((item) => (
            <button key={item.key} className={`chip${filter === item.key ? ' on' : ''}`} type="button" onClick={() => setFilter(item.key)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
        {visiblePlaces.length === 0 && (
          <Card>
            <EmptyState icon={<MapPin />} title={places.length === 0 ? 'Zatím tu nejsou žádná místa.' : 'Žádná místa neodpovídají filtru.'} text={places.length === 0 ? 'Použij spodní tlačítko plus a přidej první místo.' : 'Zkus jiné hledání nebo filtr.'} />
          </Card>
        )}
        {visiblePlaces.map((place, index) => (
          <div key={place.id}>
            {index > 0 && <hr className="sep" />}
            <DraggablePlace
              place={place}
              selected={selectedPlaceId === place.id}
              onSelect={() => onSelect(place.id)}
              onApprove={() => onVotePlace(place.id, 'MUST_HAVE')}
              onShortlist={() => onVotePlace(place.id, 'UP')}
              onMore={() => onEditPlace(place.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
