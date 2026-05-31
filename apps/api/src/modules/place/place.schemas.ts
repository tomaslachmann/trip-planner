import { z } from 'zod';
import { actorUserIdSchema, latitudeSchema, longitudeSchema } from '../../utils/schemas.js';

const weatherSuitabilitySchema = z.enum(['INDOOR', 'OUTDOOR', 'MIXED']);
const placeStatusSchema = z.enum(['PROPOSED', 'SHORTLISTED', 'APPROVED', 'REJECTED']);

export const createPlaceSchema = z.object({
  tripId: z.string().min(1),
  type: z.enum(['PLACE','ACTIVITY','DAY_TRIP','STAY_AREA','ACCOMMODATION','FOOD','TRANSPORT','CUSTOM']),
  status: placeStatusSchema.default('PROPOSED'),
  name: z.string().min(1),
  description: z.string().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  durationMin: z.number().int().positive().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  sourceUrl: z.string().url().optional(),
  weatherSuitability: weatherSuitabilitySchema.default('MIXED'),
});

export const updatePlaceSchema = actorUserIdSchema.extend({
  type: z.enum(['PLACE','ACTIVITY','DAY_TRIP','STAY_AREA','ACCOMMODATION','FOOD','TRANSPORT','CUSTOM']).optional(),
  status: placeStatusSchema.optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  durationMin: z.number().int().positive().nullable().optional(),
  estimatedCost: z.number().nonnegative().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  weatherSuitability: weatherSuitabilitySchema.optional(),
  accommodationStatus: z.enum(['SAVED','SHORTLISTED','SELECTED','BOOKED','REJECTED']).nullable().optional(),
});

export const votePlaceSchema = actorUserIdSchema.extend({
  value: z.enum(['UP','DOWN','MAYBE','MUST_HAVE']),
});

export const commentPlaceSchema = actorUserIdSchema.extend({
  body: z.string().min(1),
});

export const deletePlaceSchema = actorUserIdSchema;
