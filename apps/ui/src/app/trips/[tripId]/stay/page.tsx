'use client';

import { StayPanel } from '@/features/trips/components/stay-panel';
import { TripBar } from '@/features/trips/components/trip-bar';
import { useModal } from '@/features/trips/context/modal-context';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function StayPageContent({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  const { openModal } = useModal();
  return (
    <StayPanel
      layout={desktop ? 'desktop' : 'panel'}
      trip={state.selectedTrip}
      stays={state.accommodations}
      savedPlaces={state.data.places.filter((place) => place.type === 'ACCOMMODATION')}
      allPlaces={state.data.places}
      actorUserId={state.actorUserId}
      selectedId={state.selectedAccommodationId}
      hasSearched={state.accommodationSearchDone}
      searching={state.searchingStay}
      onSearch={(data) => void actions.searchStays(data)}
      onSearchLocations={actions.searchLocations}
      onManualAdd={() => openModal('addStay')}
      onSelect={actions.setSelectedAccommodationId}
      onSelectSaved={actions.setSelectedPlaceId}
      onSave={(stay) => void actions.saveAccommodation(stay)}
      onVotePlace={(placeId, value) => void actions.voteForPlace(placeId, value)}
      onStatusChange={(placeId, status) => void actions.updateAccommodationStatus(placeId, status)}
    />
  );
}

function DesktopStayPage({ planner }: { planner: TripPlannerController }) {
  return (
    <div className="desk-body">
      <div className="desk-scroll">
        <StayPageContent planner={planner} desktop />
      </div>
    </div>
  );
}

function MobileStayPage({ planner }: { planner: TripPlannerController }) {
  return (
    <div className="screen">
      <TripBar trip={planner.state.selectedTrip} />
      <StayPageContent planner={planner} />
    </div>
  );
}

export default function TripStayPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopStayPage planner={planner} /> : <MobileStayPage planner={planner} />;
}
