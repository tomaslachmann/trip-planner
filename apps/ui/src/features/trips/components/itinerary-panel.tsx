import { CalendarPlus, GripVertical, Lock, Route } from 'lucide-react';
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import type { ItineraryDay, ItineraryStop } from '../types';
import { categoryLabel } from './category';

function SortableStop({ stop, onOpen }: { stop: ItineraryStop; onOpen?: (placeId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `stop:${stop.id}` });
  return (
    <div
      ref={setNodeRef}
      className={cn('card p14 sh', isDragging && 'dragging')}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="row">
        <button className="iconbtn plain" type="button" {...attributes} {...listeners} title="Přetáhnout zastávku"><GripVertical /></button>
        <div className="col flex1 pressable" style={{ minWidth: 0 }} onClick={() => stop.placeId && onOpen?.(stop.placeId)}>
          <span className="t-h3" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.place?.name ?? 'Nepojmenovaná zastávka'}</span>
          <span className="muted t-xs mt4">{stop.startsAt ? new Date(stop.startsAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' }) : 'Bez času'} · {categoryLabel(stop.place?.type)}</span>
        </div>
      </div>
    </div>
  );
}

function DropDay({ day, children }: { day: ItineraryDay; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}` });
  return (
    <div ref={setNodeRef} className={cn('card pad sh mb16', isOver && 'drop-on')}>
      {children}
    </div>
  );
}

export function ItineraryPanel({
  days,
  onOpenPlace,
  onOptimize,
}: {
  days: ItineraryDay[];
  onOpenPlace: (placeId: string) => void;
  onOptimize: () => void;
}) {
  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <div className="row between mb12">
        <div>
          <div className="t-h2">Itinerář</div>
          <div className="muted t-xs mt4">Přetahuj místa do dnů a měň pořadí zastávek.</div>
        </div>
        <button className="btn outline sm" type="button" onClick={onOptimize}><Route />Optimalizovat</button>
      </div>

      {days.length === 0 && (
        <div className="card pad center muted">
          <div className="empty-ic jcc" style={{ margin: '0 auto 10px' }}><CalendarPlus /></div>
          <span className="t-sm">Přetáhni sem místo nebo klepni u místa na Plán.</span>
        </div>
      )}

      {days.map((day) => {
        const stops = day.stops ?? [];
        return (
          <DropDay day={day} key={day.id}>
            <div className="row between mb12">
              <div className="col">
                <span className="t-h3">{day.title ?? new Date(day.date).toLocaleDateString()}</span>
                <span className="muted t-xs mt4">{new Date(day.date).toLocaleDateString('cs-CZ')} · {stops.length} zastávek</span>
              </div>
              <span className={`badge ${day.locked ? 'solid' : 'muted'}`}>{day.locked && <Lock />}{day.locked ? 'Zamčeno' : 'Návrh'}</span>
            </div>
            <SortableContext items={stops.map((stop) => `stop:${stop.id}`)} strategy={verticalListSortingStrategy}>
              <div className="col g8">
                {stops.map((stop) => <SortableStop key={stop.id} stop={stop} onOpen={onOpenPlace} />)}
              </div>
            </SortableContext>
            {stops.length === 0 && <div className="p14 muted t-sm center">Sem přetáhni místa</div>}
          </DropDay>
        );
      })}
    </div>
  );
}
