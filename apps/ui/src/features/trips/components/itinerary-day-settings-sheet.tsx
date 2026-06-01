'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { ValidatedForm } from '@/components/ui/validated-form';
import { LocationCombobox } from './location-combobox';
import type { ItineraryDay, LocationResult, Place } from '../types';

type DayIntensity = 'CALM' | 'NORMAL' | 'INTENSE';

export type ItineraryDaySettingsInput = {
  title?: string | null;
  basePlaceId?: string | null;
  intensity?: DayIntensity;
  rainPlan?: string | null;
  bufferMinutes?: number;
  locked?: boolean;
};

const basePlaceNone = '__none';
const intensityOptions: Array<{ value: DayIntensity; label: string }> = [
  { value: 'CALM', label: 'Klidný' },
  { value: 'NORMAL', label: 'Normál' },
  { value: 'INTENSE', label: 'Intenzivní' },
];

function normalizeIntensity(value?: string | null): DayIntensity {
  return value === 'CALM' || value === 'INTENSE' ? value : 'NORMAL';
}

export function ItineraryDaySettingsSheet({
  day,
  places,
  onSearchLocations,
  onCreatePlace,
  onClose,
  onUpdate,
}: {
  day: ItineraryDay;
  places: Place[];
  onSearchLocations?: (query: string) => Promise<LocationResult[]>;
  onCreatePlace?: (formData: FormData) => Promise<Place | void>;
  onClose: () => void;
  onUpdate: (dayId: string, input: ItineraryDaySettingsInput) => void | Promise<void>;
}) {
  const [basePlaceId, setBasePlaceId] = useState(day.basePlaceId ?? basePlaceNone);
  const [intensity, setIntensity] = useState<DayIntensity>(normalizeIntensity(day.intensity));
  const [locked, setLocked] = useState(Boolean(day.locked));
  const [bufferMinutes, setBufferMinutes] = useState(String(day.bufferMinutes ?? 30));
  const basePlaceOptions = places;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent style={{ height: 'auto' }}>
        <div className="grabber" />
        <div className="sheet-head">
          <SheetTitle className="t-h3">Upravit den</SheetTitle>
          <Button variant="ghost" size="sm" type="button" onClick={onClose}>Zavřít</Button>
        </div>
        <ValidatedForm
          className="px18"
          style={{ paddingBottom: 18 }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void (async () => {
              let nextBasePlaceId = basePlaceId === basePlaceNone ? null : basePlaceId;
              const pickedLocationId = String(data.get('locationExternalId') ?? '').trim();
              if (pickedLocationId && onCreatePlace) {
                const label = String(data.get('locationLabel') ?? '').trim();
                const placeData = new FormData();
                placeData.set('placeName', label.split(',')[0]?.trim() || label);
                placeData.set('placeType', 'STAY_AREA');
                placeData.set('weatherSuitability', 'MIXED');
                placeData.set('latitude', String(data.get('latitude') ?? ''));
                placeData.set('longitude', String(data.get('longitude') ?? ''));
                placeData.set('notes', label);
                const created = await onCreatePlace(placeData);
                if (!created?.id) return;
                nextBasePlaceId = created.id;
              }
              await onUpdate(day.id, {
                title: String(data.get('title') ?? '').trim() || null,
                basePlaceId: nextBasePlaceId,
                intensity,
                rainPlan: String(data.get('rainPlan') ?? '').trim() || null,
                bufferMinutes: Math.max(0, Math.min(240, Number(bufferMinutes) || 0)),
                locked,
              });
              onClose();
            })();
          }}
        >
          <Label htmlFor="dayTitle">Název dne</Label>
          <Input id="dayTitle" name="title" defaultValue={day.title ?? ''} placeholder="Den 1" autoFocus />

          <Label className="mt14">Uložené místo dne</Label>
          <Select value={basePlaceId} onValueChange={setBasePlaceId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={basePlaceNone}>Bez navázaného místa</SelectItem>
              {basePlaceOptions.map((place) => (
                <SelectItem key={place.id} value={place.id}>{place.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onSearchLocations && onCreatePlace && (
            <>
              <Label className="mt14">Vyhledat nové místo dne</Label>
              <LocationCombobox onSearch={onSearchLocations} />
              <span className="muted t-xs mt6">Výběr z našeptávače se uloží jako místo a naváže na tenhle den.</span>
            </>
          )}

          <div className="row g12 mt14" style={{ alignItems: 'flex-start' }}>
            <div className="flex1">
              <Label>Tempo dne</Label>
              <Select value={intensity} onValueChange={(value) => setIntensity(value as DayIntensity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {intensityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div style={{ flex: '0 0 132px' }}>
              <Label htmlFor="dayBuffer">Rezerva</Label>
              <Input id="dayBuffer" value={bufferMinutes} onChange={(event) => setBufferMinutes(event.target.value)} type="number" min={0} max={240} step={5} />
            </div>
          </div>

          <Label className="mt14" htmlFor="dayRainPlan">Plán do deště</Label>
          <Textarea id="dayRainPlan" name="rainPlan" rows={3} defaultValue={day.rainPlan ?? ''} placeholder="Záložní varianta pro špatné počasí" />

          <label className="row g10 mt14">
            <Checkbox checked={locked} onCheckedChange={(checked) => setLocked(checked === true)} />
            <span className="col">
              <span className="t-sm medi">Zamknout den</span>
              <span className="muted t-xs">Zamčený den nejde dál měnit přes běžné přesuny zastávek.</span>
            </span>
          </label>

          <Button className="w-full mt16" type="submit">Uložit den</Button>
        </ValidatedForm>
      </SheetContent>
    </Sheet>
  );
}
