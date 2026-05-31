'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PollsPanel } from '../components/polls-panel';
import { useModal } from '../context/modal-context';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';
import type { TripPlannerController } from '../hooks/use-trip-planner';

function DesktopPolls({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  return (
    <div className="desk-body">
      <div className="desk-scroll" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 26px' }}>
        <div className="row between mb16">
          <div className="row g10">
            <h1 className="desk-h">Hlasování</h1>
            <span className="badge muted">{state.data.polls.length}</span>
          </div>
          <Button type="button" onClick={() => openModal('createPoll')}><Plus size={16} />Nová anketa</Button>
        </div>
        <PollsPanel
          desktop
          polls={state.data.polls}
          actorUserId={state.actorUserId}
          members={state.selectedTrip?.members ?? []}
          onCreate={(input) => void actions.createPoll(input)}
          onVote={(optionId) => void actions.votePollOption(optionId)}
          onUnvote={(optionId) => void actions.unvotePollOption(optionId)}
          onStatusChange={(pollId, status) => void actions.updatePoll(pollId, { status })}
          onDelete={(pollId) => void actions.deletePoll(pollId)}
        />
      </div>
    </div>
  );
}

function MobilePolls({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <PollsPanel
      polls={state.data.polls}
      actorUserId={state.actorUserId}
      members={state.selectedTrip?.members ?? []}
      onBack={() => actions.setActiveTab('more')}
      onCreate={(input) => void actions.createPoll(input)}
      onVote={(optionId) => void actions.votePollOption(optionId)}
      onUnvote={(optionId) => void actions.unvotePollOption(optionId)}
      onStatusChange={(pollId, status) => void actions.updatePoll(pollId, { status })}
      onDelete={(pollId) => void actions.deletePoll(pollId)}
    />
  );
}

export function TripPollsRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="polls">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<MobilePolls planner={planner} />}
          desktop={<DesktopPolls planner={planner} />}
        />
      )}
    </TripRouteRuntime>
  );
}
