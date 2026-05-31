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
