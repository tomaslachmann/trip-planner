import { TripJoinPage } from '@/features/trips/trip-join-page';

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;
  return <TripJoinPage inviteCode={inviteCode} />;
}
