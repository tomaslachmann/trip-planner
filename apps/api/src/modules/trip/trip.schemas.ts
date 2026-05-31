import { z } from 'zod';
import { dateTimeResponseSchema, nullableDateTimeResponseSchema } from '../../utils/openapiSchemas.js';
import { actorUserIdSchema, currencySchema, refineDateRange } from '../../utils/schemas.js';

export const createTripSchema = refineDateRange(z.object({
  name: z.string().min(1),
  destination: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  currency: currencySchema.default('CZK'),
  owner: z.object({ email: z.string().email(), name: z.string().min(1) }),
}));

export const updateTripSchema = refineDateRange(actorUserIdSchema.extend({
  name: z.string().min(1).optional(),
  destination: z.string().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  currency: currencySchema.optional(),
}));

export const joinTripSchema = z.object({
  inviteCode: z.string().min(1),
  user: z.object({ email: z.string().email(), name: z.string().min(1) }),
});

export const updateTripMemberRoleSchema = actorUserIdSchema.extend({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']),
});

export const deleteTripSchema = actorUserIdSchema;

const tripRoleResponseSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);

export const tripUserResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  createdAt: dateTimeResponseSchema,
});

export const tripMemberResponseSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  userId: z.string(),
  role: tripRoleResponseSchema,
  joinedAt: dateTimeResponseSchema,
  user: tripUserResponseSchema,
  availabilityWindows: z.array(z.unknown()).optional(),
  trip: z.unknown().optional(),
});

export const tripSummaryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  destination: z.string().nullable(),
  startsAt: nullableDateTimeResponseSchema,
  endsAt: nullableDateTimeResponseSchema,
  currency: z.string(),
  inviteCode: z.string(),
  createdAt: dateTimeResponseSchema,
  members: z.array(tripMemberResponseSchema),
});

export const tripSummaryListResponseSchema = z.array(tripSummaryResponseSchema);
