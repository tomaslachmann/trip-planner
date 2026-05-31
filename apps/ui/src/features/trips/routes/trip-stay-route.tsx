'use client';

import { PlanScreen } from '../components/plan-screen';
import { StayPanel } from '../components/stay-panel';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';

function DesktopStay({ planner }: { planner: TripPlannerController }) {
  const { state, actions } = planner;
  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <StayPanel
          layout="desktop"
          trip={state.selectedTrip}
          stays={state.accommodations}
          savedPlaces={state.data.places.filter((place) => place.type === 'ACCOMMODATION')}
          actorUserId={state.actorUserId}
          selectedId={state.selectedAccommodationId}
          searching={state.searchingStay}
          onSearch={(data) => void actions.searchStays(data)}
          onSelect={actions.setSelectedAccommodationId}
          onSelectSaved={actions.setSelectedPlaceId}
          onSave={(stay) => void actions.saveAccommodation(stay)}
          onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)}
          onStatusChange={(placeId, status) => void actions.updateAccommodationStatus(placeId, status)}
        />
      </div>
    </div>
  );
}

export function TripStayRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="stay">
      {(planner) => <RoutePair planner={planner} mobile={<PlanScreen planner={planner} forcedTab="stay" />} desktop={<DesktopStay planner={planner} />} />}
    </TripRouteRuntime>
  );
}
