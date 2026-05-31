'use client';

import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDestructiveAction } from './confirm-destructive-action';
import type { ItineraryDay, ItineraryStop } from '../types';
import type { TripMember } from '../types';

export type EditingItineraryStop = { day: ItineraryDay; stop: ItineraryStop };
type AttendanceChoice = 'GOING' | 'MAYBE' | 'NO' | 'OUT';

function toTimeInput(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function dayTimeToIso(day: ItineraryDay, value: string) {
  if (!value) return null;
  return new Date(`${day.date.slice(0, 10)}T${value}:00`).toISOString();
}

export function ItineraryStopSheet({
  editing,
  actorTripMemberId,
  onClose,
  onUpdate,
  onAttendance,
  onDelete,
  members,
}: {
  editing: EditingItineraryStop;
  actorTripMemberId?: string;
  onClose: () => void;
  onUpdate: (stopId: string, input: { startsAt?: string | null; endsAt?: string | null; note?: string | null; tripMemberIds?: string[] }) => void | Promise<void>;
  onAttendance?: (stopId: string, status: 'GOING' | 'MAYBE' | 'NO') => void | Promise<void>;
  onDelete: (stopId: string) => void;
  members: TripMember[];
}) {
  const initialAttendance = useMemo(() => {
    const participantById = new Map((editing.stop.participants ?? []).map((participant) => [participant.tripMemberId, participant.status ?? 'GOING']));
    const hasParticipants = participantById.size > 0;
    return Object.fromEntries(members.map((member) => [member.id, hasParticipants ? (participantById.get(member.id) ?? 'OUT') : 'GOING'])) as Record<string, AttendanceChoice>;
  }, [editing.stop.participants, members]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceChoice>>(initialAttendance);
  const [startsAtTime, setStartsAtTime] = useState(toTimeInput(editing.stop.startsAt));
  const [endsAtTime, setEndsAtTime] = useState(toTimeInput(editing.stop.endsAt));
  const selectedParticipantIds = members.filter((member) => attendance[member.id] !== 'OUT').map((member) => member.id);
  const hasParticipants = members.length === 0 || selectedParticipantIds.length > 0;
  const durationMinutes = startsAtTime && endsAtTime
    ? Math.max(0, Math.round((new Date(`${editing.day.date.slice(0, 10)}T${endsAtTime}:00`).getTime() - new Date(`${editing.day.date.slice(0, 10)}T${startsAtTime}:00`).getTime()) / 60000))
    : null;

  function setEndByDuration(minutes: number) {
    if (!startsAtTime) return;
    const next = new Date(`${editing.day.date.slice(0, 10)}T${startsAtTime}:00`);
    next.setMinutes(next.getMinutes() + minutes);
    setEndsAtTime(next.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', hour12: false }));
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <div className="grabber" />
        <div className="sheet-head">
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Zrušit</Button>
          <SheetTitle className="t-h3">Upravit zastávku</SheetTitle>
          <span aria-hidden="true" style={{ width: 64 }} />
        </div>
        <form
          className="px18"
          style={{ paddingBottom: 18 }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void Promise.resolve(onUpdate(editing.stop.id, {
              startsAt: dayTimeToIso(editing.day, startsAtTime),
              endsAt: dayTimeToIso(editing.day, endsAtTime),
              note: String(data.get('note') ?? '').trim() || null,
              tripMemberIds: selectedParticipantIds,
            })).then(async () => {
              const actorStatus = actorTripMemberId ? attendance[actorTripMemberId] : undefined;
              if (onAttendance && actorStatus && actorStatus !== 'OUT') await Promise.resolve(onAttendance(editing.stop.id, actorStatus));
              onClose();
            });
          }}
        >
          <div className="row g12">
            <div className="flex1">
              <Label htmlFor="stopStartsAt">Čas začátku</Label>
              <Input id="stopStartsAt" name="startsAtTime" type="time" value={startsAtTime} onChange={(event) => setStartsAtTime(event.target.value)} />
            </div>
            <div className="flex1">
              <Label htmlFor="stopEndsAt">Konec</Label>
              <Input id="stopEndsAt" name="endsAtTime" type="time" value={endsAtTime} onChange={(event) => setEndsAtTime(event.target.value)} />
            </div>
          </div>
          <div className="row g8 mt8 wrap">
            {[30, 60, 90].map((minutes) => (
              <button className="chip" type="button" key={minutes} onClick={() => setEndByDuration(minutes)} disabled={!startsAtTime}>+{minutes}m</button>
            ))}
            <span className="muted t-xs">{durationMinutes !== null ? `Trvání ${durationMinutes} min` : 'Doplň začátek a konec kvůli bufferům.'}</span>
          </div>
          {members.length > 0 && (
            <>
              <Label className="mt14">Kdo se účastní</Label>
              <div className="col mt8" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {members.map((member, index) => {
                  const choices: AttendanceChoice[] = member.id === actorTripMemberId ? ['GOING', 'MAYBE', 'NO', 'OUT'] : ['GOING', 'OUT'];
                  return (
                    <div key={member.id}>
                      {index > 0 && <hr className="sep" />}
                      <div className="row g10 between" style={{ width: '100%', padding: '10px 12px' }}>
                        <span className="row g10">
                          <span className={`badge ${attendance[member.id] !== 'OUT' ? 'solid' : 'muted'}`} style={{ width: 22, height: 22, padding: 0, justifyContent: 'center' }}>
                            {attendance[member.id] !== 'OUT' && <Check size={13} />}
                          </span>
                          <span className="t-sm medi">{member.user.name}</span>
                        </span>
                        <div className="row g4 wrap" style={{ justifyContent: 'flex-end' }}>
                          {choices.map((status) => (
                            <button
                              className={`chip${attendance[member.id] === status ? ' on' : ''}`}
                              key={status}
                              type="button"
                              onClick={() => setAttendance((current) => ({ ...current, [member.id]: status }))}
                            >
                              {status === 'GOING' ? 'Jde' : status === 'MAYBE' ? 'Možná' : status === 'NO' ? 'Nejde' : 'Mimo'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <Label className="mt14" htmlFor="stopNoteEdit">Poznámka</Label>
          <Textarea id="stopNoteEdit" name="note" rows={3} defaultValue={editing.stop.note ?? ''} placeholder="Přesun, rezervace, kdo jde..." />
          <div className="row g8 mt16">
            <ConfirmDestructiveAction className="flex1" label="Smazat" onConfirm={() => { onDelete(editing.stop.id); onClose(); }} />
            <Button className="flex1" type="submit" disabled={!hasParticipants}>Uložit</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
