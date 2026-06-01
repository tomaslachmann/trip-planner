'use client';

import { Circle, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChipButton, ChipGroup } from '@/components/ui/chip-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ValidatedForm } from '@/components/ui/validated-form';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { isMemberAvailableForRange, memberAvailabilitySummary } from '../lib/availability';
import { categoryMeta } from './category';
import { LocationCombobox } from './location-combobox';
import { Avatar } from './avatar';

const EXPENSE_CATEGORIES = [
  { value: 'FOOD', label: 'Jídlo' },
  { value: 'STAY', label: 'Ubytování' },
  { value: 'TRANSPORT', label: 'Doprava' },
  { value: 'ACTIVITY', label: 'Aktivita' },
  { value: 'OTHER', label: 'Ostatní' },
];

const EXPENSE_CURRENCIES = [
  { value: 'CZK', label: 'CZK' },
  { value: 'EUR', label: 'EUR' },
] as const;

type ExpenseCurrency = (typeof EXPENSE_CURRENCIES)[number]['value'];

function normalizeExpenseCurrency(value?: string | null): ExpenseCurrency {
  return value === 'EUR' ? 'EUR' : 'CZK';
}

/* ── shared sheet header (Cancel · Title · Save) ── */
function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="sheet-head">
      <Button variant="ghost" size="sm" type="button" onClick={onClose}>Zrušit</Button>
      <SheetTitle className="t-h3">{title}</SheetTitle>
      <span aria-hidden="true" style={{ width: 64 }} />
    </div>
  );
}

/* ── inline delete confirm ── */
function DeleteInline({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button className="btn ghost block mt16" style={{ color: 'var(--destructive)' }} type="button" onClick={() => setArmed(true)}>
        <Trash2 size={16} />{label}
      </button>
    );
  }
  return (
    <div className="card mt16" style={{ padding: 13, background: '#fff1f2', border: '1px solid #fecdd3' }}>
      <span className="t-sm semib" style={{ color: '#be123c' }}>Opravdu smazat?</span>
      <span className="t-xs" style={{ color: '#be123c', display: 'block', marginTop: 2 }}>Tuto akci nelze vrátit.</span>
      <div className="row g8 mt12">
        <button className="btn outline flex1" type="button" onClick={() => setArmed(false)}>Zrušit</button>
        <button className="btn destructive flex1" type="button" onClick={onConfirm}><Trash2 size={15} />Smazat</button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   ADD EXPENSE SHEET
────────────────────────────────────────────────────────── */
export function AddExpenseSheet({ planner, edit, onClose }: { planner: TripPlannerController; edit?: boolean; onClose: () => void }) {
  const { state, actions } = planner;
  const members = state.selectedTrip?.members ?? [];
  const expense = edit ? state.selectedExpense : undefined;
  const expenseSplitUserIds = new Set((expense?.splits ?? []).map((split) => split.userId));
  const initialScope = expense && expenseSplitUserIds.size > 0 && expenseSplitUserIds.size < members.length ? 'selected' : 'all';
  const [splitScope, setSplitScope] = useState<'all' | 'selected'>(initialScope);
  const [paidById, setPaidById] = useState(expense?.paidById ?? members[0]?.userId ?? state.actorUserId);
  const [category, setCategory] = useState(expense?.category ?? 'OTHER');
  const [sel, setSel] = useState<Record<string, boolean>>(Object.fromEntries(members.map((m) => [m.userId, expense ? expenseSplitUserIds.has(m.userId) : true])));
  const initialCurrency = normalizeExpenseCurrency(expense?.currency ?? state.selectedTrip?.currency);
  const [currency, setCurrency] = useState<ExpenseCurrency>(initialCurrency);
  const [originalCurrency, setOriginalCurrency] = useState<ExpenseCurrency>(
    normalizeExpenseCurrency(expense?.originalCurrency ?? (initialCurrency === 'CZK' ? 'EUR' : 'CZK')),
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (edit && expense?.id) void actions.updateExpense(expense.id, new FormData(e.currentTarget));
    else void actions.addExpense(new FormData(e.currentTarget));
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: '94%' }}>
        <SheetHead title={edit ? 'Upravit výdaj' : 'Nový výdaj'} onClose={onClose} />
        <ValidatedForm id="expense-form" className="scroll px18" style={{ flex: 1, paddingBottom: 18 }} onSubmit={handleSubmit}>
          <input type="hidden" name="paidById" value={paidById} />
          <input type="hidden" name="splitScope" value={splitScope} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="originalCurrency" value={originalCurrency} />

          <Label htmlFor="expenseTitle">Název</Label>
          <Input id="expenseTitle" name="expenseTitle" defaultValue={expense?.title ?? ''} placeholder="Večeře, pronájem auta..." autoFocus required />

          <div className="row g12 mt16" style={{ alignItems: 'flex-start' }}>
            <div className="flex1">
              <Label htmlFor="expenseAmount">Částka</Label>
              <Input id="expenseAmount" name="amount" type="number" min="0.01" step="0.01" className="tnum" defaultValue={expense ? Number(expense.amount) : ''} placeholder="0.00" required />
            </div>
            <div style={{ flex: '0 0 112px' }}>
              <Label htmlFor="expenseCurrency">Měna</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as ExpenseCurrency)}>
                <SelectTrigger id="expenseCurrency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CURRENCIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="row g12 mt12" style={{ alignItems: 'flex-start' }}>
            <div className="flex1">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex1">
              <Label htmlFor="expenseSpentAt">Datum</Label>
              <Input id="expenseSpentAt" name="spentAtDate" type="date" defaultValue={expense?.spentAt?.slice(0, 10) ?? ''} />
            </div>
          </div>

          <Label className="mt12" htmlFor="expenseReceiptFile">Účtenka</Label>
          <Input id="expenseReceiptFile" name="receiptFile" type="file" accept="image/*,application/pdf" />
          {expense?.receiptUrl && (
            <a className="t-xs muted mt6" href={expense.receiptUrl} target="_blank" rel="noreferrer">
              Otevřít aktuální účtenku
            </a>
          )}
          <Label className="mt12" htmlFor="expenseReceiptUrl">Odkaz na účtenku</Label>
          <Input id="expenseReceiptUrl" name="receiptUrl" type="url" defaultValue={expense?.receiptUrl ?? ''} placeholder="nebo https://..." />

          <div className="row g12 mt12" style={{ alignItems: 'flex-start' }}>
            <div className="flex1">
              <Label htmlFor="expenseOriginalAmount">Původní částka</Label>
              <Input id="expenseOriginalAmount" name="originalAmount" type="number" min="0" step="0.01" className="tnum" defaultValue={expense?.originalAmount ? Number(expense.originalAmount) : ''} placeholder="volitelné" />
            </div>
            <div style={{ flex: '0 0 112px' }}>
              <Label htmlFor="expenseOriginalCurrency">Měna</Label>
              <Select value={originalCurrency} onValueChange={(value) => setOriginalCurrency(value as ExpenseCurrency)}>
                <SelectTrigger id="expenseOriginalCurrency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CURRENCIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Label className="mt12" htmlFor="expenseExchangeRate">Kurz</Label>
          <Input id="expenseExchangeRate" name="exchangeRate" type="number" min="0" step="0.0001" className="tnum" defaultValue={expense?.exchangeRate ? Number(expense.exchangeRate) : ''} placeholder="volitelné" />

          <Label className="mt16">Kdo zaplatil</Label>
          <div className="chips">
            {members.map((m) => (
              <ChipButton key={m.userId} selected={paidById === m.userId} onClick={() => setPaidById(m.userId)}>
                <Avatar name={m.user.name} size="sm" />
                {m.user.name}
              </ChipButton>
            ))}
          </div>

          <Label className="mt16">Rozdělení</Label>
          <Select value={splitScope} onValueChange={(value) => setSplitScope(value as 'all' | 'selected')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všichni účastníci</SelectItem>
              <SelectItem value="selected">Vybraní účastníci</SelectItem>
            </SelectContent>
          </Select>

          <div className="col mt12">
            {members.map((m, i) => (
              <div key={m.userId}>
                {i > 0 && <hr className="sep" />}
                <div className="row between" style={{ padding: '10px 0' }}>
                  <div
                    className="row g10 pressable"
                    style={{ cursor: splitScope === 'selected' ? 'pointer' : 'default' }}
                    onClick={() => splitScope === 'selected' && setSel({ ...sel, [m.userId]: !sel[m.userId] })}
                  >
                    <Checkbox checked={splitScope === 'all' || !!sel[m.userId]} disabled={splitScope === 'all'} />
                    {splitScope === 'selected' && sel[m.userId] && <input type="hidden" name="splitUserIds" value={m.userId} />}
                    <Avatar name={m.user.name} size="sm" />
                    <span className="t-sm medi">{m.user.name}</span>
                  </div>
                  <span className="mono t-sm tnum muted">{splitScope === 'all' || sel[m.userId] ? `${currency} -` : '-'}</span>
                </div>
              </div>
            ))}
          </div>
          {edit && expense?.id && <DeleteInline label="Smazat výdaj" onConfirm={() => { void actions.deleteExpense(expense.id); onClose(); }} />}
        </ValidatedForm>
        <div className="p16" style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn primary block lg" type="submit" form="expense-form">
            {edit ? 'Uložit změny' : 'Přidat výdaj'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────
   ADD PLACE SHEET
────────────────────────────────────────────────────────── */
const PLACE_CATS = [
  { key: 'PLACE', label: 'Památka' },
  { key: 'FOOD', label: 'Jídlo' },
  { key: 'ACTIVITY', label: 'Aktivita' },
  { key: 'DAY_TRIP', label: 'Výlet' },
  { key: 'STAY_AREA', label: 'Oblast ubytování' },
  { key: 'TRANSPORT', label: 'Doprava' },
] as const;

const PLACE_STATUS = [
  { key: 'PROPOSED', label: 'Návrh' },
  { key: 'SHORTLISTED', label: 'Užší výběr' },
  { key: 'APPROVED', label: 'Schválené' },
  { key: 'REJECTED', label: 'Zamítnuté' },
] as const;

const WEATHER_OPTIONS = [
  { key: 'MIXED', label: 'Mix' },
  { key: 'INDOOR', label: 'Uvnitř' },
  { key: 'OUTDOOR', label: 'Venku' },
] as const;

export function AddPlaceSheet({ planner, edit, onClose }: { planner: TripPlannerController; edit?: boolean; onClose: () => void }) {
  const { state, actions } = planner;
  const place = edit ? state.selectedPlace : undefined;
  const [cat, setCat] = useState<string>(place?.type ?? 'PLACE');
  const [status, setStatus] = useState<(typeof PLACE_STATUS)[number]['key']>((place?.status as (typeof PLACE_STATUS)[number]['key'] | undefined) ?? 'PROPOSED');
  const [dayId, setDayId] = useState<string>('none');
  const [weather, setWeather] = useState<string>(place?.weatherSuitability ?? 'MIXED');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set('placeType', cat);
    data.set('weatherSuitability', weather);
	    const saved = edit && place?.id ? await actions.updatePlace(place.id, data) : await actions.addPlace(data);
	    if (!saved) return;
	    const savedPlaceId = saved?.id ?? place?.id;
	    if (savedPlaceId) await actions.updatePlaceStatus(savedPlaceId, status);
	    if (dayId !== 'none') {
      if (savedPlaceId) await actions.addPlaceToItinerary(savedPlaceId, dayId);
    }
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: '94%' }}>
        <SheetHead title={edit ? 'Upravit místo' : 'Přidat místo'} onClose={onClose} />
        <ValidatedForm id="place-form" className="scroll px18" style={{ flex: 1, paddingBottom: 18 }} onSubmit={handleSubmit}>
          <Label htmlFor="placeName">Název</Label>
          <Input id="placeName" name="placeName" defaultValue={place?.name ?? ''} placeholder="např. Sagrada Família" autoFocus required />

          <Label className="mt16">Kategorie</Label>
          <ChipGroup
            value={cat}
            onValueChange={setCat}
            options={PLACE_CATS.map(({ key, label }) => {
              const item = categoryMeta(key);
              const Icon = item.icon;
              return { value: key, label: <><Icon size={14} />{label}</> };
            })}
          />

          <Label className="mt16">Počasí</Label>
          <ChipGroup
            value={weather}
            onValueChange={setWeather}
            options={WEATHER_OPTIONS.map((item) => ({ value: item.key, label: item.label }))}
          />

          <Label className="mt16">Lokace</Label>
          <LocationCombobox
            defaultLabel={place?.locationLabel ?? place?.name ?? state.selectedTrip?.destination ?? ''}
            defaultLatitude={place?.latitude}
            defaultLongitude={place?.longitude}
            onSearch={actions.searchLocations}
          />

          <div className="row g12 mt16">
            <div className="flex1">
              <Label htmlFor="durationMin">Délka návštěvy</Label>
              <Input id="durationMin" name="duration" defaultValue={place?.durationMin ? `${Math.round(place.durationMin / 60)}h` : ''} placeholder="2h" />
            </div>
            <div className="flex1">
              <Label htmlFor="estimatedCost">Cena / osoba</Label>
              <Input id="estimatedCost" name="estimatedCost" type="number" min={0} step="0.01" defaultValue={place?.estimatedCost ? Number(place.estimatedCost) : 0} />
            </div>
          </div>

          <div className="row g12 mt16">
            <div className="flex1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACE_STATUS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex1">
              <Label>Navrhovaný den</Label>
              <Select value={dayId} onValueChange={setDayId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Žádný</SelectItem>
                  {state.data.itinerary.map((day, index) => (
                    <SelectItem key={day.id} value={day.id}>{day.title ?? `Den ${index + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Label className="mt16" htmlFor="notes">Poznámky</Label>
          <Textarea id="notes" rows={3} name="notes" defaultValue={place?.description ?? ''} placeholder="Tipy, info o rezervaci…" />

          <Label className="mt16" htmlFor="placeImageUrl">Fotka</Label>
          <Input id="placeImageUrl" name="imageUrl" type="url" defaultValue={place?.imageUrl ?? ''} placeholder="https://..." />

          {edit && place?.id && <DeleteInline label="Smazat místo" onConfirm={() => { void actions.deletePlace(place.id); onClose(); }} />}
        </ValidatedForm>
        <div className="p16" style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <Button className="w-full" size="lg" type="submit" form="place-form">{edit ? 'Uložit změny' : 'Přidat místo'}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────
   ADD ITINERARY ITEM SHEET
────────────────────────────────────────────────────────── */
export function AddItinerarySheet({ planner, initialDayId, onClose }: { planner: TripPlannerController; initialDayId?: string; onClose: () => void }) {
  const { state, actions } = planner;
  const approved = state.data.places;
  const members = state.selectedTrip?.members ?? [];
  const [pick, setPick] = useState(approved[0]?.id ?? '');
  const [dayId, setDayId] = useState(initialDayId ?? state.data.itinerary[0]?.id ?? 'default');
  const [startsAtTime, setStartsAtTime] = useState('09:30');
  const [endsAtTime, setEndsAtTime] = useState('');
  const [participants, setParticipants] = useState<Record<string, boolean>>(() => Object.fromEntries(members.map((member) => [member.id, true])));
  const selectedDay = state.data.itinerary.find((day) => day.id === dayId);
  const selectedDayDate = selectedDay?.date ?? state.selectedTrip?.startsAt ?? new Date().toISOString();
  const participantAvailability = useMemo<Record<string, boolean>>(
    () => Object.fromEntries(members.map((member) => [member.id, isMemberAvailableForRange(member, selectedDayDate, selectedDayDate)])),
    [members, selectedDayDate],
  );
  const selectedParticipantIds = members.filter((member) => participantAvailability[member.id] !== false && participants[member.id]).map((member) => member.id);
  const hasParticipants = members.length === 0 || selectedParticipantIds.length > 0;

  useEffect(() => {
    setParticipants((current) => {
      let changed = false;
      const next: Record<string, boolean> = {};
      for (const member of members) {
        const available = participantAvailability[member.id] ?? true;
        next[member.id] = available && (current[member.id] ?? true);
        if (next[member.id] !== current[member.id]) changed = true;
      }
      if (Object.keys(current).length !== members.length) changed = true;
      return changed ? next : current;
    });
  }, [members, participantAvailability]);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <SheetHead title="Přidat do itineráře" onClose={onClose} />
        <ValidatedForm
          className="px18"
          style={{ paddingBottom: 18 }}
          onSubmit={(event) => {
            event.preventDefault();
            const fd = new FormData(event.currentTarget);
            if (!pick) return;
            void actions.addPlaceToItinerary(pick, dayId === 'default' ? undefined : dayId, {
              startsAtTime: startsAtTime.trim() || undefined,
              endsAtTime: endsAtTime.trim() || undefined,
              note: String(fd.get('note') ?? '').trim() || undefined,
              tripMemberIds: selectedParticipantIds,
            });
            onClose();
          }}
        >
          <label className="field-label">Vybrat místo</label>
          {approved.length === 0 ? (
            <div className="muted t-sm center" style={{ padding: '16px 0' }}>Nejsou žádná místa k přidání.</div>
          ) : (
            <div className="col" style={{ maxHeight: 230, overflowY: 'auto' }}>
              {approved.map((p, i) => (
                <div key={p.id}>
                  {i > 0 && <hr className="sep" />}
                  <div className="row pressable" style={{ padding: '10px 0', cursor: 'pointer' }} onClick={() => setPick(p.id)}>
                    <div className="col flex1">
                      <span className="t-sm semib">{p.name}</span>
                      <span className="faint t-xs">{p.type}</span>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: 999, border: `2px solid ${pick === p.id ? 'var(--primary)' : 'var(--border)'}`, background: pick === p.id ? 'var(--primary)' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {pick === p.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="row g12 mt16">
            <div className="flex1">
              <Label>Den</Label>
              <Select value={dayId} onValueChange={setDayId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {state.data.itinerary.length === 0 && <SelectItem value="default">Vytvořit první den</SelectItem>}
                  {state.data.itinerary.map((day, index) => (
                    <SelectItem key={day.id} value={day.id}>{day.title ?? `Den ${index + 1}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex1">
              <Label htmlFor="startsAtTime">Čas začátku</Label>
              <Input id="startsAtTime" name="startsAtTime" type="time" value={startsAtTime} onChange={(event) => setStartsAtTime(event.target.value)} required />
            </div>
            <div className="flex1">
              <Label htmlFor="endsAtTime">Konec</Label>
              <Input id="endsAtTime" name="endsAtTime" type="time" value={endsAtTime} onChange={(event) => setEndsAtTime(event.target.value)} placeholder="auto" />
            </div>
          </div>

          {members.length > 0 && (
            <>
              <Label className="mt16">Kdo se účastní</Label>
              <div className="col mt8" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {members.map((member, index) => {
                  const isAvailable = participantAvailability[member.id] !== false;
                  return (
                    <div key={member.id} title={memberAvailabilitySummary(member)}>
                      {index > 0 && <hr className="sep" />}
                      <div
                        className="row g10 between"
                        style={{ width: '100%', padding: '10px 12px', textAlign: 'left', opacity: isAvailable ? 1 : 0.58 }}
                      >
                        <span className="row g10" style={{ minWidth: 0 }}>
                          <Checkbox
                            id={`itinerary-participant-${member.id}`}
                            checked={isAvailable && !!participants[member.id]}
                            disabled={!isAvailable}
                            onCheckedChange={(checked) => setParticipants((current) => ({ ...current, [member.id]: checked === true }))}
                          />
                          <Label htmlFor={`itinerary-participant-${member.id}`} className="t-sm medi" style={{ cursor: isAvailable ? 'pointer' : 'not-allowed' }}>
                            {member.user.name}
                          </Label>
                        </span>
                        <span className={isAvailable ? 'muted t-xs' : 'badge amber'}>
                          {isAvailable ? member.role : 'Mimo dostupnost'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <Label className="mt16" htmlFor="stopNote">Poznámka k přesunu <span className="faint">(volitelné)</span></Label>
          <Input id="stopNote" name="note" placeholder="např. 12 min metrem" />

          <button
            className="btn primary block lg mt20"
            type="submit"
            disabled={!pick || !hasParticipants}
          >
            Přidat do itineráře
          </button>
        </ValidatedForm>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────
   ADD ACCOMMODATION SHEET
────────────────────────────────────────────────────────── */
export function AddAccommodationSheet({ planner, edit, onClose }: { planner: TripPlannerController; edit?: boolean; onClose: () => void }) {
  const { state, actions } = planner;
  const place = edit ? state.selectedPlace : undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const nights = Number(data.get('nights') || 0);
    data.delete('nights');
    if (Number.isFinite(nights) && nights > 0) data.set('durationMin', String(nights * 1440));
    const saved = edit && place?.id ? await actions.updatePlace(place.id, data) : await actions.addPlace(data);
    if (saved || edit) onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: '94%' }}>
        <SheetHead title={edit ? 'Upravit ubytování' : 'Přidat ubytování'} onClose={onClose} />
        <ValidatedForm id="accommodation-form" className="scroll px18" style={{ flex: 1, paddingBottom: 18 }} onSubmit={handleSubmit}>
          <input type="hidden" name="placeType" value="ACCOMMODATION" />
          <input type="hidden" name="weatherSuitability" value="INDOOR" />

          <Label htmlFor="stayName">Název</Label>
          <Input id="stayName" name="placeName" defaultValue={place?.name ?? ''} placeholder="Název ubytování" autoFocus required />

          <Label className="mt16">Lokace</Label>
          <LocationCombobox
            defaultLabel={place?.locationLabel ?? place?.name ?? state.selectedTrip?.destination ?? ''}
            defaultLatitude={place?.latitude ?? state.selectedPlace?.latitude}
            defaultLongitude={place?.longitude ?? state.selectedPlace?.longitude}
            onSearch={actions.searchLocations}
          />

          <div className="row g12 mt16">
            <div className="flex1">
              <Label htmlFor="stayCost">Celková cena</Label>
              <Input id="stayCost" name="estimatedCost" type="number" min="0" step="0.01" defaultValue={place?.estimatedCost ? Number(place.estimatedCost) : ''} placeholder="1200" />
            </div>
            <div className="flex1">
              <Label htmlFor="stayDuration">Nocí</Label>
              <Input id="stayDuration" name="nights" type="number" min="1" step="1" defaultValue={place?.durationMin ? Math.max(1, Math.round(place.durationMin / 1440)) : ''} placeholder="3" />
            </div>
          </div>

          <Label className="mt16" htmlFor="staySourceUrl">Odkaz</Label>
          <Input id="staySourceUrl" name="sourceUrl" type="url" defaultValue={place?.sourceUrl ?? ''} placeholder="https://booking.com/..." />

          <Label className="mt16" htmlFor="stayImageUrl">Fotka</Label>
          <Input id="stayImageUrl" name="imageUrl" type="url" defaultValue={place?.imageUrl ?? ''} placeholder="https://..." />

          <Label className="mt16" htmlFor="stayNotes">Poznámky</Label>
          <Textarea id="stayNotes" name="notes" rows={3} defaultValue={place?.description ?? ''} placeholder="Klady, zápory, podmínky rezervace..." />

          {edit && place?.id && <DeleteInline label="Odebrat ubytování" onConfirm={() => { void actions.deletePlace(place.id); onClose(); }} />}
        </ValidatedForm>
        <div className="p16" style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button className="btn primary block lg" type="submit" form="accommodation-form">{edit ? 'Uložit změny' : 'Přidat ubytování'}</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────
   ADD NOTE SHEET
────────────────────────────────────────────────────────── */
export function AddNoteSheet({ planner, onClose }: { planner: TripPlannerController; onClose: () => void }) {
  const { actions } = planner;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body = String(data.get('note') ?? '').trim();
    if (!body) return;
    void actions.createChecklistItem({ title: body, scope: 'SHARED' });
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <SheetHead title="Přidat poznámku" onClose={onClose} />
        <ValidatedForm className="px18" style={{ paddingBottom: 18 }} onSubmit={handleSubmit}>
          <Label htmlFor="tripNote">Poznámka pro skupinu</Label>
          <Textarea id="tripNote" name="note" rows={4} placeholder="Nech poznámku pro skupinu..." autoFocus required />
          <Button className="mt16 w-full" size="lg" type="submit">Přidat poznámku</Button>
        </ValidatedForm>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────
   TRIP SETTINGS SHEET
────────────────────────────────────────────────────────── */
export function TripSettingsSheet({ planner, onClose }: { planner: TripPlannerController; onClose: () => void }) {
  const { state, actions } = planner;
  const trip = state.selectedTrip;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const startsAt = String(fd.get('startsAt') ?? '').trim();
    const endsAt = String(fd.get('endsAt') ?? '').trim();
    const toDateTime = (value: string, endOfDay = false) => value ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : null;
    void actions.updateTrip({
      name: String(fd.get('name') ?? '').trim() || undefined,
      destination: String(fd.get('destination') ?? '').trim() || undefined,
      startsAt: toDateTime(startsAt),
      endsAt: toDateTime(endsAt, true),
      currency: String(fd.get('currency') ?? '').trim() || undefined,
    });
    onClose();
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: '94%' }}>
        <SheetHead title="Nastavení výletu" onClose={onClose} />
        <ValidatedForm className="scroll px18" style={{ flex: 1, paddingBottom: 18 }} onSubmit={handleSubmit}>
          <div className="card pad">
            <Label htmlFor="tripName">Název výletu</Label>
            <Input id="tripName" name="name" defaultValue={trip?.name ?? ''} placeholder="Barcelona 2026" required />

            <Label className="mt14" htmlFor="tripDestination">Destinace</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" id="tripDestination" name="destination" defaultValue={trip?.destination ?? ''} placeholder="Město nebo oblast" required />
            </div>

            <div className="row g12 mt14">
              <div className="flex1">
                <Label htmlFor="tripStartsAt">Od</Label>
                <Input id="tripStartsAt" name="startsAt" type="date" defaultValue={trip?.startsAt?.slice(0, 10) ?? ''} required />
              </div>
              <div className="flex1">
                <Label htmlFor="tripEndsAt">Do</Label>
                <Input id="tripEndsAt" name="endsAt" type="date" defaultValue={trip?.endsAt?.slice(0, 10) ?? ''} required />
              </div>
            </div>

            <Label className="mt14">Měna</Label>
            <Select name="currency" defaultValue={normalizeExpenseCurrency(trip?.currency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CZK">CZK - Koruna</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DeleteInline label="Smazat výlet" onConfirm={() => { void actions.deleteTrip(); onClose(); }} />

          <button className="btn primary block lg mt20" type="submit">Uložit nastavení</button>
        </ValidatedForm>
      </SheetContent>
    </Sheet>
  );
}

/* ──────────────────────────────────────────────────────────
   CREATE POLL SHEET (desktop-aware)
────────────────────────────────────────────────────────── */
export function CreatePollDialog({ planner, onClose }: { planner: TripPlannerController; onClose: () => void }) {
  const { actions } = planner;
  const [opts, setOpts] = useState(['', '']);
  const [multi, setMulti] = useState(false);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <SheetHead title="Nová anketa" onClose={onClose} />
        <ValidatedForm
          className="px18"
          style={{ paddingBottom: 18 }}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void actions.createPoll({ question: String(fd.get('question') ?? ''), options: opts.filter(Boolean), multiChoice: multi });
            onClose();
          }}
        >
          <Label htmlFor="pollQuestionSheet">Otázka</Label>
          <Input id="pollQuestionSheet" name="question" placeholder="Co bychom měli rozhodnout?" autoFocus required />

          <label className="field-label mt16">Možnosti</label>
          <div className="col g8">
            {opts.map((o, i) => (
              <div key={i} className="input">
                <Circle size={16} />
                <input placeholder={`Možnost ${i + 1}`} value={o} onChange={(e) => setOpts(opts.map((v, j) => j === i ? e.target.value : v))} required={i < 2} />
                {opts.length > 2 && <span className="pressable faint" style={{ cursor: 'pointer' }} onClick={() => setOpts(opts.filter((_, j) => j !== i))}><X size={16} /></span>}
              </div>
            ))}
            <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} type="button" onClick={() => setOpts([...opts, ''])}>
              <Plus size={15} />Přidat možnost
            </button>
          </div>

          <label className="field-label mt16">Hlasy na osobu</label>
          <ChipGroup
            value={multi ? 'multi' : 'single'}
            onValueChange={(value) => setMulti(value === 'multi')}
            options={[
              { value: 'single', label: 'Jedna volba' },
              { value: 'multi', label: 'Více voleb' },
            ]}
          />

          <button className="btn primary block lg mt20" type="submit">Vytvořit anketu</button>
        </ValidatedForm>
      </SheetContent>
    </Sheet>
  );
}
