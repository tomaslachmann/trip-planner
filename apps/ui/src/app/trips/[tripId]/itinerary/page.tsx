'use client';

import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarPlus, CloudRain, Edit3, Gauge, GripVertical, Plus, Route, TimerReset, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { ItineraryPanel } from '@/features/trips/components/itinerary-panel';
import { ItineraryStopSheet, type EditingItineraryStop } from '@/features/trips/components/itinerary-stop-sheet';
import { TripBar } from '@/features/trips/components/trip-bar';
import { categoryMeta } from '@/features/trips/components/category';
import { useModal } from '@/features/trips/context/modal-context';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';
import type { ItineraryDay, ItineraryStop } from '@/features/trips/types';

type DayIntensity = 'CALM' | 'NORMAL' | 'INTENSE';
type AttendanceStatus = 'GOING' | 'MAYBE' | 'NO';

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

function StopCard({
  stop,
  actorTripMemberId,
  onAttendance,
  onEdit,
}: {
  stop: ItineraryStop;
  actorTripMemberId?: string;
  onAttendance: (stopId: string, status: AttendanceStatus) => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `stop:${stop.id}` });
  const meta = categoryMeta(stop.place?.type);
  const Icon = meta.icon;
  const participants = stop.participants ?? [];
  const going = participants.filter((participant) => !participant.status || participant.status === 'GOING').length;
  const maybe = participants.filter((participant) => participant.status === 'MAYBE').length;
  const no = participants.filter((participant) => participant.status === 'NO').length;
  const myStatus = participants.find((participant) => participant.tripMemberId === actorTripMemberId)?.status ?? 'GOING';

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
        <span className="t-sm semib flex1" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stop.place?.name ?? 'Zastávka'}
        </span>
        <Button size="icon" variant="ghost" type="button" onClick={onEdit} style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }} aria-label="Upravit zastávku">
          <Edit3 size={14} />
        </Button>
        <Button size="icon" variant="ghost" type="button" {...attributes} {...listeners} style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }}>
          <GripVertical size={14} />
        </Button>
      </div>
      {stop.note && <div className="muted t-xs mt8" style={{ paddingLeft: 50 }}>{stop.note}</div>}
      <div className="row g6 mt8 wrap" style={{ paddingLeft: 50 }}>
        <span className="badge muted"><Users size={12} />{going} jde</span>
        {maybe > 0 && <span className="badge amber">{maybe} možná</span>}
        {no > 0 && <span className="badge red">{no} nejde</span>}
      </div>
      {actorTripMemberId && (
        <div className="row g6 mt8 wrap" style={{ paddingLeft: 50 }}>
          {(['GOING', 'MAYBE', 'NO'] as AttendanceStatus[]).map((status) => (
            <Button key={status} size="sm" variant={myStatus === status ? 'secondary' : 'outline'} type="button" onClick={() => onAttendance(stop.id, status)}>
              {status === 'GOING' ? 'Jdu' : status === 'MAYBE' ? 'Možná' : 'Nejdu'}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function DayColumn({
  day,
  actorTripMemberId,
  onAdd,
  onAttendance,
  onEditStop,
  onUpdateDay,
}: {
  day: ItineraryDay;
  actorTripMemberId?: string;
  onAdd: () => void;
  onAttendance: (stopId: string, status: AttendanceStatus) => void;
  onEditStop: (stop: ItineraryStop) => void;
  onUpdateDay: (input: { intensity?: DayIntensity; bufferMinutes?: number; rainPlan?: string | null }) => void;
}) {
  const stops = day.stops ?? [];
  const date = new Date(day.date);
  const dateStr = date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const intensity = (day.intensity ?? 'NORMAL') as DayIntensity;

  return (
    <Card className="shadow-[var(--sh-sm)] p-[16px]" style={{ minWidth: 266, width: 266, flexShrink: 0, alignSelf: 'flex-start' }}>
      <div className="row g8 mb4">
        <div style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--primary)', flexShrink: 0 }} />
        <span className="t-h3">{day.title ?? `Den ${day.id.slice(-2)}`}</span>
      </div>
      <span className="faint t-xs" style={{ display: 'block', marginBottom: 12 }}>{dateStr} · {stops.length} zastávek</span>
      <div className="row g6 wrap mb10">
        <span className="badge muted"><Gauge size={12} />{intensity === 'CALM' ? 'Klidný' : intensity === 'INTENSE' ? 'Intenzivní' : 'Normál'}</span>
        <span className="badge muted"><TimerReset size={12} />{day.bufferMinutes ?? 30}m</span>
        <span className="badge muted">{compactHours(dayMinutes(day))}</span>
        {day.rainPlan && <span className="badge blue"><CloudRain size={12} />rain</span>}
      </div>
      <div className="chips mb8">
        {(['CALM', 'NORMAL', 'INTENSE'] as DayIntensity[]).map((value) => (
          <button className={`chip ${intensity === value ? 'on' : ''}`} key={value} type="button" onClick={() => onUpdateDay({ intensity: value })}>
            {value === 'CALM' ? 'Klid' : value === 'INTENSE' ? 'Hodně' : 'Normál'}
          </button>
        ))}
      </div>
      <SortableContext items={stops.map((stop) => `stop:${stop.id}`)} strategy={verticalListSortingStrategy}>
        <div className="col g8">
          {stops.map((stop) => <StopCard key={stop.id} stop={stop} actorTripMemberId={actorTripMemberId} onAttendance={onAttendance} onEdit={() => onEditStop(stop)} />)}
        </div>
      </SortableContext>
      {stops.length === 0 && <div className="center muted t-xs" style={{ padding: '12px 0' }}>Přetáhni sem místa</div>}
      <button className="btn ghost sm" style={{ border: '1px dashed var(--border-2)', width: '100%', marginTop: 8 }} type="button" onClick={onAdd}>
        <Plus size={14} />Přidat zastávku
      </button>
    </Card>
  );
}

function stopDayId(planner: TripPlannerController, stopId: string) {
  return planner.state.data.itinerary.find((day) => (day.stops ?? []).some((stop) => stop.id === stopId))?.id;
}

function useItineraryDrag(planner: TripPlannerController) {
  const { state, actions } = planner;
  return async function handleDragEnd(event: DragEndEvent) {
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
  const handleDragEnd = useItineraryDrag(planner);

  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <div className="row between mb16" style={{ maxWidth: 1080 }}>
          <h1 className="desk-h">Itinerář</h1>
          <div className="row g10">
            <Button variant="outline" type="button" onClick={() => openModal('addItinerary')}>
              <Plus size={16} />Přidat zastávku
            </Button>
            <Button type="button" onClick={() => void actions.optimizeRoute()}>
              <Route size={16} />Optimalizovat
            </Button>
          </div>
        </div>

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
                  actorTripMemberId={state.actorMember?.id}
                  onAdd={() => openModal('addItinerary', false, { dayId: day.id })}
                  onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)}
                  onEditStop={(stop) => setEditing({ day, stop })}
                  onUpdateDay={(input) => void actions.updateItineraryDay(day.id, input)}
                />
              ))}
            </div>
          </DndContext>
        )}
        {editing && (
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
    </div>
  );
}

function MobileItineraryPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const [editing, setEditing] = useState<EditingItineraryStop | null>(null);
  const handleDragEnd = useItineraryDrag(planner);

  return (
    <div className="screen">
      <TripBar trip={state.selectedTrip} />
      <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
        <ItineraryPanel
          days={state.data.itinerary}
          weather={state.data.weather}
          routeCapabilities={state.data.routeCapabilities}
          onOpenPlace={actions.setSelectedPlaceId}
          onEditStop={(day, stop) => setEditing({ day, stop })}
          actorTripMemberId={state.actorMember?.id}
          onAttendance={(stopId, status) => void actions.updateStopAttendance(stopId, status)}
          onUpdateDay={(dayId, input) => void actions.updateItineraryDay(dayId, input)}
          onOptimize={() => void actions.optimizeRoute()}
        />
      </DndContext>
      {editing && (
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
