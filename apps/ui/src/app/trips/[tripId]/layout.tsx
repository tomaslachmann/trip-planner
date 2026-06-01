import { Suspense, type ReactNode } from 'react';
import { TripLayoutClient } from './trip-layout-client';

export default async function TripLayout({ children, params }: { children: ReactNode; params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return (
    <Suspense fallback={null}>
      <TripLayoutClient tripId={tripId}>{children}</TripLayoutClient>
    </Suspense>
  );
}
