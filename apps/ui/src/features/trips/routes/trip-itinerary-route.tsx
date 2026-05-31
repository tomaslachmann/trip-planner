'use client';

import { CalendarPlus, CloudRain, Edit3, Gauge, GripVertical, Plus, Route, TimerReset } from 'lucide-react';
import { useState } from 'react';
import { useModal } from '../context/modal-context';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { PlanScreen } from '../components/plan-screen';
import { categoryMeta } from '../components/category';
import { ItineraryStopSheet, type EditingItineraryStop } from '../components/itinerary-stop-sheet';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import type { ItineraryDay, ItineraryStop } from '../types';

function StopCard({ stop, onEdit }: { stop: ItineraryStop; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `stop:${stop.id}` });
  const meta = categoryMeta(stop.place?.type);
  const Icon = meta.icon;
  return (
    <div
      ref={setNodeRef}
      className={cn('card', isDragging && 'dragging')}
      style={{ padding: 10, background: 'var(--subtle)', transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="row g10">
        <span className="mono t-xs medi" style={{ width: 40, color: 'var(--muted-fg)', flexShrink: 0 }}>
          {stop.startsAt ? new Date(stop.startsAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
        <div
          className="lead-ic"
          style={{ width: 28, height: 28, borderRadius: 8, background: `var(--c-${meta.cls}-bg)`, color: `var(--c-${meta.cls})`, flexShrink: 0 }}
        >
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
    </div>
  );
}

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

function DayColumn({ day, onAdd, onEditStop, onUpdateDay }: { day: ItineraryDay; onAdd: () => void; onEditStop: (stop: ItineraryStop) => void; onUpdateDay: (input: { intensity?: DayIntensity; bufferMinutes?: number; rainPlan?: string | null }) => void }) {
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
      <SortableContext items={stops.map((s) => `stop:${s.id}`)} strategy={verticalListSortingStrategy}>
        <div className="col g8">
          {stops.map((stop) => <StopCard key={stop.id} stop={stop} onEdit={() => onEditStop(stop)} />)}
        </div>
      </SortableContext>
      {stops.length === 0 && (
        <div className="center muted t-xs" style={{ padding: '12px 0' }}>Přetáhni sem místa</div>
      )}
      <button
        className="btn ghost sm"
        style={{ border: '1px dashed var(--border-2)', width: '100%', marginTop: 8 }}
        type="button"
        onClick={onAdd}
      >
        <Plus size={14} />Přidat zastávku
      </button>
    </Card>
  );
}

function DesktopItinerary({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  const [editing, setEditing] = useState<EditingItineraryStop | null>(null);

  async function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (!overId || !activeId.startsWith('stop:') || !overId.startsWith('stop:')) return;
    const activeStopId = activeId.replace('stop:', '');
    const overStopId = overId.replace('stop:', '');
    const day = state.data.itinerary.find((d) => (d.stops ?? []).some((s) => s.id === activeStopId));
    if (!day) return;
    const stops = day.stops ?? [];
    const oldIdx = stops.findIndex((s) => s.id === activeStopId);
    const newIdx = stops.findIndex((s) => s.id === overStopId);
    if (oldIdx >= 0 && newIdx >= 0 && oldIdx !== newIdx) {
      await actions.reorderStops(day.id, arrayMove(stops, oldIdx, newIdx).map((s) => s.id));
    }
  }

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
            <EmptyState
              icon={<CalendarPlus />}
              title="Itinerář je prázdný."
              text="Přetáhni místa z panelu Místa nebo přidej zastávky ručně."
            />
          </Card>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
              {state.data.itinerary.map((day) => (
                <DayColumn
                  key={day.id}
                  day={day}
                  onAdd={() => openModal('addItinerary', false, { dayId: day.id })}
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
            members={state.selectedTrip?.members ?? []}
            onClose={() => setEditing(null)}
            onUpdate={(stopId, input) => void actions.updateItineraryStop(stopId, input)}
            onDelete={(stopId) => void actions.deleteItineraryStop(stopId)}
          />
        )}
      </div>
    </div>
  );
}

export function TripItineraryRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="plan">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<PlanScreen planner={planner} forcedTab="itinerary" />}
          desktop={<DesktopItinerary planner={planner} />}
        />
      )}
    </TripRouteRuntime>
  );
}
