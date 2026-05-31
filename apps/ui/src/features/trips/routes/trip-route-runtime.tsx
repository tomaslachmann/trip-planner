'use client';

import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AccessScreen } from '../components/access-screen';
import { TripPickerScreen } from '../components/trip-picker-screen';
import { useTripPlanner, type TripPlannerController } from '../hooks/use-trip-planner';
import type { TabKey } from '../types';

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
        <Card className="p-[16px] shadow-[var(--sh-sm)]">
          <div className="t-title mb8">Vytvořit trip</div>
          <p className="muted t-sm mb16">Zatím není co zobrazit.</p>
          <Label htmlFor="name">Název tripu</Label>
          <Input className="mb10" id="name" name="name" placeholder="Barcelona 2026" />
          <Label htmlFor="destination">Destinace</Label>
          <Input className="mb10" id="destination" name="destination" placeholder="Barcelona" />
          <Button className="w-full" type="submit"><Plus />Vytvořit</Button>
        </Card>
      </form>
    </div>
  );
}

export function TripRouteRuntime({
  tripId,
  view,
  children,
}: {
  tripId: string;
  view: TabKey;
  children: (planner: TripPlannerController) => ReactNode;
}) {
  const planner = useTripPlanner({ routeTripId: tripId, routeView: view });
  const { state, actions } = planner;
  const [creatingTrip, setCreatingTrip] = useState(false);

  if (state.loading && !state.selectedTrip) {
    return (
      <div className="app-empty-stage">
        <Card className="center p-[16px] shadow-[var(--sh-sm)]">
          <div className="t-h2">Načítám trip...</div>
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

  if (!state.selectedTrip || !state.actorUserId) {
    return (
      <TripPickerScreen
        email={state.viewerEmail}
        joinedTrips={state.joinedTrips}
        availableTrips={state.availableTrips}
        message={state.message}
        onOpenTrip={(nextTripId) => void actions.openTrip(nextTripId)}
        onJoinTrip={(nextTripId) => void actions.joinTrip(nextTripId)}
        onJoinInviteCode={(inviteCode) => void actions.joinTripByInviteCode(inviteCode)}
        onCreateTrip={() => setCreatingTrip(true)}
        onSignOut={actions.signOut}
      />
    );
  }

  return <>{children(planner)}</>;
}
