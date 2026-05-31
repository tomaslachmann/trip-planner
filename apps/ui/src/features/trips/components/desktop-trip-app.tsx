'use client';

import { BedDouble, HandCoins, LayoutGrid, Map, Plane, Route, Wallet } from 'lucide-react';
import Link from 'next/link';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';
import { CostsPanel } from './costs-panel';
import { TripButton } from './design-system';
import { ItineraryPanel } from './itinerary-panel';
import { MapScreen } from './map-screen';
import { MembersPanel } from './members-panel';
import { PlacesPanel } from './places-panel';
import { StayPanel } from './stay-panel';
import { TripBar } from './trip-bar';
import { useModal } from '../context/modal-context';
import { formatTripRange, routeDistanceKm } from '../lib/format';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';

const nav: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'map', label: 'Mapa', icon: Map },
  { key: 'plan', label: 'Plán', icon: Route },
  { key: 'stay', label: 'Ubytování', icon: BedDouble },
  { key: 'costs', label: 'Náklady', icon: Wallet },
  { key: 'settle', label: 'Vyrovnání', icon: HandCoins },
  { key: 'members', label: 'Členové', icon: LayoutGrid },
];

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

export function DesktopTripApp({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!overId) return;
    if (activeId.startsWith('place:')) {
      const dayId = overId.startsWith('day:') ? overId.replace('day:', '') : overId.startsWith('stop:') ? stopDayId(planner, overId.replace('stop:', '')) : undefined;
      await actions.addPlaceToItinerary(activeId.replace('place:', ''), dayId);
      actions.setActiveTab('plan');
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
    <div className="desktop-stage">
      <div className="desk">
        <aside className="desk-side">
          <div className="desk-brand">
            <div className="logo"><Plane size={18} /></div>
            <div className="col">
              <span className="semib">Plánovač cest</span>
              <span className="muted t-xs">Skupinové cestování</span>
            </div>
          </div>
          <div className="desk-tripsw">
            <div className="col flex1" style={{ minWidth: 0 }}>
              <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{state.selectedTrip?.name ?? 'Žádný trip'}</span>
              <span className="muted t-xs">{formatTripRange(state.selectedTrip)}</span>
            </div>
          </div>
          <nav className="desk-nav">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link className={cn('desk-lnk', state.activeTab === item.key && 'on')} href={actions.tripHref(item.key)} key={item.key} scroll={false}>
                  <Icon />{item.label}
                </Link>
              );
            })}
          </nav>
          <div className="spacer" />
          <div className="desk-user">
            <Avatar name={state.actorMember?.user.name ?? 'Ty'} />
            <div className="col">
              <span className="t-sm semib">{state.actorMember?.user.name ?? 'Ty'}</span>
              <span className="muted t-xs">{state.actorMember?.role === 'OWNER' ? 'vlastník' : 'člen'}</span>
            </div>
          </div>
        </aside>

        <main className="desk-main">
          <TripBar trip={state.selectedTrip} refreshing={state.loading} onRefresh={() => void actions.loadTrips()} />
          {state.message && <div className="badge red" style={{ margin: '10px 22px 0', justifyContent: 'center' }}>{state.message}</div>}
          <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
            {state.activeTab === 'map' && (
              <div className="desk-body">
                <MapScreen planner={planner} desktop />
                <aside className="desk-panel">
                  <div className="p18">
                    <div className="t-h2 mb8">{state.selectedPlace?.name ?? 'Vyber pin'}</div>
                    <span className="muted t-sm">{state.data.places.length} míst · {routeDistanceKm(state.data.routes)} km v uložených trasách</span>
                    <TripButton tone="primary" block className="mt16" type="button" onClick={() => state.selectedPlace && void actions.addPlaceToItinerary(state.selectedPlace.id)}>Přidat vybrané do itineráře</TripButton>
                    <TripButton tone="outline" block className="mt8" type="button" onClick={() => actions.setActiveTab('stay')}>Hledat ubytování</TripButton>
                  </div>
                </aside>
              </div>
            )}
            {state.activeTab === 'plan' && (
              <div className="desk-body">
                <div className="desk-scroll"><PlacesPanel places={state.data.places} selectedPlaceId={state.selectedPlaceId} onSelect={actions.setSelectedPlaceId} onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)} onEditPlace={(placeId) => { actions.setSelectedPlaceId(placeId); openModal('addPlace', true); }} /></div>
                <aside className="desk-panel"><ItineraryPanel days={state.data.itinerary} onOpenPlace={actions.setSelectedPlaceId} onUpdateDay={(dayId, input) => void actions.updateItineraryDay(dayId, input)} onOptimize={() => void actions.optimizeRoute()} /></aside>
              </div>
            )}
            {state.activeTab === 'stay' && (
              <div className="desk-body">
                <div className="desk-scroll"><StayPanel layout="desktop" trip={state.selectedTrip} stays={state.accommodations} savedPlaces={state.data.places.filter((place) => place.type === 'ACCOMMODATION')} actorUserId={state.actorUserId} selectedId={state.selectedAccommodationId} searching={state.searchingStay} onSearch={(data) => void actions.searchStays(data)} onSelect={actions.setSelectedAccommodationId} onSelectSaved={actions.setSelectedPlaceId} onSave={(stay) => void actions.saveAccommodation(stay)} onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)} onStatusChange={(placeId, status) => void actions.updateAccommodationStatus(placeId, status)} /></div>
              </div>
            )}
            {state.activeTab === 'costs' && (
              <div className="desk-body"><div className="desk-scroll maxw"><CostsPanel trip={state.selectedTrip} expenses={state.data.expenses} settlements={state.data.settlements} onAddExpense={(data) => void actions.addExpense(data)} onUpdateSettlementStatus={(settlement, status) => void actions.updateSettlementStatus(settlement, status)} /></div></div>
            )}
            {state.activeTab === 'settle' && (
              <div className="desk-body"><div className="desk-scroll maxw"><CostsPanel trip={state.selectedTrip} expenses={[]} settlements={state.data.settlements} onAddExpense={(data) => void actions.addExpense(data)} onUpdateSettlementStatus={(settlement, status) => void actions.updateSettlementStatus(settlement, status)} /></div></div>
            )}
            {state.activeTab === 'members' && (
              <div className="desk-body"><div className="desk-scroll maxw"><MembersPanel trip={state.selectedTrip} actorUserId={state.actorUserId} actorRole={state.actorMember?.role} onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)} onUpdateAvailability={(availabilityId, data) => void actions.updateAvailability(availabilityId, data)} onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)} onUpdateRole={(memberId, role) => void actions.updateTripMemberRole(memberId, role)} /></div></div>
            )}
          </DndContext>
        </main>
      </div>
    </div>
  );
}
