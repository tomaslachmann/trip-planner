'use client';

import { ArrowUpDown, Edit3, MapPin, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PlaceRow } from '../components/place-row';
import { PlanScreen } from '../components/plan-screen';
import { useModal } from '../context/modal-context';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { placeRecommendationScore } from '../lib/decision';

const FILTERS = [
  { key: 'all',  label: 'Vše' },
  { key: 'see',  label: 'Památky' },
  { key: 'food', label: 'Jídlo' },
  { key: 'act',  label: 'Aktivity' },
  { key: 'day',  label: 'Výlety' },
  { key: 'stay', label: 'Ubytování' },
  { key: 'trans',label: 'Doprava' },
] as const;

function catKey(type?: string) {
  if (!type) return 'see';
  const t = type.toLowerCase();
  if (t === 'place' || t === 'custom') return 'see';
  if (t === 'food') return 'food';
  if (t === 'activity') return 'act';
  if (t === 'day_trip') return 'day';
  if (t === 'accommodation') return 'stay';
  if (t === 'transport') return 'trans';
  return 'see';
}

function DesktopPlaces({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortVotes, setSortVotes] = useState(false);
  const canChangeStatus = (createdById?: string) => createdById === state.actorUserId || state.actorMember?.role === 'OWNER' || state.actorMember?.role === 'ADMIN';

  const filtered = state.data.places
    .filter((p) => {
      const matchesCat = filter === 'all' || catKey(p.type) === filter;
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (!sortVotes) return 0;
	      return placeRecommendationScore(b, state.selectedTrip?.members ?? []) - placeRecommendationScore(a, state.selectedTrip?.members ?? []);
	    });

  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <div className="maxw">
          {/* Header row */}
          <div className="row between mb16">
            <div className="row g10">
              <h1 className="desk-h">Místa</h1>
              <span className="badge muted">{state.data.places.length}</span>
            </div>
            <div className="row g10">
              <div className="input muted-bg" style={{ width: 240 }}>
                <Search size={18} />
                <input
                  placeholder="Hledat místa…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Button variant={sortVotes ? 'secondary' : 'outline'} type="button" onClick={() => setSortVotes((value) => !value)}>
                <ArrowUpDown size={16} />Hlasy
              </Button>
              <Button type="button" onClick={() => openModal('addPlace')}>
                <Plus size={16} />Přidat místo
              </Button>
            </div>
          </div>

          {/* Category chips */}
          <div className="chips mb16">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                className={`chip${filter === key ? ' on' : ''}`}
                type="button"
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<MapPin />}
                title={state.data.places.length === 0 ? 'Zatím tu nejsou žádná místa.' : 'Žádná místa neodpovídají filtru.'}
                text={state.data.places.length === 0 ? 'Přidej první pomocí tlačítka Přidat místo.' : 'Zkus jiný filtr nebo hledání.'}
              />
            </Card>
          ) : (
            <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {filtered.map((place) => (
                <Card
                  key={place.id}
                  className="shadow-[var(--sh-sm)]"
                  style={{ padding: '4px 16px' }}
                >
                  <PlaceRow
                    place={place}
                    selected={state.selectedPlaceId === place.id}
                    onSelect={() => actions.setSelectedPlaceId(place.id)}
                    onAdd={() => void actions.addPlaceToItinerary(place.id)}
                    onApprove={canChangeStatus(place.createdById) ? () => void actions.updatePlaceStatus(place.id, 'APPROVED') : undefined}
                    onShortlist={canChangeStatus(place.createdById) ? () => void actions.updatePlaceStatus(place.id, 'SHORTLISTED') : undefined}
                  />
                  <div className="row g8" style={{ padding: '0 0 12px 52px' }}>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => {
                        actions.setSelectedPlaceId(place.id);
                        openModal('addPlace', true);
                      }}
                    >
                      <Edit3 size={14} />Upravit
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function TripPlacesRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="places">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<PlanScreen planner={planner} />}
          desktop={<DesktopPlaces planner={planner} />}
        />
      )}
    </TripRouteRuntime>
  );
}
