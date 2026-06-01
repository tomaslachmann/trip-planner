'use client';

import { ArrowLeft, Link, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MembersPanel } from '@/features/trips/components/members-panel';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function MembersPageContent({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <MembersPanel
      trip={state.selectedTrip}
      actorUserId={state.actorUserId}
      actorRole={state.actorMember?.role}
      onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)}
      onUpdateAvailability={(availabilityId, data) => void actions.updateAvailability(availabilityId, data)}
      onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)}
      onUpdateRole={(memberId, role) => void actions.updateTripMemberRole(memberId, role)}
      onUpdatePlanning={(memberId, input) => void actions.updateMemberPlanning(memberId, input)}
    />
  );
}

function DesktopMembersPage({ planner }: { planner: TripPlannerController }) {
  return (
    <div className="desk-body">
      <div className="desk-scroll maxw">
        <MembersPageContent planner={planner} />
      </div>
    </div>
  );
}

function MobileMembersPage({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="screen">
      <div className="appbar">
        <Button size="icon" variant="ghost" type="button" onClick={() => actions.setActiveTab('more')}><ArrowLeft /></Button>
        <span className="t-h3 flex1">Členové</span>
        <Button size="icon" variant="outline" type="button" aria-label="Kód pozvánky" onClick={() => state.selectedTrip?.inviteCode && navigator.clipboard.writeText(state.selectedTrip.inviteCode)}><Link /></Button>
      </div>
      <div className="px18" style={{ flex: '0 0 auto' }}>
        <Button className="w-full" type="button" onClick={() => state.selectedTrip?.inviteCode && navigator.clipboard.writeText(state.selectedTrip.inviteCode)}>
          <UserPlus />Pozvat lidi
        </Button>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingTop: 8, paddingBottom: 18 }}>
        <MembersPageContent planner={planner} />
      </div>
    </div>
  );
}

export default function TripMembersPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopMembersPage planner={planner} /> : <MobileMembersPage planner={planner} />;
}
