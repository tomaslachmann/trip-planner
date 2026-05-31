import { z } from 'zod';

export const createPlaceSchema = z.object({
  tripId: z.string().min(1),
  createdById: z.string().min(1),
  type: z.enum(['PLACE','ACTIVITY','DAY_TRIP','STAY_AREA','ACCOMMODATION','FOOD','TRANSPORT','CUSTOM']),
  name: z.string().min(1),
  description: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  durationMin: z.number().int().positive().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  sourceUrl: z.string().url().optional(),
});

export const votePlaceSchema = z.object({
  userId: z.string().min(1),
  value: z.enum(['UP','DOWN','MAYBE','MUST_HAVE']),
});

export const commentPlaceSchema = z.object({
  userId: z.string().min(1),
  body: z.string().min(1),
});
