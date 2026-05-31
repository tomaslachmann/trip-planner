import { TripChecklistRoute } from '@/features/trips/routes/trip-checklist-route';

export default async function TripChecklistPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripChecklistRoute tripId={tripId} />;
}
