'use client';

import { ChecklistPanel } from '@/features/trips/components/checklist-panel';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function ChecklistPageContent({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  return (
    <ChecklistPanel
      desktop={desktop}
      items={state.data.checklist}
      actorUserId={state.actorUserId}
      members={state.selectedTrip?.members ?? []}
      onBack={desktop ? undefined : () => actions.setActiveTab('more')}
      onCreate={(input) => void actions.createChecklistItem(input)}
      onUpdate={(itemId, input) => void actions.updateChecklistItem(itemId, input)}
      onDelete={(itemId) => void actions.deleteChecklistItem(itemId)}
      onComplete={(itemId, completed) => void actions.completeChecklistItem(itemId, completed)}
    />
  );
}

function DesktopChecklistPage({ planner }: { planner: TripPlannerController }) {
  return (
    <div className="desk-body">
      <div className="desk-scroll" style={{ maxWidth: 640, margin: '0 auto' }}>
        <ChecklistPageContent planner={planner} desktop />
      </div>
    </div>
  );
}

export default function TripChecklistPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopChecklistPage planner={planner} /> : <ChecklistPageContent planner={planner} />;
}
