import { TripStayRoute } from '@/features/trips/routes/trip-stay-route';

export default async function TripStayPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripStayRoute tripId={tripId} />;
}
