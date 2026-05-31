import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { recordActivity } from '../activity/activity.service.js';
import { saveAccommodationSchema, savedAccommodationResponseSchema, searchAccommodationsResponseSchema, searchAccommodationsSchema } from './accommodation.schemas.js';
import { searchAccommodations } from './accommodation.service.js';

export async function accommodationRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post('/search', {
    schema: {
      tags: ['accommodations'],
      summary: 'Search Booking accommodations for a trip',
      security: [{ bearerAuth: [] }],
      body: searchAccommodationsSchema,
      response: { 200: searchAccommodationsResponseSchema },
    },
  }, async (request) => {
    const body = searchAccommodationsSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    const results = await searchAccommodations(body);
    return { provider: 'booking' as const, results };
  });

  routes.post('/save', {
    schema: {
      tags: ['accommodations'],
      summary: 'Save an accommodation search result as a trip place',
      security: [{ bearerAuth: [] }],
      body: saveAccommodationSchema,
      response: { 201: savedAccommodationResponseSchema },
    },
  }, async (request, reply) => {
    const body = saveAccommodationSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    const place = await prisma.place.upsert({
      where: {
        tripId_accommodationProvider_accommodationExternalId: {
          tripId: body.tripId,
          accommodationProvider: body.provider,
          accommodationExternalId: body.externalId,
        },
      },
      create: {
        tripId: body.tripId,
        createdById: actorUserId,
        type: 'ACCOMMODATION',
        name: body.name,
        latitude: body.latitude,
        longitude: body.longitude,
        estimatedCost: body.priceTotal,
        sourceUrl: body.deepLinkUrl ?? body.sourceUrl,
        weatherSuitability: 'INDOOR',
        accommodationProvider: body.provider,
        accommodationExternalId: body.externalId,
        accommodationRating: body.rating,
        accommodationReviewScore: body.reviewScore,
        accommodationReviewCount: body.reviewCount,
        accommodationCurrency: body.currency,
        accommodationDeepLinkUrl: body.deepLinkUrl,
        accommodationStatus: 'SAVED',
      },
      update: {
        name: body.name,
        latitude: body.latitude,
        longitude: body.longitude,
        estimatedCost: body.priceTotal,
        sourceUrl: body.deepLinkUrl ?? body.sourceUrl,
        accommodationRating: body.rating,
        accommodationReviewScore: body.reviewScore,
        accommodationReviewCount: body.reviewCount,
        accommodationCurrency: body.currency,
        accommodationDeepLinkUrl: body.deepLinkUrl,
      },
    });
    await recordActivity({
      tripId: body.tripId,
      actorUserId,
      type: 'ACCOMMODATION_SAVED',
      entityType: 'place',
      entityId: place.id,
      label: `Uloženo ubytování ${place.name}`,
      metadata: { provider: body.provider, externalId: body.externalId },
    });
    return reply.code(201).send({
      ...place,
      type: 'ACCOMMODATION' as const,
      estimatedCost: place.estimatedCost === null ? null : Number(place.estimatedCost),
      accommodationProvider: place.accommodationProvider ?? body.provider,
      accommodationExternalId: place.accommodationExternalId ?? body.externalId,
    });
  });
}
