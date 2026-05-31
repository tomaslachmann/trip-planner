import { TripItineraryRoute } from '@/features/trips/routes/trip-itinerary-route';

export default async function TripItineraryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripItineraryRoute tripId={tripId} />;
}
