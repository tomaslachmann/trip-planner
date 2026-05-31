import { TripMapRoute } from '@/features/trips/routes/trip-map-route';

export default async function TripMapPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripMapRoute tripId={tripId} />;
}
