'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccessScreen } from './components/access-screen';
import { TripPickerScreen } from './components/trip-picker-screen';
import { useTripPlanner } from './hooks/use-trip-planner';

function EmptyTrip({ onCreate }: { onCreate: (data: FormData) => void }) {
  return (
    <div className="app-empty-stage">
      <form
        className="empty-trip-form"
        style={{ width: 420, maxWidth: 'calc(100vw - 32px)' }}
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(new FormData(event.currentTarget));
        }}
      >
        <Card className="p-[14px] shadow-[var(--sh-sm)]">
          <div className="t-title mb8">Vytvořit trip</div>
          <p className="muted t-sm mb16">Zatím není co zobrazit.</p>
          <Label htmlFor="name">Název tripu</Label>
          <Input className="mb-3" id="name" name="name" placeholder="Barcelona 2026" />
          <Label htmlFor="destination">Destinace</Label>
          <Input className="mb-3" id="destination" name="destination" placeholder="Barcelona" />
          <Label htmlFor="currency">Měna</Label>
          <Input className="mb-3 uppercase" id="currency" name="currency" defaultValue="CZK" maxLength={3} placeholder="CZK" />
          <Button className="w-full" type="submit"><Plus />Vytvořit</Button>
        </Card>
      </form>
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
          <div className="t-h2">Načítám tripy...</div>
          <div className="muted t-sm mt8">Načítám data.</div>
        </Card>
      </div>
    );
  }

  if (!state.viewerEmail) {
    return <AccessScreen message={state.message} onSignIn={(data) => actions.signIn(data)} />;
  }

  if (creatingTrip || (!state.trips.length && !state.availableTrips.length)) {
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
      onCreateTrip={() => setCreatingTrip(true)}
      onSignOut={actions.signOut}
    />
  );
}
