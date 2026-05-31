'use client';

import { useEffect, useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { CostsPanel } from './costs-panel';
import { ItineraryPanel } from './itinerary-panel';
import { MembersPanel } from './members-panel';
import { PlacesPanel } from './places-panel';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StayPanel } from './stay-panel';
import { TripBar } from './trip-bar';
import { ItineraryStopSheet, type EditingItineraryStop } from './itinerary-stop-sheet';
import { useModal } from '../context/modal-context';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';

type PlanView = 'places' | 'itinerary' | 'stay';

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

export function PlanScreen({ planner, forcedTab, mobile = false }: { planner: TripPlannerController; forcedTab?: TabKey; mobile?: boolean }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const [planView, setPlanView] = useState<PlanView>('places');
  const [editingStop, setEditingStop] = useState<EditingItineraryStop | null>(null);

  useEffect(() => {
    if (forcedTab === 'stay') setPlanView('stay');
    if (forcedTab === 'itinerary') setPlanView('itinerary');
    if (forcedTab === 'plan' || forcedTab === 'places') setPlanView('places');
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
        <CostsPanel
          trip={state.selectedTrip}
          expenses={state.data.expenses}
          settlements={state.data.settlements}
          onAddExpense={(data) => void actions.addExpense(data)}
          onUpdateSettlementStatus={(settlement, status) => void actions.updateSettlementStatus(settlement, status)}
          onEditExpense={(expenseId) => {
            actions.setSelectedExpenseId(expenseId);
            openModal('addExpense', true);
          }}
          mobile={mobile}
        />
      </div>
    );
  }

  if (forcedTab === 'members') {
    return (
      <div className="screen">
        <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
        <MembersPanel
          trip={state.selectedTrip}
          actorUserId={state.actorUserId}
          actorRole={state.actorMember?.role}
          onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)}
          onUpdateAvailability={(availabilityId, data) => void actions.updateAvailability(availabilityId, data)}
          onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)}
          onUpdateRole={(memberId, role) => void actions.updateTripMemberRole(memberId, role)}
          onUpdatePlanning={(memberId, input) => void actions.updateMemberPlanning(memberId, input)}
        />
      </div>
    );
  }

  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
      <div className="px18" style={{ paddingTop: 10, paddingBottom: 2, flex: '0 0 auto' }}>
        <SegmentedControl
          value={planView}
          onValueChange={setPlanView}
          options={[
            { value: 'places', label: 'Místa' },
            { value: 'itinerary', label: 'Itinerář' },
            { value: 'stay', label: 'Ubytování' },
          ]}
        />
      </div>
      <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <div className="col flex1 rel" style={{ minHeight: 0 }}>
          {planView === 'places' && (
            <PlacesPanel
              places={state.data.places}
              members={state.selectedTrip?.members ?? []}
              actorUserId={state.actorUserId}
              actorRole={state.actorMember?.role}
              selectedPlaceId={state.selectedPlaceId}
              onSelect={actions.setSelectedPlaceId}
              onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)}
              onStatusChange={(placeId, status) => void actions.updatePlaceStatus(placeId, status)}
              onEditPlace={(placeId) => {
                actions.setSelectedPlaceId(placeId);
                openModal('addPlace', true);
              }}
            />
          )}
          {planView === 'itinerary' && (
            <ItineraryPanel
              days={state.data.itinerary}
              weather={state.data.weather}
              onOpenPlace={actions.setSelectedPlaceId}
              onEditStop={(day, stop) => setEditingStop({ day, stop })}
              actorTripMemberId={state.actorMember?.id}
              onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)}
              onUpdateDay={(dayId, input) => void actions.updateItineraryDay(dayId, input)}
              onOptimize={() => void actions.optimizeRoute()}
              routeCapabilities={state.data.routeCapabilities}
            />
          )}
          {planView === 'stay' && (
            <StayPanel
              trip={state.selectedTrip}
              stays={state.accommodations}
              savedPlaces={state.data.places.filter((place) => place.type === 'ACCOMMODATION')}
              allPlaces={state.data.places}
              actorUserId={state.actorUserId}
              selectedId={state.selectedAccommodationId}
              searching={state.searchingStay}
              onSearch={(data) => void actions.searchStays(data)}
              onSelect={actions.setSelectedAccommodationId}
              onSelectSaved={actions.setSelectedPlaceId}
              onSave={(stay) => void actions.saveAccommodation(stay)}
              onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)}
              onStatusChange={(placeId, status) => void actions.updateAccommodationStatus(placeId, status)}
            />
          )}
        </div>
      </DndContext>
      {editingStop && (
        <ItineraryStopSheet
          key={editingStop.stop.id}
          editing={editingStop}
          actorTripMemberId={state.actorMember?.id}
          members={state.selectedTrip?.members ?? []}
          onClose={() => setEditingStop(null)}
          onUpdate={(stopId, input) => void actions.updateItineraryStop(stopId, input)}
          onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)}
          onDelete={(stopId) => void actions.deleteItineraryStop(stopId)}
        />
      )}
    </div>
  );
}
