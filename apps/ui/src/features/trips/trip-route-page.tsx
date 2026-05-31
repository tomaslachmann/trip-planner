import { TripPlannerPage } from './trip-planner-page';
import type { TabKey } from './types';

export function TripRoutePage({ tripId, view }: { tripId: string; view: TabKey }) {
  return <TripPlannerPage routeTripId={tripId} routeView={view} />;
}
