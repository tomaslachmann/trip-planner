'use client';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ItineraryPanel } from '@/features/trips/components/itinerary-panel';
import { PlacesPanel } from '@/features/trips/components/places-panel';
import { PlanScreen } from '@/features/trips/components/plan-screen';
import { useModal } from '@/features/trips/context/modal-context';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';
import { canManageTrip } from '@/features/trips/lib/permissions';

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

function DesktopPlanPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const canManagePlanning = canManageTrip(state.actorMember?.role);

  async function handleDragEnd(event: DragEndEvent) {
    if (!canManagePlanning) return;
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
            members={state.selectedTrip?.members ?? []}
            actorUserId={state.actorUserId}
            actorRole={state.actorMember?.role}
            selectedPlaceId={state.selectedPlaceId}
            onSelect={actions.setSelectedPlaceId}
            onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)}
            onStatusChange={canManagePlanning ? (placeId, status) => void actions.updatePlaceStatus(placeId, status) : undefined}
            onAddPlaceToItinerary={canManagePlanning ? (placeId) => void actions.addPlaceToItinerary(placeId) : undefined}
            onEditPlace={(placeId) => {
              actions.setSelectedPlaceId(placeId);
              openModal('addPlace', true);
            }}
          />
        </div>
        <aside className="desk-panel">
          <ItineraryPanel
            days={state.data.itinerary}
            weather={state.data.weather}
            routeCapabilities={state.data.routeCapabilities}
            onOpenPlace={actions.setSelectedPlaceId}
            onUpdateDay={canManagePlanning ? (dayId, input) => void actions.updateItineraryDay(dayId, input) : undefined}
            onSearchLocations={canManagePlanning ? actions.searchLocations : undefined}
            onCreatePlace={canManagePlanning ? actions.addPlace : undefined}
            onOptimize={() => void actions.optimizeRoute()}
            places={state.data.places}
            canManagePlanning={canManagePlanning}
          />
        </aside>
      </div>
    </DndContext>
  );
}

export default function TripPlanPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopPlanPage planner={planner} /> : <PlanScreen planner={planner} />;
}
