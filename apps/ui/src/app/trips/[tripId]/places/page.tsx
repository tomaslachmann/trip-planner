import { TripPlacesRoute } from '@/features/trips/routes/trip-places-route';

export default async function TripPlacesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripPlacesRoute tripId={tripId} />;
}
