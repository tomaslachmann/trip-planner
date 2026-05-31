'use client';

import { useEffect, useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { CostsPanel } from './costs-panel';
import { ItineraryPanel } from './itinerary-panel';
import { MembersPanel } from './members-panel';
import { PlacesPanel } from './places-panel';
import { StayPanel } from './stay-panel';
import { TripBar } from './trip-bar';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';

type PlanView = 'places' | 'itinerary' | 'stay';

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

export function PlanScreen({ planner, forcedTab, mobile = false }: { planner: TripPlannerController; forcedTab?: TabKey; mobile?: boolean }) {
  const { state, actions } = planner;
  const [planView, setPlanView] = useState<PlanView>('places');

  useEffect(() => {
    if (forcedTab === 'stay') setPlanView('stay');
  }, [forcedTab]);

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!overId) return;

    if (activeId.startsWith('place:')) {
      const placeId = activeId.replace('place:', '');
      const dayId = overId.startsWith('day:') ? overId.replace('day:', '') : overId.startsWith('stop:') ? stopDayId(planner, overId.replace('stop:', '')) : undefined;
      await actions.addPlaceToItinerary(placeId, dayId);
      setPlanView('itinerary');
      return;
    }

    if (activeId.startsWith('stop:') && overId.startsWith('stop:')) {
      const activeStopId = activeId.replace('stop:', '');
      const overStopId = overId.replace('stop:', '');
      const day = state.data.itinerary.find((item) => (item.stops ?? []).some((stop) => stop.id === activeStopId));
      if (!day) return;
      const stops = day.stops ?? [];
      const oldIndex = stops.findIndex((stop) => stop.id === activeStopId);
      const newIndex = stops.findIndex((stop) => stop.id === overStopId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      await actions.reorderStops(day.id, arrayMove(stops, oldIndex, newIndex).map((stop) => stop.id));
    }
  }

  if (forcedTab === 'costs') {
    return (
      <div className="screen">
        <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
        <CostsPanel trip={state.selectedTrip} expenses={state.data.expenses} settlements={state.data.settlements} onAddExpense={(data) => void actions.addExpense(data)} mobile={mobile} />
      </div>
    );
  }

  if (forcedTab === 'members') {
    return (
      <div className="screen">
        <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
        <MembersPanel trip={state.selectedTrip} actorUserId={state.actorUserId} actorRole={state.actorMember?.role} onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)} onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)} />
      </div>
    );
  }

  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
      <div className="px18" style={{ paddingTop: 10, paddingBottom: 2, flex: '0 0 auto' }}>
        <div className="seg">
          <button className={planView === 'places' ? 'on' : ''} type="button" onClick={() => setPlanView('places')}>Místa</button>
          <button className={planView === 'itinerary' ? 'on' : ''} type="button" onClick={() => setPlanView('itinerary')}>Itinerář</button>
          <button className={planView === 'stay' ? 'on' : ''} type="button" onClick={() => setPlanView('stay')}>Ubytování</button>
        </div>
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <div className="col flex1 rel" style={{ minHeight: 0 }}>
          {planView === 'places' && (
            <PlacesPanel
              trip={state.selectedTrip}
              places={state.data.places}
              selectedPlaceId={state.selectedPlaceId}
              onSelect={actions.setSelectedPlaceId}
              onAddPlace={(data) => void actions.addPlace(data)}
              onPlanPlace={(placeId) => void actions.addPlaceToItinerary(placeId)}
            />
          )}
          {planView === 'itinerary' && (
            <ItineraryPanel
              days={state.data.itinerary}
              onOpenPlace={actions.setSelectedPlaceId}
              onOptimize={() => void actions.optimizeRoute()}
            />
          )}
          {planView === 'stay' && (
            <StayPanel
              trip={state.selectedTrip}
              stays={state.accommodations}
              selectedId={state.selectedAccommodationId}
              searching={state.searchingStay}
              onSearch={(data) => void actions.searchStays(data)}
              onSelect={actions.setSelectedAccommodationId}
              onSave={(stay) => void actions.saveAccommodation(stay)}
            />
          )}
        </div>
      </DndContext>
    </div>
  );
}
