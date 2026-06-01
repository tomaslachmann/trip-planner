'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { AccommodationDetailPanel } from '@/features/trips/components/accommodation-detail-panel';
import { MapScreen } from '@/features/trips/components/map-screen';
import { PlaceDetailPanel } from '@/features/trips/components/place-detail-panel';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function DesktopMapPage({ planner }: { planner: TripPlannerController }) {
  return (
    <DndContext collisionDetection={closestCenter}>
      <div className="desk-body">
        <MapScreen planner={planner} desktop />
        <aside className="desk-panel">
          {planner.state.selectedAccommodation ? <AccommodationDetailPanel planner={planner} /> : <PlaceDetailPanel planner={planner} compact />}
        </aside>
      </div>
    </DndContext>
  );
}

export default function TripMapPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopMapPage planner={planner} /> : <MapScreen planner={planner} />;
}
