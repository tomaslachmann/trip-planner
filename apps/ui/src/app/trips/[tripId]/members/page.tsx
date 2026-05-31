import { TripMembersRoute } from '@/features/trips/routes/trip-members-route';

export default async function TripMembersPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripMembersRoute tripId={tripId} />;
}
