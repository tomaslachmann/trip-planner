'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PollsPanel } from '@/features/trips/components/polls-panel';
import { useModal } from '@/features/trips/context/modal-context';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function PollsPageContent({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  return (
    <PollsPanel
      desktop={desktop}
      polls={state.data.polls}
      actorUserId={state.actorUserId}
      members={state.selectedTrip?.members ?? []}
      onBack={desktop ? undefined : () => actions.setActiveTab('more')}
      onCreate={(input) => void actions.createPoll(input)}
      onVote={(optionId) => void actions.votePollOption(optionId)}
      onUnvote={(optionId) => void actions.unvotePollOption(optionId)}
      onStatusChange={(pollId, status) => void actions.updatePoll(pollId, { status })}
      onDelete={(pollId) => void actions.deletePoll(pollId)}
    />
  );
}

function DesktopPollsPage({ planner }: { planner: TripPlannerController }) {
  const { state } = planner;
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
        <PollsPageContent planner={planner} desktop />
      </div>
    </div>
  );
}

export default function TripPollsPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopPollsPage planner={planner} /> : <PollsPageContent planner={planner} />;
}
