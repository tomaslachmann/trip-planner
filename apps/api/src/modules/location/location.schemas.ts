import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from '../../utils/schemas.js';

export const searchLocationsSchema = z.object({
  q: z.string().trim().min(2),
  limit: z.coerce.number().int().positive().max(10).default(5),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const reverseLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const discoverLocationsSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().positive().max(10000).default(2500),
  category: z.enum(['SIGHTS', 'FOOD', 'ACTIVITY', 'TRANSPORT']).default('SIGHTS'),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const wikipediaSummarySchema = z.object({
  name: z.string().trim().min(2),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  language: z.string().trim().regex(/^[a-z-]{2,12}$/i).default('cs'),
  radiusMeters: z.coerce.number().int().positive().max(10000).default(1200),
});

export const shareLiveLocationSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracyMeters: z.number().int().nonnegative().nullable().optional(),
  sharedMinutes: z.number().int().min(5).max(1440).default(240),
});
