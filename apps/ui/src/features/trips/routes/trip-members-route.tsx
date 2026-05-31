'use client';

import { ArrowLeft, Link, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MembersPanel } from '../components/members-panel';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';

function DesktopMembers({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="desk-body">
      <div className="desk-scroll maxw">
        <MembersPanel
          trip={state.selectedTrip}
          actorUserId={state.actorUserId}
          actorRole={state.actorMember?.role}
          onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)}
          onUpdateAvailability={(availabilityId, data) => void actions.updateAvailability(availabilityId, data)}
          onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)}
          onUpdateRole={(memberId, role) => void actions.updateTripMemberRole(memberId, role)}
        />
      </div>
    </div>
  );
}

function MobileMembers({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="screen">
      <div className="appbar">
        <Button size="icon" variant="ghost" type="button" onClick={() => actions.setActiveTab('more')}><ArrowLeft /></Button>
        <span className="t-h3 flex1">Členové</span>
        <Button size="icon" variant="outline" type="button" aria-label="Kód pozvánky"><Link /></Button>
      </div>
      <div className="px18" style={{ flex: '0 0 auto' }}>
        <Button className="w-full" type="button" onClick={() => state.selectedTrip?.inviteCode && navigator.clipboard.writeText(state.selectedTrip.inviteCode)}>
          <UserPlus />Pozvat lidi
        </Button>
      </div>
      <div className="scroll px18" style={{ flex: 1, paddingTop: 8, paddingBottom: 18 }}>
        <MembersPanel
          trip={state.selectedTrip}
          actorUserId={state.actorUserId}
          actorRole={state.actorMember?.role}
          onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)}
          onUpdateAvailability={(availabilityId, data) => void actions.updateAvailability(availabilityId, data)}
          onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)}
          onUpdateRole={(memberId, role) => void actions.updateTripMemberRole(memberId, role)}
        />
      </div>
    </div>
  );
}

export function TripMembersRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="members">
      {(planner) => <RoutePair planner={planner} mobile={<MobileMembers planner={planner} />} desktop={<DesktopMembers planner={planner} />} />}
    </TripRouteRuntime>
  );
}
