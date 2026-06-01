'use client';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarPlus, CloudRain, Edit3, Gauge, GripVertical, Lock, Plus, Route, TimerReset, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { ItineraryDaySettingsSheet } from '@/features/trips/components/itinerary-day-settings-sheet';
import { ItineraryPanel } from '@/features/trips/components/itinerary-panel';
import { ItineraryStopSheet, type EditingItineraryStop } from '@/features/trips/components/itinerary-stop-sheet';
import { TripBar } from '@/features/trips/components/trip-bar';
import { categoryMeta } from '@/features/trips/components/category';
import { useModal } from '@/features/trips/context/modal-context';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';
import { canManageTrip } from '@/features/trips/lib/permissions';
import type { ItineraryDay, ItineraryStop, TripWeather } from '@/features/trips/types';

type DayIntensity = 'CALM' | 'NORMAL' | 'INTENSE';

function dayMinutes(day: ItineraryDay) {
  const stops = day.stops ?? [];
  const planned = stops.reduce((sum, stop) => {
    if (!stop.startsAt || !stop.endsAt) return sum + 90;
    return sum + Math.max(0, Math.round((new Date(stop.endsAt).getTime() - new Date(stop.startsAt).getTime()) / 60000));
  }, 0);
  return planned + Math.max(0, stops.length - 1) * (day.bufferMinutes ?? 30);
}

function compactHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${rest}m`;
}

function weatherForDay(weather: TripWeather | null | undefined, day: ItineraryDay) {
  const date = day.date.slice(0, 10);
  const stopPlaceIds = new Set((day.stops ?? []).map((stop) => stop.placeId).filter(Boolean));
  return (weather?.days ?? []).filter((item) => item.date === date && (stopPlaceIds.size === 0 || stopPlaceIds.has(item.pointId)));
}

function weatherSummary(weather: TripWeather | null | undefined, day: ItineraryDay) {
  const forecasts = weatherForDay(weather, day);
  if (!forecasts.length) return null;
  const rain = Math.max(...forecasts.map((item) => item.precipitationProbabilityMax ?? 0));
  const max = Math.max(...forecasts.map((item) => item.temperatureMax ?? Number.NEGATIVE_INFINITY));
  const min = Math.min(...forecasts.map((item) => item.temperatureMin ?? Number.POSITIVE_INFINITY));
  return {
    rain,
    temperature: Number.isFinite(max) && Number.isFinite(min) ? `${Math.round(min)}-${Math.round(max)} °C` : undefined,
  };
}

function StopCard({
  stop,
  onEdit,
  onOpen,
  canManagePlanning,
}: {
  stop: ItineraryStop;
  onEdit?: () => void;
  onOpen?: (placeId: string) => void;
  canManagePlanning: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `stop:${stop.id}` });
  const meta = categoryMeta(stop.place?.type);
  const Icon = meta.icon;
  const participants = stop.participants ?? [];
  const going = participants.filter((participant) => !participant.status || participant.status === 'GOING').length;
  const maybe = participants.filter((participant) => participant.status === 'MAYBE').length;
  const no = participants.filter((participant) => participant.status === 'NO').length;

  return (
    <div
      ref={setNodeRef}
      className={cn('card', isDragging && 'dragging')}
      style={{ padding: 10, background: 'var(--subtle)', transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="row g10">
        <span className="mono t-xs medi" style={{ width: 40, color: 'var(--muted-fg)', flexShrink: 0 }}>
          {stop.startsAt ? new Date(stop.startsAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>
        <div className="lead-ic" style={{ width: 28, height: 28, borderRadius: 8, background: `var(--c-${meta.cls}-bg)`, color: `var(--c-${meta.cls})`, flexShrink: 0 }}>
          <Icon size={14} />
        </div>
        <button
          className="t-sm semib flex1 pressable"
          type="button"
          onClick={() => stop.placeId && onOpen?.(stop.placeId)}
          style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: 0, background: 'transparent', color: 'inherit', padding: 0, textAlign: 'left' }}
        >
          {stop.place?.name ?? 'Zastávka'}
        </button>
        {onEdit && (
          <Button size="icon" variant="ghost" type="button" onClick={onEdit} style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }} aria-label="Upravit zastávku">
            <Edit3 size={14} />
          </Button>
        )}
        {canManagePlanning && (
          <Button size="icon" variant="ghost" type="button" {...attributes} {...listeners} style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }}>
            <GripVertical size={14} />
          </Button>
        )}
      </div>
      {stop.note && <div className="muted t-xs mt8" style={{ paddingLeft: 50 }}>{stop.note}</div>}
      <div className="row g6 mt8 wrap" style={{ paddingLeft: 50 }}>
        <span className="badge muted"><Users size={12} />{going} jde</span>
        {maybe > 0 && <span className="badge amber">{maybe} možná</span>}
        {no > 0 && <span className="badge red">{no} nejde</span>}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  onAdd,
  onEditStop,
  onEditDay,
  onOpenPlace,
  weather,
  canManagePlanning,
}: {
  day: ItineraryDay;
  onAdd?: () => void;
  onEditStop: (stop: ItineraryStop) => void;
  onEditDay: (day: ItineraryDay) => void;
  onOpenPlace: (placeId: string) => void;
  weather?: TripWeather | null;
  canManagePlanning: boolean;
}) {
  const stops = day.stops ?? [];
  const date = new Date(day.date);
  const dateStr = date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const intensity = (day.intensity ?? 'NORMAL') as DayIntensity;
  const forecast = weatherSummary(weather, day);
  const missingTimes = stops.filter((stop) => !stop.startsAt || !stop.endsAt).length;

  return (
    <Card className="shadow-[var(--sh-sm)] p-[16px]" style={{ minWidth: 320, width: 320, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div className="row between mb4">
        <div className="row g8" style={{ minWidth: 0 }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--primary)', flexShrink: 0 }} />
          <span className="t-h3 ellipsis">{day.title ?? `Den ${day.id.slice(-2)}`}</span>
        </div>
        <div className="row g6">
          <span className={`badge ${day.locked ? 'solid' : 'muted'}`}>{day.locked && <Lock size={12} />}{day.locked ? 'Zamčeno' : 'Návrh'}</span>
          {canManagePlanning && (
            <Button size="icon" variant="ghost" type="button" onClick={() => onEditDay(day)} style={{ width: 28, height: 28 }} aria-label="Upravit den">
              <Edit3 size={14} />
            </Button>
          )}
        </div>
      </div>
      <span className="faint t-xs" style={{ display: 'block', marginBottom: 12 }}>{dateStr} · {stops.length} zastávek</span>
      <div className="row g6 wrap mb10">
        {day.basePlace && <span className="badge muted">Místo dne: {day.basePlace.name}</span>}
        <span className="badge muted"><Gauge size={12} />{intensity === 'CALM' ? 'Klidný' : intensity === 'INTENSE' ? 'Intenzivní' : 'Normál'}</span>
        <span className="badge muted"><TimerReset size={12} />rezerva {day.bufferMinutes ?? 30} min</span>
        <span className="badge muted">{compactHours(dayMinutes(day))} celkem</span>
        {forecast && <span className={`badge ${forecast.rain >= 60 ? 'amber' : 'muted'}`}>{forecast.temperature ?? 'Počasí'} · déšť {forecast.rain}%</span>}
        {missingTimes > 0 && <span className="badge amber">{missingTimes} bez času</span>}
        {day.rainPlan && <span className="badge blue"><CloudRain size={12} />plán do deště</span>}
      </div>
      <SortableContext items={stops.map((stop) => `stop:${stop.id}`)} strategy={verticalListSortingStrategy}>
        <div className="col g8">
          {stops.map((stop) => <StopCard key={stop.id} stop={stop} onEdit={canManagePlanning ? () => onEditStop(stop) : undefined} onOpen={onOpenPlace} canManagePlanning={canManagePlanning} />)}
        </div>
      </SortableContext>
      {stops.length === 0 && <div className="center muted t-xs" style={{ padding: '12px 0' }}>{canManagePlanning ? 'Přetáhni sem místa' : 'Zatím bez zastávek'}</div>}
      {canManagePlanning && onAdd && (
        <button className="btn ghost sm" style={{ border: '1px dashed var(--border-2)', width: '100%', marginTop: 8 }} type="button" onClick={onAdd}>
          <Plus size={14} />Přidat zastávku
        </button>
      )}
    </Card>
  );
}

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

function useItineraryDrag(planner: TripPlannerController, canManagePlanning: boolean) {
  const { state, actions } = planner;
  return async function handleDragEnd(event: DragEndEvent) {
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
  };
}

function DesktopItineraryPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const [editing, setEditing] = useState<EditingItineraryStop | null>(null);
  const [editingDay, setEditingDay] = useState<ItineraryDay | null>(null);
  const canManagePlanning = canManageTrip(state.actorMember?.role);
  const handleDragEnd = useItineraryDrag(planner, canManagePlanning);
  const transitAvailable = state.data.routeCapabilities?.modes.TRANSIT === true;

  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <div className="row between mb16" style={{ maxWidth: 1080 }}>
          <h1 className="desk-h">Itinerář</h1>
          <div className="row g10">
            <span className={`badge ${transitAvailable ? 'green' : 'muted'}`}>MHD {transitAvailable ? 'zapnutá' : 'není'}</span>
            {canManagePlanning && (
              <>
                <Button variant="outline" type="button" onClick={() => openModal('addItinerary')}>
                  <Plus size={16} />Přidat zastávku
                </Button>
                <Button type="button" onClick={() => void actions.optimizeRoute()}>
                  <Route size={16} />Optimalizovat
                </Button>
              </>
            )}
          </div>
        </div>
        {!transitAvailable && state.data.routeCapabilities?.transitNote && (
          <Card className="p-[10px] mb12 shadow-[var(--sh-sm)]" style={{ maxWidth: 1080 }}>
            <span className="muted t-xs">{state.data.routeCapabilities.transitNote}</span>
          </Card>
        )}

        {state.data.itinerary.length === 0 ? (
          <Card>
            <EmptyState icon={<CalendarPlus />} title="Itinerář je prázdný." text="Přetáhni místa z panelu Místa nebo přidej zastávky ručně." />
          </Card>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
              {state.data.itinerary.map((day) => (
                <DayColumn
                  key={day.id}
                  day={day}
                  onAdd={() => openModal('addItinerary', false, { dayId: day.id })}
                  onEditStop={(stop) => setEditing({ day, stop })}
                  onEditDay={setEditingDay}
                  onOpenPlace={actions.setSelectedPlaceId}
                  weather={state.data.weather}
                  canManagePlanning={canManagePlanning}
                />
              ))}
            </div>
          </DndContext>
        )}
        {canManagePlanning && editing && (
          <ItineraryStopSheet
            key={editing.stop.id}
            editing={editing}
            actorTripMemberId={state.actorMember?.id}
            members={state.selectedTrip?.members ?? []}
            onClose={() => setEditing(null)}
            onUpdate={(stopId, input) => void actions.updateItineraryStop(stopId, input)}
            onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)}
            onDelete={(stopId) => void actions.deleteItineraryStop(stopId)}
          />
        )}
        {canManagePlanning && editingDay && (
          <ItineraryDaySettingsSheet
            day={editingDay}
            places={state.data.places}
            onSearchLocations={actions.searchLocations}
            onCreatePlace={actions.addPlace}
            onClose={() => setEditingDay(null)}
            onUpdate={(dayId, input) => void actions.updateItineraryDay(dayId, input)}
          />
        )}
      </div>
    </div>
  );
}

function MobileItineraryPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const [editing, setEditing] = useState<EditingItineraryStop | null>(null);
  const canManagePlanning = canManageTrip(state.actorMember?.role);
  const handleDragEnd = useItineraryDrag(planner, canManagePlanning);

  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} />
      <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <ItineraryPanel
          days={state.data.itinerary}
          weather={state.data.weather}
          routeCapabilities={state.data.routeCapabilities}
          onOpenPlace={actions.setSelectedPlaceId}
          onEditStop={canManagePlanning ? (day, stop) => setEditing({ day, stop }) : undefined}
          onUpdateDay={canManagePlanning ? (dayId, input) => void actions.updateItineraryDay(dayId, input) : undefined}
          onSearchLocations={canManagePlanning ? actions.searchLocations : undefined}
          onCreatePlace={canManagePlanning ? actions.addPlace : undefined}
          onOptimize={() => void actions.optimizeRoute()}
          places={state.data.places}
          canManagePlanning={canManagePlanning}
        />
      </DndContext>
      {canManagePlanning && editing && (
        <ItineraryStopSheet
          key={editing.stop.id}
          editing={editing}
          actorTripMemberId={state.actorMember?.id}
          members={state.selectedTrip?.members ?? []}
          onClose={() => setEditing(null)}
          onUpdate={(stopId, input) => void actions.updateItineraryStop(stopId, input)}
          onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)}
          onDelete={(stopId) => void actions.deleteItineraryStop(stopId)}
        />
      )}
    </div>
  );
}

export default function TripItineraryPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopItineraryPage planner={planner} /> : <MobileItineraryPage planner={planner} />;
}
