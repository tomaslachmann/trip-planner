import { TripSettleRoute } from '@/features/trips/routes/trip-settle-route';

export default async function TripSettlePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripSettleRoute tripId={tripId} />;
}
