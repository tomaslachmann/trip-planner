import { TripPlanRoute } from '@/features/trips/routes/trip-plan-route';

export default async function TripPlanPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripPlanRoute tripId={tripId} />;
}
