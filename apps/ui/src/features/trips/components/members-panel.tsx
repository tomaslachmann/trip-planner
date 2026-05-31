import { CalendarRange, Edit3, Plus, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar } from './avatar';
import type { Trip, TripMember } from '../types';

function toDateOnly(value?: string | null) {
  if (!value) return '';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function toDateInputValue(value?: string | null) {
  return toDateOnly(value);
}

function formatWindow(startsAt: string, endsAt: string) {
  const formatter = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const startDate = toDateOnly(startsAt);
  const endDate = toDateOnly(endsAt);
  if (!startDate || !endDate) return '';
  const startLabel = formatter.format(new Date(`${startDate}T00:00:00.000Z`));
  const endLabel = formatter.format(new Date(`${endDate}T00:00:00.000Z`));
  return startDate === endDate ? startLabel : `${startLabel} - ${endLabel}`;
}

function noteLabel(note?: string | null) {
  if (note === 'Full trip') return 'Celý trip';
  if (note === 'Joins after the weekend') return 'Přijíždí po víkendu';
  return note;
}

function roleLabel(role?: string) {
  if (role === 'OWNER') return 'vlastník';
  if (role === 'ADMIN') return 'admin';
  if (role === 'GUEST') return 'host';
  return 'člen';
}

type AvailabilityWindow = NonNullable<TripMember['availabilityWindows']>[number];

function AvailabilityForm({
  member,
  trip,
  availability,
  onSubmit,
}: {
  member: TripMember;
  trip?: Trip;
  availability?: AvailabilityWindow;
  onSubmit: (data: FormData) => void;
}) {
  return (
    <form
      className="mt12 rounded-[var(--r-lg)] border border-border p-3"
      style={{ background: 'var(--muted)' }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
        if (!availability) event.currentTarget.reset();
      }}
    >
      <div className="grid2 g8">
        <div>
          <Label htmlFor={`startsAt-${availability?.id ?? member.id}`}>Od data</Label>
          <Input id={`startsAt-${availability?.id ?? member.id}`} name="startsAtDate" type="date" defaultValue={toDateInputValue(availability?.startsAt ?? trip?.startsAt)} />
        </div>
        <div>
          <Label htmlFor={`endsAt-${availability?.id ?? member.id}`}>Do data</Label>
          <Input id={`endsAt-${availability?.id ?? member.id}`} name="endsAtDate" type="date" defaultValue={toDateInputValue(availability?.endsAt ?? trip?.endsAt)} />
        </div>
      </div>
      <Label className="mt10" htmlFor={`note-${availability?.id ?? member.id}`}>Poznámka</Label>
      <Input id={`note-${availability?.id ?? member.id}`} name="note" defaultValue={availability?.note ?? ''} placeholder="Přiletí později, odjíždí dřív..." />
      <Button className="mt10" variant="outline" size="sm" type="submit"><Plus />{availability ? 'Uložit dostupnost' : 'Přidat dostupnost'}</Button>
    </form>
  );
}

export function MembersPanel({
  trip,
  actorUserId,
  actorRole,
  onAddAvailability,
  onUpdateAvailability,
  onDeleteAvailability,
  onUpdateRole,
}: {
  trip?: Trip;
  actorUserId?: string;
  actorRole?: string;
  onAddAvailability: (tripMemberId: string, data: FormData) => void;
  onUpdateAvailability: (availabilityId: string, data: FormData) => void;
  onDeleteAvailability: (availabilityId: string) => void;
  onUpdateRole: (memberId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') => void;
}) {
  const members = trip?.members ?? [];
  const canManageAll = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const [editingAvailabilityId, setEditingAvailabilityId] = useState('');
  const [addingAvailabilityFor, setAddingAvailabilityFor] = useState('');
  return (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 10, paddingBottom: 18 }}>
      <Card className="p-[14px] shadow-[var(--sh-sm)] mb16">
        <div className="row between">
          <div className="col">
            <span className="t-h3">Kód pozvánky</span>
            <span className="muted t-xs mt4">{trip?.inviteCode ?? 'Nejdřív vytvoř trip'}</span>
          </div>
        </div>
      </Card>
      {members.map((member, index) => (
        <div key={member.id}>
          {index > 0 && <hr className="sep" />}
          <div className="row" style={{ padding: '13px 0' }}>
            <Avatar name={member.user.name} size="lg" />
            <div className="col flex1" style={{ minWidth: 0 }}>
              <div className="row g8">
                <span className="t-h3">{member.user.name}</span>
                <span className={`badge ${member.role === 'OWNER' ? 'solid' : 'muted'}`}><Shield />{roleLabel(member.role)}</span>
              </div>
              <span className="muted t-xs mt4">{member.user.email}</span>
              {canManageAll && member.role !== 'OWNER' && (
                <div className="mt8" style={{ maxWidth: 180 }}>
                  <Select value={member.role} onValueChange={(role) => onUpdateRole(member.id, role as 'ADMIN' | 'MEMBER' | 'GUEST')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="MEMBER">Člen</SelectItem>
                      <SelectItem value="GUEST">Host</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="row g6 mt8 wrap">
                {(member.availabilityWindows ?? []).length === 0 && <span className="badge amber"><CalendarRange />Počítá se celý trip</span>}
                {(member.availabilityWindows ?? []).map((window) => (
                  <div className="badge green" key={window.id}>
                    <CalendarRange />{formatWindow(window.startsAt, window.endsAt)}
                    {window.note && <span className="muted">{noteLabel(window.note)}</span>}
                    {(canManageAll || member.userId === actorUserId) && (
                      <>
                        <button className="iconbtn plain" style={{ width: 22, height: 22 }} type="button" onClick={() => setEditingAvailabilityId(editingAvailabilityId === window.id ? '' : window.id)} title="Upravit dostupnost"><Edit3 /></button>
                        <button className="iconbtn plain" style={{ width: 22, height: 22 }} type="button" onClick={() => onDeleteAvailability(window.id)} title="Smazat dostupnost"><Trash2 /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {(member.availabilityWindows ?? []).map((window) => (
                editingAvailabilityId === window.id && (
                  <AvailabilityForm
                    key={`edit-${window.id}`}
                    member={member}
                    trip={trip}
                    availability={window}
                    onSubmit={(data) => {
                      onUpdateAvailability(window.id, data);
                      setEditingAvailabilityId('');
                    }}
                  />
                )
              ))}
              {(canManageAll || member.userId === actorUserId) && (
                addingAvailabilityFor === member.id ? (
                  <AvailabilityForm
                    member={member}
                    trip={trip}
                    onSubmit={(data) => {
                      onAddAvailability(member.id, data);
                      setAddingAvailabilityFor('');
                    }}
                  />
                ) : (
                  <Button className="mt10" variant="outline" size="sm" type="button" onClick={() => setAddingAvailabilityFor(member.id)}>
                    <Plus />Přidat dostupnost
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
