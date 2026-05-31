import { z } from 'zod';
import { actorUserIdSchema, refineDateRange } from '../../utils/schemas.js';

export const createItineraryDaySchema = actorUserIdSchema.extend({
  tripId: z.string().min(1),
  date: z.string().datetime(),
  title: z.string().optional(),
  intensity: z.enum(['CALM', 'NORMAL', 'INTENSE']).default('NORMAL'),
  rainPlan: z.string().max(1000).optional(),
  bufferMinutes: z.number().int().min(0).max(240).default(30),
});

export const updateItineraryDaySchema = actorUserIdSchema.extend({
  date: z.string().datetime().optional(),
  title: z.string().nullable().optional(),
  basePlaceId: z.string().min(1).nullable().optional(),
  intensity: z.enum(['CALM', 'NORMAL', 'INTENSE']).optional(),
  rainPlan: z.string().max(1000).nullable().optional(),
  bufferMinutes: z.number().int().min(0).max(240).optional(),
  locked: z.boolean().optional(),
});

export const createItineraryStopSchema = refineDateRange(actorUserIdSchema.extend({
  placeId: z.string().min(1),
  order: z.number().int().nonnegative(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  note: z.string().optional(),
  tripMemberIds: z.array(z.string().min(1)).optional(),
}));

export const updateItineraryStopSchema = refineDateRange(actorUserIdSchema.extend({
  placeId: z.string().min(1).optional(),
  order: z.number().int().nonnegative().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  note: z.string().nullable().optional(),
  tripMemberIds: z.array(z.string().min(1)).optional(),
}));

export const lockItineraryDaySchema = actorUserIdSchema.extend({
  locked: z.boolean(),
});

export const syncItineraryDaysSchema = actorUserIdSchema;

export const placeDayVoteSchema = actorUserIdSchema.extend({
  userId: z.string().min(1).optional(),
  value: z.enum(['UP','DOWN','MAYBE','MUST_HAVE']),
});

export const reorderItineraryStopsSchema = actorUserIdSchema.extend({
  stopIds: z.array(z.string().min(1)).min(1),
});

export const deleteItinerarySchema = actorUserIdSchema;
