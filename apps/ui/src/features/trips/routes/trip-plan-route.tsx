'use client';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ItineraryPanel } from '../components/itinerary-panel';
import { PlacesPanel } from '../components/places-panel';
import { PlanScreen } from '../components/plan-screen';
import { useModal } from '../context/modal-context';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

function DesktopPlan({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!overId) return;
    if (activeId.startsWith('place:')) {
      const dayId = overId.startsWith('day:') ? overId.replace('day:', '') : overId.startsWith('stop:') ? stopDayId(planner, overId.replace('stop:', '')) : undefined;
      await actions.addPlaceToItinerary(activeId.replace('place:', ''), dayId);
    }
    if (activeId.startsWith('stop:') && overId.startsWith('stop:')) {
      const activeStopId = activeId.replace('stop:', '');
      const overStopId = overId.replace('stop:', '');
      const day = state.data.itinerary.find((item) => (item.stops ?? []).some((stop) => stop.id === activeStopId));
      if (!day) return;
      const stops = day.stops ?? [];
      const oldIndex = stops.findIndex((stop) => stop.id === activeStopId);
      const newIndex = stops.findIndex((stop) => stop.id === overStopId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) await actions.reorderStops(day.id, arrayMove(stops, oldIndex, newIndex).map((stop) => stop.id));
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
      <div className="desk-body">
        <div className="desk-scroll">
          <PlacesPanel
            places={state.data.places}
            selectedPlaceId={state.selectedPlaceId}
            onSelect={actions.setSelectedPlaceId}
            onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)}
            onEditPlace={(placeId) => {
              actions.setSelectedPlaceId(placeId);
              openModal('addPlace', true);
            }}
          />
        </div>
        <aside className="desk-panel"><ItineraryPanel days={state.data.itinerary} weather={state.data.weather} onOpenPlace={actions.setSelectedPlaceId} actorTripMemberId={state.actorMember?.id} onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)} onUpdateDay={(dayId, input) => void actions.updateItineraryDay(dayId, input)} onOptimize={() => void actions.optimizeRoute()} /></aside>
      </div>
    </DndContext>
  );
}

export function TripPlanRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="plan">
      {(planner) => <RoutePair planner={planner} mobile={<PlanScreen planner={planner} />} desktop={<DesktopPlan planner={planner} />} />}
    </TripRouteRuntime>
  );
}
