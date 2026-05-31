import { TripPollsRoute } from '@/features/trips/routes/trip-polls-route';

export default async function TripPollsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripPollsRoute tripId={tripId} />;
}
