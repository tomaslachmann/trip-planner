import { z } from 'zod';
import { dateTimeResponseSchema } from '../../utils/openapiSchemas.js';
import { actorUserIdSchema, currencySchema, latitudeSchema, longitudeSchema, refineDateRange } from '../../utils/schemas.js';

export const searchAccommodationsSchema = refineDateRange(actorUserIdSchema.extend({
  tripId: z.string().min(1),
  destination: z.string().min(1).optional(),
  checkin: z.string().date().optional(),
  checkout: z.string().date().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  adults: z.number().int().positive().default(2),
  rooms: z.number().int().positive().default(1),
  currency: currencySchema.default('EUR'),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  radiusKm: z.number().positive().max(100).default(15),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),
  limit: z.number().int().positive().max(50).default(20),
  bookingRequest: z.record(z.string(), z.unknown()).optional(),
}));

export const saveAccommodationSchema = actorUserIdSchema.extend({
  tripId: z.string().min(1),
  externalId: z.string().min(1),
  name: z.string().min(1),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  priceTotal: z.number().nonnegative().optional(),
  currency: currencySchema.optional(),
  rating: z.number().nonnegative().optional(),
  reviewScore: z.number().nonnegative().optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  sourceUrl: z.string().url().optional(),
  deepLinkUrl: z.string().url().optional(),
  photoUrl: z.string().url().optional(),
  provider: z.string().min(1).default('booking'),
});

export const accommodationSearchResultSchema = z.object({
  provider: z.literal('booking'),
  externalId: z.string(),
  name: z.string(),
  type: z.string().optional(),
  photoUrl: z.string().url().optional(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  priceTotal: z.number().optional(),
  priceDisplay: z.string().optional(),
  currency: currencySchema.optional(),
  rating: z.number().optional(),
  reviewScore: z.number().optional(),
  reviewCount: z.number().optional(),
  sourceUrl: z.string().url().optional(),
  deepLinkUrl: z.string().url().optional(),
  raw: z.unknown().optional(),
});

export const searchAccommodationsResponseSchema = z.object({
  provider: z.literal('booking'),
  results: z.array(accommodationSearchResultSchema),
});

export const savedAccommodationResponseSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  createdById: z.string(),
  type: z.literal('ACCOMMODATION'),
  name: z.string(),
  description: z.string().nullable(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  durationMin: z.number().int().nullable(),
  estimatedCost: z.number().nullable(),
  sourceUrl: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
  accommodationProvider: z.string(),
  accommodationExternalId: z.string(),
  accommodationRating: z.number().nullable(),
  accommodationReviewScore: z.number().nullable(),
  accommodationReviewCount: z.number().int().nullable(),
  accommodationCurrency: z.string().nullable(),
  accommodationDeepLinkUrl: z.string().url().nullable(),
  accommodationStatus: z.string().nullable(),
  createdAt: dateTimeResponseSchema,
});
