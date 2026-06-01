'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { MapScreen } from '@/features/trips/components/map-screen';
import { useTripPlannerContext, useTripViewport } from '@/features/trips/context/trip-planner-context';
import type { TripPlannerController } from '@/features/trips/hooks/use-trip-planner';

function DesktopMapPage({ planner }: { planner: TripPlannerController }) {
  return (
    <DndContext collisionDetection={closestCenter}>
      <MapScreen planner={planner} desktop />
    </DndContext>
  );
}

export default function TripMapPage() {
  const planner = useTripPlannerContext();
  const { isDesktop } = useTripViewport();
  return isDesktop ? <DesktopMapPage planner={planner} /> : <MapScreen planner={planner} />;
}
