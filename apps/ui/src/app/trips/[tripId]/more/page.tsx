import { TripMoreRoute } from '@/features/trips/routes/trip-more-route';

export default async function TripMorePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripMoreRoute tripId={tripId} />;
}
