'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AccessScreen } from './components/access-screen';
import { TripButton, TripCard } from './components/design-system';
import { DesktopTripApp } from './components/desktop-trip-app';
import { MobileTripApp } from './components/mobile-trip-app';
import { TripPickerScreen } from './components/trip-picker-screen';
import { useTripPlanner } from './hooks/use-trip-planner';
import type { TabKey } from './types';

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
        <TripCard pad>
          <div className="t-title mb8">Vytvořit trip</div>
          <p className="muted t-sm mb16">Zatím není co zobrazit.</p>
          <label className="field-label" htmlFor="name">Název tripu</label>
          <input className="input mb10" id="name" name="name" placeholder="Barcelona 2026" />
          <label className="field-label" htmlFor="destination">Destinace</label>
          <input className="input mb10" id="destination" name="destination" placeholder="Barcelona" />
          <TripButton tone="primary" block type="submit"><Plus />Vytvořit</TripButton>
        </TripCard>
      </form>
    </div>
  );
}

export function TripPlannerPage({ routeTripId, routeView }: { routeTripId?: string; routeView?: TabKey }) {
  const planner = useTripPlanner({ routeTripId, routeView });
  const { state, actions } = planner;
  const [creatingTrip, setCreatingTrip] = useState(false);

  if (state.loading && !state.selectedTrip) {
    return (
      <div className="app-empty-stage">
        <TripCard pad className="center">
          <div className="t-h2">Načítám trip...</div>
          <div className="muted t-sm mt8">Načítám data.</div>
        </TripCard>
      </div>
    );
  }

  if (!state.viewerEmail) {
    return (
      <AccessScreen
        message={state.message}
        onSignIn={(data) => actions.signIn(data)}
      />
    );
  }

  if (creatingTrip || (!state.trips.length && !state.loading)) {
    return <EmptyTrip onCreate={(data) => void actions.createTrip(data)} />;
  }

  if (!state.selectedTrip || !state.actorUserId) {
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

  return (
    <>
      <MobileTripApp planner={planner} />
      <DesktopTripApp planner={planner} />
    </>
  );
}
