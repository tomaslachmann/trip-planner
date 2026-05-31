'use client';

import { ChecklistPanel } from '../components/checklist-panel';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';
import type { TripPlannerController } from '../hooks/use-trip-planner';

function DesktopChecklist({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="desk-body">
      <div className="desk-scroll" style={{ maxWidth: 640, margin: '0 auto' }}>
        <ChecklistPanel
          desktop
          items={state.data.checklist}
          actorUserId={state.actorUserId}
          members={state.selectedTrip?.members ?? []}
          onCreate={(input) => void actions.createChecklistItem(input)}
          onUpdate={(itemId, input) => void actions.updateChecklistItem(itemId, input)}
          onDelete={(itemId) => void actions.deleteChecklistItem(itemId)}
          onComplete={(itemId, completed) => void actions.completeChecklistItem(itemId, completed)}
        />
      </div>
    </div>
  );
}

function MobileChecklist({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <ChecklistPanel
      items={state.data.checklist}
      actorUserId={state.actorUserId}
      members={state.selectedTrip?.members ?? []}
      onBack={() => actions.setActiveTab('more')}
      onCreate={(input) => void actions.createChecklistItem(input)}
      onUpdate={(itemId, input) => void actions.updateChecklistItem(itemId, input)}
      onDelete={(itemId) => void actions.deleteChecklistItem(itemId)}
      onComplete={(itemId, completed) => void actions.completeChecklistItem(itemId, completed)}
    />
  );
}

export function TripChecklistRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="checklist">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<MobileChecklist planner={planner} />}
          desktop={<DesktopChecklist planner={planner} />}
        />
      )}
    </TripRouteRuntime>
  );
}
