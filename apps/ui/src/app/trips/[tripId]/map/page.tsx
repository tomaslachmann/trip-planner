import { TripRoutePage } from '@/features/trips/trip-route-page';

export default async function TripMapPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripRoutePage tripId={tripId} view="map" />;
}
