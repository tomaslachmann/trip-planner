import { z } from 'zod';
import { actorUserIdSchema } from '../../utils/schemas.js';

export const createPollSchema = actorUserIdSchema.extend({
  tripId: z.string().min(1),
  question: z.string().min(1),
  multiChoice: z.boolean().default(false),
  closesAt: z.string().datetime().optional(),
  contextDayId: z.string().min(1).optional(),
  contextPlaceId: z.string().min(1).optional(),
  options: z.array(z.object({
    title: z.string().min(1),
    placeId: z.string().min(1).optional(),
    itineraryDayId: z.string().min(1).optional(),
  })).min(2),
});

export const updatePollSchema = actorUserIdSchema.extend({
  question: z.string().min(1).optional(),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  multiChoice: z.boolean().optional(),
  closesAt: z.string().datetime().nullable().optional(),
});

export const votePollOptionSchema = actorUserIdSchema.extend({
  userId: z.string().min(1).optional(),
});

export const deletePollSchema = actorUserIdSchema;
