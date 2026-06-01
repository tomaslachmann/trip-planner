import { Bell, CalendarRange, Check, Copy, Edit3, Plus, Shield, Trash2, TriangleAlert, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ValidatedForm } from '@/components/ui/validated-form';
import { Avatar } from './avatar';
import type { Trip, TripMember } from '../types';

type RoleValue = 'ADMIN' | 'MEMBER' | 'GUEST';
type BudgetValue = 'BUDGET' | 'NORMAL' | 'PREMIUM';
type AvailabilityWindow = NonNullable<TripMember['availabilityWindows']>[number];

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
  if (note === 'Full trip') return 'Celý výlet';
  if (note === 'Joins after the weekend') return 'Přijíždí po víkendu';
  return note;
}

function roleLabel(role?: string) {
  if (role === 'OWNER') return 'Vlastník';
  if (role === 'ADMIN') return 'Admin';
  if (role === 'GUEST') return 'Host';
  return 'Člen';
}

function budgetLabel(value?: string) {
  if (value === 'BUDGET') return 'Úsporný';
  if (value === 'PREMIUM') return 'Prémiový';
  return 'Normální';
}

function formatBudgetAmount(value?: string | number | null, currency = 'EUR') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  try {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString('cs-CZ')} ${currency}`;
  }
}

function hasPaymentInfo(member: TripMember) {
  return Boolean(member.user.accounts?.some((account) => account.iban || account.domesticAccount));
}

function reminderHref(member: TripMember, trip?: Trip) {
  const subject = encodeURIComponent(`Doplň platební údaje pro ${trip?.name ?? 'výlet'}`);
  const body = encodeURIComponent('Ahoj, prosím doplň si v appce platební údaje, ať nám funguje vyrovnání nákladů a QR platby.');
  return `mailto:${member.user.email}?subject=${subject}&body=${body}`;
}

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
    <ValidatedForm
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
          <Input id={`startsAt-${availability?.id ?? member.id}`} name="startsAtDate" type="date" defaultValue={toDateInputValue(availability?.startsAt ?? trip?.startsAt)} required />
        </div>
        <div>
          <Label htmlFor={`endsAt-${availability?.id ?? member.id}`}>Do data</Label>
          <Input id={`endsAt-${availability?.id ?? member.id}`} name="endsAtDate" type="date" defaultValue={toDateInputValue(availability?.endsAt ?? trip?.endsAt)} required />
        </div>
      </div>
      <Label className="mt10" htmlFor={`note-${availability?.id ?? member.id}`}>Poznámka</Label>
      <Input id={`note-${availability?.id ?? member.id}`} name="note" defaultValue={availability?.note ?? ''} placeholder="Přiletí později, odjíždí dřív..." />
      <Button className="mt10" variant="outline" size="sm" type="submit">
        <Plus />{availability ? 'Uložit dostupnost' : 'Přidat dostupnost'}
      </Button>
    </ValidatedForm>
  );
}

function MemberCard({
  member,
  trip,
  actorUserId,
  canManageAll,
  editingAvailabilityId,
  addingAvailabilityFor,
  onSetEditingAvailabilityId,
  onSetAddingAvailabilityFor,
  onAddAvailability,
  onUpdateAvailability,
  onDeleteAvailability,
  onUpdateRole,
  onUpdatePlanning,
}: {
  member: TripMember;
  trip?: Trip;
  actorUserId?: string;
  canManageAll: boolean;
  editingAvailabilityId: string;
  addingAvailabilityFor: string;
  onSetEditingAvailabilityId: (id: string) => void;
  onSetAddingAvailabilityFor: (id: string) => void;
  onAddAvailability: (tripMemberId: string, data: FormData) => void;
  onUpdateAvailability: (availabilityId: string, data: FormData) => void;
  onDeleteAvailability: (availabilityId: string) => void;
  onUpdateRole: (memberId: string, role: RoleValue) => void;
  onUpdatePlanning: (memberId: string, input: { budgetPreference?: BudgetValue; budgetAmount?: number | null }) => void;
}) {
  const owner = member.role === 'OWNER';
  const editable = canManageAll || member.userId === actorUserId;
  const canEditRole = canManageAll && !owner;
  const paymentComplete = hasPaymentInfo(member);
  const budgetAmount = formatBudgetAmount(member.budgetAmount, trip?.currency ?? 'EUR');
  const availabilityWindows = member.availabilityWindows ?? [];

  return (
    <Card className="card sh pad mb12">
      <div className="row g12" style={{ alignItems: 'flex-start' }}>
        <Avatar name={member.user.name} size="lg" />
        <div className="col flex1" style={{ minWidth: 0 }}>
          <div className="row g8 wrap" style={{ alignItems: 'center' }}>
            <span className="t-h3">{member.user.name}</span>
            <span className={`badge ${owner ? 'solid' : 'muted'}`}><Shield size={12} />{roleLabel(member.role)}</span>
          </div>
          <span className="muted t-xs mt4">{member.user.email}</span>
        </div>
      </div>

      <Separator className="mt14" />

      <div className="row g10 mt14 wrap" style={{ alignItems: 'flex-end' }}>
        <div className="col" style={{ flex: '1 1 130px' }}>
          <Label>Role</Label>
          {canEditRole ? (
            <Select value={member.role} onValueChange={(role) => onUpdateRole(member.id, role as RoleValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Člen</SelectItem>
                <SelectItem value="GUEST">Host</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="input between muted-bg"><span>{roleLabel(member.role)}</span></div>
          )}
        </div>

        <div className="col" style={{ flex: '1 1 130px' }}>
          <Label>Rozpočet</Label>
          {editable ? (
            <Select
              value={(member.budgetPreference ?? 'NORMAL') as string}
              onValueChange={(value) => onUpdatePlanning(member.id, { budgetPreference: value as BudgetValue })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BUDGET">Úsporný</SelectItem>
                <SelectItem value="NORMAL">Normální</SelectItem>
                <SelectItem value="PREMIUM">Prémiový</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="input between muted-bg"><span>{budgetLabel(member.budgetPreference)}</span></div>
          )}
        </div>

        <div className="col" style={{ flex: '1 1 120px' }}>
          <Label htmlFor={`budgetAmount-${member.id}`}>Limit / osoba</Label>
          {editable ? (
            <div className="input">
              <span className="muted">{trip?.currency ?? 'EUR'}</span>
              <input
                id={`budgetAmount-${member.id}`}
                type="number"
                min={0}
                step="1"
                defaultValue={member.budgetAmount ? Number(member.budgetAmount) : ''}
                placeholder="bez limitu"
                onBlur={(event) => {
                  const value = Number(event.currentTarget.value);
                  onUpdatePlanning(member.id, { budgetAmount: Number.isFinite(value) && value > 0 ? value : null });
                }}
              />
            </div>
          ) : (
            <div className="input muted-bg"><span>{budgetAmount || 'Bez limitu'}</span></div>
          )}
        </div>
      </div>

      <Label className="mt14">Dostupnost</Label>
      <div className="row g8 wrap">
        {availabilityWindows.length === 0 && <span className="badge amber"><CalendarRange size={13} />Počítá se celý výlet</span>}
        {availabilityWindows.map((window) => (
          <span key={window.id} className="avail">
            <CalendarRange size={13} />{formatWindow(window.startsAt, window.endsAt)}
            {window.note && <> · {noteLabel(window.note)}</>}
            {editable && (
              <>
                <button className="x" type="button" onClick={() => onSetEditingAvailabilityId(editingAvailabilityId === window.id ? '' : window.id)} aria-label="Upravit dostupnost"><Edit3 size={12} /></button>
                <button className="x" type="button" onClick={() => onDeleteAvailability(window.id)} aria-label="Smazat dostupnost"><Trash2 size={12} /></button>
              </>
            )}
          </span>
        ))}
        {editable && (
          <Button variant="ghost" size="sm" type="button" onClick={() => onSetAddingAvailabilityFor(addingAvailabilityFor === member.id ? '' : member.id)}>
            <Plus />Přidat
          </Button>
        )}
      </div>

      {availabilityWindows.map((window) => (
        editingAvailabilityId === window.id && (
          <AvailabilityForm
            key={`edit-${window.id}`}
            member={member}
            trip={trip}
            availability={window}
            onSubmit={(data) => {
              onUpdateAvailability(window.id, data);
              onSetEditingAvailabilityId('');
            }}
          />
        )
      ))}

      {editable && addingAvailabilityFor === member.id && (
        <AvailabilityForm
          member={member}
          trip={trip}
          onSubmit={(data) => {
            onAddAvailability(member.id, data);
            onSetAddingAvailabilityFor('');
          }}
        />
      )}

      <div className="row between mt16">
        {paymentComplete ? (
          <span className="badge green"><Check size={12} />Platební údaje jsou doplněné</span>
        ) : (
          <span className="badge amber"><TriangleAlert size={12} />Chybí platební údaje</span>
        )}
        {!paymentComplete && (
          <Button variant="outline" size="sm" asChild>
            <a href={reminderHref(member, trip)}>
              <Bell size={13} />Připomenout
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

export function MembersPanel({
  trip,
  actorUserId,
  actorRole,
  hideInvite = false,
  onInvite,
  onCopyInvite,
  onAddAvailability,
  onUpdateAvailability,
  onDeleteAvailability,
  onUpdateRole,
  onUpdatePlanning,
}: {
  trip?: Trip;
  actorUserId?: string;
  actorRole?: string;
  hideInvite?: boolean;
  onInvite?: () => void;
  onCopyInvite?: () => void;
  onAddAvailability: (tripMemberId: string, data: FormData) => void;
  onUpdateAvailability: (availabilityId: string, data: FormData) => void;
  onDeleteAvailability: (availabilityId: string) => void;
  onUpdateRole: (memberId: string, role: RoleValue) => void;
  onUpdatePlanning: (memberId: string, input: { budgetPreference?: BudgetValue; budgetAmount?: number | null }) => void;
}) {
  const members = trip?.members ?? [];
  const canManageAll = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const [editingAvailabilityId, setEditingAvailabilityId] = useState('');
  const [addingAvailabilityFor, setAddingAvailabilityFor] = useState('');

  return (
    <>
      {!hideInvite && (
        <Button className="w-full mb14" type="button" onClick={onInvite}>
          <UserPlus />Pozvat lidi
        </Button>
      )}

      <Card className="card sh pad mb16">
        <Label>Kód pozvánky</Label>
        <div className="row g8">
          <div className="input muted-bg flex1">
            <span className="mono t-sm ellipsis">{trip?.inviteCode ?? 'Nejdřív vytvoř výlet'}</span>
          </div>
          <Button variant="outline" size="icon" type="button" onClick={onCopyInvite} aria-label="Kopírovat kód pozvánky">
            <Copy />
          </Button>
        </div>
      </Card>

      {members.map((member) => (
        <MemberCard
          key={member.id}
          member={member}
          trip={trip}
          actorUserId={actorUserId}
          canManageAll={canManageAll}
          editingAvailabilityId={editingAvailabilityId}
          addingAvailabilityFor={addingAvailabilityFor}
          onSetEditingAvailabilityId={setEditingAvailabilityId}
          onSetAddingAvailabilityFor={setAddingAvailabilityFor}
          onAddAvailability={onAddAvailability}
          onUpdateAvailability={onUpdateAvailability}
          onDeleteAvailability={onDeleteAvailability}
          onUpdateRole={onUpdateRole}
          onUpdatePlanning={onUpdatePlanning}
        />
      ))}
    </>
  );
}
