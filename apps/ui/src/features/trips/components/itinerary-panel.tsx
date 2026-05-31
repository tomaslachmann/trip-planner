import { CalendarPlus, CloudRain, Edit3, Gauge, GripVertical, Lock, Route, TimerReset } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ItineraryDay, ItineraryStop } from '../types';
import { categoryLabel } from './category';

type DayIntensity = 'CALM' | 'NORMAL' | 'INTENSE';

const intensityOptions: Array<{ value: DayIntensity; label: string }> = [
  { value: 'CALM', label: 'Klidný' },
  { value: 'NORMAL', label: 'Normál' },
  { value: 'INTENSE', label: 'Intenzivní' },
];

function daySummary(day: ItineraryDay) {
  const stops = day.stops ?? [];
  const bufferMinutes = day.bufferMinutes ?? 30;
  const plannedMinutes = stops.reduce((sum, stop) => {
    if (stop.startsAt && stop.endsAt) {
      return sum + Math.max(0, Math.round((new Date(stop.endsAt).getTime() - new Date(stop.startsAt).getTime()) / 60000));
    }
    return sum + 90;
  }, 0);
  const bufferTotal = Math.max(0, stops.length - 1) * bufferMinutes;
  const missingTimes = stops.filter((stop) => !stop.startsAt || !stop.endsAt).length;
  return { plannedMinutes, bufferMinutes, bufferTotal, missingTimes };
}

function hoursLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function SortableStop({ stop, onOpen, onEdit }: { stop: ItineraryStop; onOpen?: (placeId: string) => void; onEdit?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `stop:${stop.id}` });
  return (
    <Card
      ref={setNodeRef}
      className={cn('p-[14px] shadow-[var(--sh-sm)]', isDragging && 'dragging')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="row">
        <Button size="icon" variant="ghost" type="button" {...attributes} {...listeners} title="Přetáhnout zastávku"><GripVertical /></Button>
        <div className="col flex1 pressable" style={{ minWidth: 0 }} onClick={() => stop.placeId && onOpen?.(stop.placeId)}>
          <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.place?.name ?? 'Nepojmenovaná zastávka'}</span>
          <span className="muted t-xs mt4">{stop.startsAt ? new Date(stop.startsAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : 'Bez času'} · {categoryLabel(stop.place?.type)}</span>
        </div>
        {onEdit && (
          <Button size="icon" variant="ghost" type="button" onClick={onEdit} title="Upravit zastávku">
            <Edit3 />
          </Button>
        )}
      </div>
      {stop.note && <div className="muted t-xs mt8" style={{ paddingLeft: 48 }}>{stop.note}</div>}
    </Card>
  );
}

function DropDay({ day, children }: { day: ItineraryDay; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}` });
  return (
    <Card ref={setNodeRef} className={cn('p-[14px] shadow-[var(--sh-sm)] mb16', isOver && 'drop-on')}>
      {children}
    </Card>
  );
}

export function ItineraryPanel({
  days,
  onOpenPlace,
  onEditStop,
  onUpdateDay,
  onOptimize,
}: {
  days: ItineraryDay[];
  onOpenPlace: (placeId: string) => void;
  onEditStop?: (day: ItineraryDay, stop: ItineraryStop) => void;
  onUpdateDay?: (dayId: string, input: { intensity?: DayIntensity; rainPlan?: string | null; bufferMinutes?: number; locked?: boolean }) => void;
  onOptimize: () => void;
}) {
  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <div className="row between mb12">
        <div>
          <div className="t-h2">Itinerář</div>
          <div className="muted t-xs mt4">Přetahuj místa do dnů a měň pořadí zastávek.</div>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={onOptimize}><Route />Optimalizovat</Button>
      </div>

      {days.length === 0 && (
        <Card>
          <EmptyState icon={<CalendarPlus />} title="Itinerář je prázdný." text="Přetáhni sem místo nebo klepni u místa na Plán." />
        </Card>
      )}

      {days.map((day) => {
        const stops = day.stops ?? [];
        const summary = daySummary(day);
        const intensity = (day.intensity ?? 'NORMAL') as DayIntensity;
        return (
          <DropDay day={day} key={day.id}>
            <div className="row between mb12">
              <div className="col">
                <span className="t-h3">{day.title ?? new Date(day.date).toLocaleDateString()}</span>
                <span className="muted t-xs mt4">{new Date(day.date).toLocaleDateString('cs-CZ')} · {stops.length} zastávek</span>
              </div>
              <span className={`badge ${day.locked ? 'solid' : 'muted'}`}>{day.locked && <Lock />}{day.locked ? 'Zamčeno' : 'Návrh'}</span>
            </div>
            <div className="row g8 wrap mb12">
              <span className="badge muted"><Gauge />{intensityOptions.find((option) => option.value === intensity)?.label ?? 'Normál'}</span>
              <span className="badge muted"><TimerReset />buffer {summary.bufferMinutes} min</span>
              <span className="badge muted">{hoursLabel(summary.plannedMinutes + summary.bufferTotal)} celkem</span>
              {summary.missingTimes > 0 && <span className="badge amber">{summary.missingTimes} bez času</span>}
              {day.rainPlan && <span className="badge blue"><CloudRain />rain plan</span>}
            </div>
            {onUpdateDay && (
              <div className="col g8 mb12">
                <div className="chips">
                  {intensityOptions.map((option) => (
                    <button
                      className={`chip ${intensity === option.value ? 'on' : ''}`}
                      key={option.value}
                      type="button"
                      onClick={() => onUpdateDay(day.id, { intensity: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="chips">
                  {[15, 30, 45, 60].map((minutes) => (
                    <button
                      className={`chip ${(day.bufferMinutes ?? 30) === minutes ? 'on' : ''}`}
                      key={minutes}
                      type="button"
                      onClick={() => onUpdateDay(day.id, { bufferMinutes: minutes })}
                    >
                      {minutes} min buffer
                    </button>
                  ))}
                </div>
                <Input
                  defaultValue={day.rainPlan ?? ''}
                  placeholder="Rain plan / backup varianta pro špatné počasí"
                  onBlur={(event) => onUpdateDay(day.id, { rainPlan: event.currentTarget.value.trim() || null })}
                />
              </div>
            )}
            <SortableContext items={stops.map((stop) => `stop:${stop.id}`)} strategy={verticalListSortingStrategy}>
              <div className="col g8">
                {stops.map((stop) => <SortableStop key={stop.id} stop={stop} onOpen={onOpenPlace} onEdit={onEditStop ? () => onEditStop(day, stop) : undefined} />)}
              </div>
            </SortableContext>
            {stops.length === 0 && <div className="p14 muted t-sm center">Sem přetáhni místa</div>}
          </DropDay>
        );
      })}
    </div>
  );
}
