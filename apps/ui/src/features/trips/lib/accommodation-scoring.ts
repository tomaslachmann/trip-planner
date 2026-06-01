import type { Place, TripMember } from '../types';

export type AccommodationVoteValue = 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE';
export type AccommodationStatus = 'SAVED' | 'SHORTLISTED' | 'SELECTED' | 'BOOKED' | 'REJECTED';

export type AccommodationVoteStats = {
  selected: number;
  shortlist: number;
  maybe: number;
  against: number;
  totalVotes: number;
  totalSupport: number;
  score: number;
  missingVoters: TripMember[];
  myVote?: AccommodationVoteValue;
};

export const accommodationStatusMeta: Record<AccommodationStatus, { label: string; cls: string }> = {
  SAVED: { label: 'Uloženo', cls: 'muted' },
  SHORTLISTED: { label: 'Užší výběr', cls: 'amber' },
  SELECTED: { label: 'Vybráno', cls: 'green' },
  BOOKED: { label: 'Rezervováno', cls: 'green' },
  REJECTED: { label: 'Proti', cls: 'red' },
};

const validVoteValues = new Set<AccommodationVoteValue>(['UP', 'DOWN', 'MAYBE', 'MUST_HAVE']);
const validStatuses = new Set<AccommodationStatus>(['SAVED', 'SHORTLISTED', 'SELECTED', 'BOOKED', 'REJECTED']);

export function normalizeAccommodationStatus(value?: string | null): AccommodationStatus | undefined {
  const normalized = String(value ?? '').toUpperCase();
  return validStatuses.has(normalized as AccommodationStatus) ? normalized as AccommodationStatus : undefined;
}

export function getAccommodationVoteStats(place: Place, members: TripMember[] = [], actorUserId?: string): AccommodationVoteStats {
  const votes = (place.votes ?? []).filter((vote): vote is { userId?: string; value: AccommodationVoteValue } => validVoteValues.has(vote.value as AccommodationVoteValue));
  const votedUserIds = new Set(votes.map((vote) => vote.userId).filter(Boolean));
  const selected = votes.filter((vote) => vote.value === 'MUST_HAVE').length;
  const shortlist = votes.filter((vote) => vote.value === 'UP').length;
  const maybe = votes.filter((vote) => vote.value === 'MAYBE').length;
  const against = votes.filter((vote) => vote.value === 'DOWN').length;

  return {
    selected,
    shortlist,
    maybe,
    against,
    totalVotes: votes.length,
    totalSupport: selected + shortlist,
    score: selected * 3 + shortlist * 2 + maybe - against * 2,
    missingVoters: members.filter((member) => !votedUserIds.has(member.userId)),
    myVote: votes.find((vote) => vote.userId === actorUserId)?.value,
  };
}

export function deriveAccommodationStatus(place: Place, stats = getAccommodationVoteStats(place)): AccommodationStatus {
  const explicit = normalizeAccommodationStatus(place.accommodationStatus);
  if (explicit && explicit !== 'SAVED') return explicit;
  if (stats.selected > 0) return 'SELECTED';
  if (stats.shortlist > 0) return 'SHORTLISTED';
  if (stats.against > 0 && stats.against >= stats.totalSupport) return 'REJECTED';
  return 'SAVED';
}

export function getAccommodationStatusFlow(status: AccommodationStatus) {
  if (status === 'BOOKED') return { terminal: true, nextStatus: 'BOOKED' as const, actionLabel: 'Rezervováno' };
  if (status === 'SELECTED') return { terminal: false, nextStatus: 'BOOKED' as const, actionLabel: 'Rezervováno' };
  return { terminal: false, nextStatus: 'SELECTED' as const, actionLabel: 'Vybrat' };
}

export function getAccommodationSummary(place: Place, members: TripMember[] = [], actorUserId?: string) {
  const stats = getAccommodationVoteStats(place, members, actorUserId);
  const status = deriveAccommodationStatus(place, stats);
  return {
    stats,
    status,
    statusMeta: accommodationStatusMeta[status],
    statusFlow: getAccommodationStatusFlow(status),
  };
}
