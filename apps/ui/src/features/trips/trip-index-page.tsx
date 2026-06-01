'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ValidatedForm } from '@/components/ui/validated-form';
import { AccessScreen } from './components/access-screen';
import { TripPickerScreen } from './components/trip-picker-screen';
import { useTripPlanner } from './hooks/use-trip-planner';

function EmptyTrip({ onCreate }: { onCreate: (data: FormData) => void }) {
  const [startsAtDate, setStartsAtDate] = useState('');
  const [endsAtDate, setEndsAtDate] = useState('');

  return (
    <div className="app-empty-stage">
      <ValidatedForm
        className="empty-trip-form"
        style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(new FormData(event.currentTarget));
        }}
      >
        <Card className="p-[14px] shadow-[var(--sh-sm)]">
          <div className="t-title mb8">Vytvořit výlet</div>
          <p className="muted t-sm mb16">Zatím není co zobrazit.</p>
          <Label htmlFor="name">Název výletu</Label>
          <Input className="mb-3" id="name" name="name" placeholder="Barcelona 2026" required />
          <Label htmlFor="destination">Destinace</Label>
          <Input className="mb-3" id="destination" name="destination" placeholder="Barcelona" required />
          <div className="grid2 mb-3" style={{ gap: 8 }}>
            <div>
              <Label htmlFor="startsAt">Od</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="date"
                value={startsAtDate}
                max={endsAtDate || undefined}
                onChange={(event) => setStartsAtDate(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="endsAt">Do</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="date"
                value={endsAtDate}
                min={startsAtDate || undefined}
                data-after-field="startsAt"
                data-after-message="Datum konce výletu nemůže být před začátkem."
                onChange={(event) => setEndsAtDate(event.target.value)}
                required
              />
            </div>
          </div>
          <Label>Měna</Label>
          <Select name="currency" defaultValue="CZK">
            <SelectTrigger className="mb-3"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CZK">CZK - Koruna</SelectItem>
              <SelectItem value="EUR">EUR - Euro</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full" type="submit"><Plus />Vytvořit</Button>
        </Card>
      </ValidatedForm>
    </div>
  );
}

export function TripIndexPage() {
  const planner = useTripPlanner();
  const { state, actions } = planner;
  const [creatingTrip, setCreatingTrip] = useState(false);

  if (state.loading) {
    return (
      <div className="app-empty-stage">
        <Card className="center p-[14px] shadow-[var(--sh-sm)]">
          <div className="t-h2">Načítám výlety...</div>
          <div className="muted t-sm mt8">Načítám data.</div>
        </Card>
      </div>
    );
  }

  if (!state.viewerEmail) {
    return <AccessScreen message={state.message} onSignIn={(data) => actions.signIn(data)} />;
  }

  if (creatingTrip) {
    return <EmptyTrip onCreate={(data) => void actions.createTrip(data)} />;
  }

  return (
    <TripPickerScreen
      email={state.viewerEmail}
      joinedTrips={state.joinedTrips}
      availableTrips={state.availableTrips}
      message={state.message}
      onOpenTrip={(tripId) => void actions.openTrip(tripId)}
      onJoinTrip={(tripId) => void actions.joinTrip(tripId)}
      onJoinInviteCode={(inviteCode) => void actions.joinTripByInviteCode(inviteCode)}
      onCreateTrip={() => setCreatingTrip(true)}
      onSignOut={actions.signOut}
    />
  );
}
