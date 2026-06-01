'use client';

import { ArrowLeft, Link, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MembersPanel } from '@/features/trips/components/members-panel';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function inviteLink(inviteCode?: string) {
  if (!inviteCode) return '';
  if (typeof window === 'undefined') return inviteCode;
  return `${window.location.origin}/join/${inviteCode}`;
}

function copyInvite(inviteCode?: string) {
  const link = inviteLink(inviteCode);
  if (link) void navigator.clipboard.writeText(link);
}

function MembersPageContent({ planner, hideInvite = false }: { planner: TripPlannerController; hideInvite?: boolean }) {
  const { state, actions } = planner;
  return (
    <MembersPanel
      trip={state.selectedTrip}
      actorUserId={state.actorUserId}
      actorRole={state.actorMember?.role}
      hideInvite={hideInvite}
      onInvite={() => copyInvite(state.selectedTrip?.inviteCode)}
      onCopyInvite={() => copyInvite(state.selectedTrip?.inviteCode)}
      onAddAvailability={(memberId, data) => void actions.addAvailability(memberId, data)}
      onUpdateAvailability={(availabilityId, data) => void actions.updateAvailability(availabilityId, data)}
      onDeleteAvailability={(availabilityId) => void actions.deleteAvailability(availabilityId)}
      onUpdateRole={(memberId, role) => void actions.updateTripMemberRole(memberId, role)}
      onUpdatePlanning={(memberId, input) => void actions.updateMemberPlanning(memberId, input)}
    />
  );
}

function DesktopMembersPage({ planner }: { planner: TripPlannerController }) {
  const { state } = planner;
  const memberCount = state.selectedTrip?.members?.length ?? 0;
  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <div className="maxw" style={{ maxWidth: 720 }}>
          <div className="row between mb16">
            <div className="row g10">
              <h1 className="desk-h">Členové</h1>
              <span className="badge muted">{memberCount}</span>
            </div>
            <div className="row g10">
              <Button variant="outline" type="button" onClick={() => copyInvite(state.selectedTrip?.inviteCode)}>
                <Link size={16} />Kopírovat pozvánku
              </Button>
              <Button type="button" onClick={() => copyInvite(state.selectedTrip?.inviteCode)}>
                <UserPlus size={16} />Pozvat
              </Button>
            </div>
          </div>
          <MembersPageContent planner={planner} hideInvite />
        </div>
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
        <Button size="icon" variant="outline" type="button" aria-label="Kopírovat pozvánku" onClick={() => copyInvite(state.selectedTrip?.inviteCode)}><Link /></Button>
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
