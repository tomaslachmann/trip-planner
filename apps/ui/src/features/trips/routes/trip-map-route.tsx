'use client';

import { DndContext, closestCenter } from '@dnd-kit/core';
import { MapScreen } from '../components/map-screen';
import { PlaceDetailPanel } from '../components/place-detail-panel';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { RoutePair } from './trip-route-shells';
import { TripRouteRuntime } from './trip-route-runtime';

function DesktopMap({ planner }: { planner: TripPlannerController }) {
  return (
    <DndContext collisionDetection={closestCenter}>
      <div className="desk-body">
        <MapScreen planner={planner} desktop />
        <aside className="desk-panel">
          <PlaceDetailPanel planner={planner} compact />
        </aside>
      </div>
    </DndContext>
  );
}

export function TripMapRoute({ tripId }: { tripId: string }) {
  return (
    <TripRouteRuntime tripId={tripId} view="map">
      {(planner) => <RoutePair planner={planner} mobile={<MapScreen planner={planner} />} desktop={<DesktopMap planner={planner} />} />}
    </TripRouteRuntime>
  );
}
