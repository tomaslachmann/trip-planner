import { prisma } from '../../db/prisma.js';
import type { Prisma } from '@prisma/client';

export type ActivityInput = {
  tripId: string;
  actorUserId?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  label: string;
  metadata?: Record<string, unknown>;
};

export async function recordActivity(input: ActivityInput) {
  return prisma.activityEvent.create({
    data: {
      tripId: input.tripId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      label: input.label,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
