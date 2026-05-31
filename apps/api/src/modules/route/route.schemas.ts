import { z } from 'zod';
import { dateTimeResponseSchema, nullableDateTimeResponseSchema } from '../../utils/openapiSchemas.js';
import { actorUserIdSchema, refineDateRange } from '../../utils/schemas.js';

const travelModeSchema = z.enum(['DRIVE', 'WALK', 'BIKE', 'TRANSIT']);

export const createRoutePlanSchema = refineDateRange(actorUserIdSchema.extend({
  tripId: z.string().min(1),
  name: z.string().min(1),
  mode: travelModeSchema.default('DRIVE'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  placeIds: z.array(z.string().min(1)).min(2),
}));

export const optimizeRoutePlanSchema = refineDateRange(actorUserIdSchema.extend({
  tripId: z.string().min(1),
  name: z.string().min(1).default('Optimized route'),
  mode: travelModeSchema.default('DRIVE'),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  placeIds: z.array(z.string().min(1)).min(2),
  participantUserIds: z.array(z.string().min(1)).optional(),
}));

export const updateRoutePlanSchema = actorUserIdSchema.extend({
  name: z.string().min(1).optional(),
  locked: z.boolean().optional(),
});

export const deleteRoutePlanSchema = actorUserIdSchema;

export const routeLegResponseSchema = z.object({
  id: z.string(),
  routePlanId: z.string(),
  fromPlaceId: z.string(),
  toPlaceId: z.string(),
  order: z.number().int(),
  distanceMeters: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  encodedPolyline: z.string().nullable(),
  provider: z.string().nullable(),
  fromPlace: z.unknown().optional(),
  toPlace: z.unknown().optional(),
});

export const routePlanResponseSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  name: z.string(),
  mode: travelModeSchema,
  startsAt: nullableDateTimeResponseSchema,
  endsAt: nullableDateTimeResponseSchema,
  locked: z.boolean(),
  createdAt: dateTimeResponseSchema,
  legs: z.array(routeLegResponseSchema),
});

export const routePlanListResponseSchema = z.array(routePlanResponseSchema);
