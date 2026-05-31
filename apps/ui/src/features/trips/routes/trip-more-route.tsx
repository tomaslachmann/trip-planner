'use client';

import { MoreScreen } from '../components/more-screen';
import { TripRouteRuntime } from './trip-route-runtime';
import { RoutePair } from './trip-route-shells';

export function TripMoreRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="more">
      {(planner) => (
        <RoutePair
          planner={planner}
          mobile={<MoreScreen planner={planner} />}
          desktop={<MoreScreen planner={planner} desktop />}
        />
      )}
    </TripRouteRuntime>
  );
}
