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
import type { ItineraryDay, ItineraryStop, TripWeather } from '../types';
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
    label: forecasts[0].pointLabel,
  };
}

function attendanceCounts(stop: ItineraryStop) {
  const participants = stop.participants ?? [];
  return {
    going: participants.filter((participant) => (participant.status ?? 'GOING') === 'GOING').length,
    maybe: participants.filter((participant) => participant.status === 'MAYBE').length,
    no: participants.filter((participant) => participant.status === 'NO').length,
  };
}

function SortableStop({
  stop,
  actorTripMemberId,
  onOpen,
  onEdit,
  onAttendance,
}: {
  stop: ItineraryStop;
  actorTripMemberId?: string;
  onOpen?: (placeId: string) => void;
  onEdit?: () => void;
  onAttendance?: (stopId: string, status: 'GOING' | 'MAYBE' | 'NO') => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `stop:${stop.id}` });
  const counts = attendanceCounts(stop);
  const myAttendance = stop.participants?.find((participant) => participant.tripMemberId === actorTripMemberId)?.status ?? 'GOING';
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
      <div className="row g6 wrap mt10" style={{ paddingLeft: 48 }}>
        <span className="badge green">Jde {counts.going}</span>
        <span className="badge muted">Možná {counts.maybe}</span>
        <span className="badge red">Ne {counts.no}</span>
        {onAttendance && (
          <div className="row g4">
            {(['GOING', 'MAYBE', 'NO'] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={myAttendance === status ? 'default' : 'outline'}
                type="button"
                onClick={() => onAttendance(stop.id, status)}
              >
                {status === 'GOING' ? 'Jdu' : status === 'MAYBE' ? 'Možná' : 'Nejdu'}
              </Button>
            ))}
          </div>
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
  weather,
  onOpenPlace,
  onEditStop,
  actorTripMemberId,
  onAttendance,
  onUpdateDay,
  onOptimize,
}: {
  days: ItineraryDay[];
  weather?: TripWeather | null;
  onOpenPlace: (placeId: string) => void;
  onEditStop?: (day: ItineraryDay, stop: ItineraryStop) => void;
  actorTripMemberId?: string;
  onAttendance?: (stopId: string, status: 'GOING' | 'MAYBE' | 'NO') => void;
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
        const forecast = weatherSummary(weather, day);
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
              {forecast && <span className={`badge ${forecast.rain >= 60 ? 'amber' : 'muted'}`}>{forecast.temperature ?? 'Počasí'} · déšť {forecast.rain}%</span>}
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
                {stops.map((stop) => (
                  <SortableStop
                    key={stop.id}
                    stop={stop}
                    actorTripMemberId={actorTripMemberId}
                    onOpen={onOpenPlace}
                    onEdit={onEditStop ? () => onEditStop(day, stop) : undefined}
                    onAttendance={onAttendance}
                  />
                ))}
              </div>
            </SortableContext>
            {stops.length === 0 && <div className="p14 muted t-sm center">Sem přetáhni místa</div>}
          </DropDay>
        );
      })}
    </div>
  );
}
