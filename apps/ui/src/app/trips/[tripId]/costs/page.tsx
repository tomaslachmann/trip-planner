import { TripCostsRoute } from '@/features/trips/routes/trip-costs-route';

export default async function TripCostsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripCostsRoute tripId={tripId} />;
}
