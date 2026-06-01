'use client';

import { Plus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ValidatedForm } from '@/components/ui/validated-form';
import { AccessScreen } from '@/features/trips/components/access-screen';
import { TripPickerScreen } from '@/features/trips/components/trip-picker-screen';
import { TripPlannerProvider } from '@/features/trips/context/trip-planner-context';
import { useTripPlanner } from '@/features/trips/hooks/use-trip-planner';
import { DesktopRouteShell, MobileRouteShell } from '@/features/trips/components/trip-shell';
import type { TabKey } from '@/features/trips/types';

const routeBySegment: Record<string, TabKey> = {
  map: 'map',
  plan: 'plan',
  places: 'places',
  itinerary: 'itinerary',
  stay: 'stay',
  costs: 'costs',
  settle: 'settle',
  members: 'members',
  checklist: 'checklist',
  polls: 'polls',
  more: 'more',
  settings: 'settings',
};

function viewFromPath(pathname: string): TabKey {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'map';
  return routeBySegment[segment] ?? 'map';
}

function EmptyTrip({ onCreate }: { onCreate: (data: FormData) => void }) {
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
        <Card className="p-[16px] shadow-[var(--sh-sm)]">
          <div className="t-title mb8">Vytvořit výlet</div>
          <p className="muted t-sm mb16">Zatím není co zobrazit.</p>
          <Label htmlFor="name">Název výletu</Label>
          <Input className="mb10" id="name" name="name" placeholder="Barcelona 2026" required />
          <Label htmlFor="destination">Destinace</Label>
          <Input className="mb10" id="destination" name="destination" placeholder="Barcelona" required />
          <Button className="w-full" type="submit"><Plus />Vytvořit</Button>
        </Card>
      </ValidatedForm>
    </div>
  );
}

export function TripLayoutClient({ tripId, children }: { tripId: string; children: ReactNode }) {
  const pathname = usePathname();
  const routeView = useMemo(() => viewFromPath(pathname), [pathname]);
  const planner = useTripPlanner({ routeTripId: tripId, routeView });
  const { state, actions } = planner;
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 980px)');
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (state.loading && !state.selectedTrip) {
    return (
      <div className="app-empty-stage">
        <Card className="center p-[16px] shadow-[var(--sh-sm)]">
          <div className="t-h2">Načítám výlet...</div>
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

  if (isDesktop === null) return null;

  return (
    <TripPlannerProvider planner={planner} isDesktop={isDesktop}>
      {isDesktop
        ? <DesktopRouteShell planner={planner}>{children}</DesktopRouteShell>
        : <MobileRouteShell planner={planner}>{children}</MobileRouteShell>}
    </TripPlannerProvider>
  );
}
