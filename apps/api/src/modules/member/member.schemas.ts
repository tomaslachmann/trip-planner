import { z } from 'zod';
import { actorUserIdSchema, refineDateRange } from '../../utils/schemas.js';

export const createAvailabilitySchema = refineDateRange(actorUserIdSchema.extend({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  startPlaceId: z.string().min(1).optional(),
  endPlaceId: z.string().min(1).optional(),
  note: z.string().optional(),
}));

export const updateAvailabilitySchema = refineDateRange(actorUserIdSchema.extend({
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  startPlaceId: z.string().min(1).nullable().optional(),
  endPlaceId: z.string().min(1).nullable().optional(),
  note: z.string().nullable().optional(),
}));

export const deleteAvailabilitySchema = actorUserIdSchema;
