import type { FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { httpError } from '../../utils/http.js';
import { requireJwt } from '../auth/jwt.js';

type TripRoleName = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

const roleRank: Record<TripRoleName, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  GUEST: 1,
};

export function getActorUserId(request: FastifyRequest, body?: { actorUserId?: string }): string {
  const actorUserId = requireJwt(request).sub;
  if (body?.actorUserId && body.actorUserId !== actorUserId) throw httpError(403, 'actorUserId must match authenticated user');
  return actorUserId;
}

export async function requireTripMember(tripId: string, userId: string) {
  const member = await prisma.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
  });
  if (!member) throw httpError(403, 'User is not a trip member');
  return member;
}

export async function requireTripRole(tripId: string, userId: string, minimumRole: TripRoleName) {
  const member = await requireTripMember(tripId, userId);
  if (roleRank[member.role] < roleRank[minimumRole]) {
    throw httpError(403, `Requires ${minimumRole} role`);
  }
  return member;
}

export async function requireTripUsers(tripId: string, userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];
  const members = await prisma.tripMember.findMany({
    where: { tripId, userId: { in: uniqueUserIds } },
  });
  if (members.length !== uniqueUserIds.length) {
    throw httpError(400, 'All selected users must be trip members');
  }
  return members;
}

export async function requireTripMembersByIds(tripId: string, tripMemberIds: string[]) {
  const uniqueMemberIds = [...new Set(tripMemberIds)];
  const members = await prisma.tripMember.findMany({
    where: { tripId, id: { in: uniqueMemberIds } },
  });
  if (members.length !== uniqueMemberIds.length) {
    throw httpError(400, 'All selected trip members must belong to the trip');
  }
  return members;
}
