'use client';

import { AlertTriangle, BedDouble, CheckCircle2, ChevronRight, MapPin, Route, Wallet } from 'lucide-react';
import type { ElementType } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { accommodationRecommendationScore, buildDecisionItems, topPlaces } from '../lib/decision';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';
import { PlaceScoreBadge, ScoreBadge } from './place-score-badge';

const itemIcon: Record<string, ElementType> = {
  stay: BedDouble,
  itinerary: Route,
  settle: Wallet,
  places: MapPin,
};

const toneClass = {
  amber: 'amber',
  red: 'red',
  muted: 'muted',
} as const;

export function DecisionCenter({ planner, compact = false }: { planner: TripPlannerController; compact?: boolean }) {
  const { state, actions } = planner;
  const members = state.selectedTrip?.members ?? [];
  const items = buildDecisionItems({
    trip: state.selectedTrip,
    places: state.data.places,
    itinerary: state.data.itinerary,
    settlements: state.data.settlements,
    weatherDays: state.data.weather?.days,
  });
  const top = topPlaces(state.data.places.filter((place) => place.type !== 'ACCOMMODATION'), members, compact ? 2 : 3);
  const bestStay = state.data.places
    .filter((place) => place.type === 'ACCOMMODATION')
    .map((place) => ({ place, score: accommodationRecommendationScore(place, state.data.places, members) }))
    .sort((a, b) => b.score - a.score)[0];

  return (
    <Card className="p-[16px] shadow-[var(--sh-sm)]">
      <div className="row between mb12">
        <div className="col">
          <span className="t-h3 row g6"><AlertTriangle size={16} />Co rozhodnout</span>
          {!compact && <span className="muted t-xs mt2">Konkrétní věci, které blokují plán.</span>}
        </div>
        <span className={`badge ${items.length ? 'amber' : 'green'}`}>{items.length || 'OK'}</span>
      </div>

      {items.length === 0 ? (
        <div className="row g8">
          <span className="badge green"><CheckCircle2 size={12} />Bez blokujících rozhodnutí</span>
        </div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {items.slice(0, compact ? 3 : 5).map((item) => {
            const Icon = itemIcon[item.target] ?? ChevronRight;
            return (
              <button
                className="row between pressable"
                key={`${item.target}-${item.title}`}
                type="button"
                onClick={() => actions.setActiveTab(item.target as TabKey)}
                style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--subtle)', padding: '10px 12px', textAlign: 'left', color: 'inherit' }}
              >
                <span className="row g10" style={{ minWidth: 0 }}>
                  <span className={`badge ${toneClass[item.tone]}`}><Icon size={12} /></span>
                  <span className="col" style={{ minWidth: 0 }}>
                    <span className="t-sm semib ellipsis">{item.title}</span>
                    <span className="muted t-xs ellipsis">{item.detail}</span>
                  </span>
                </span>
                <ChevronRight size={16} color="var(--faint-fg)" />
              </button>
            );
          })}
        </div>
      )}

      {(top.length > 0 || bestStay) && (
        <>
          <hr className="sep mt14" />
          <div className={compact ? 'col g8 mt12' : 'grid2 mt12'} style={{ gap: 8 }}>
            {top.length > 0 && (
              <div className="col g6">
                <span className="faint t-xs">Nejlepší místa</span>
                {top.map(({ place }) => (
                  <Button className="justify-start" key={place.id} size="sm" variant="outline" type="button" onClick={() => { actions.setSelectedPlaceId(place.id); actions.setActiveTab('places'); }}>
                    <MapPin />{place.name}<PlaceScoreBadge place={place} className="ml-auto" />
                  </Button>
                ))}
              </div>
            )}
            {bestStay && (
              <div className="col g6">
                <span className="faint t-xs">Nejlepší ubytování</span>
                <Button className="justify-start" size="sm" variant="outline" type="button" onClick={() => { actions.setSelectedPlaceId(bestStay.place.id); actions.setActiveTab('stay'); }}>
                  <BedDouble />{bestStay.place.name}<ScoreBadge score={bestStay.score} className="ml-auto" title="Skóre ubytování" />
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
