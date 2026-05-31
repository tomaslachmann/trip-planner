import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { emptyResponseSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { discoverLocationsSchema, reverseLocationSchema, searchLocationsSchema, shareLiveLocationSchema } from './location.schemas.js';
import { discoverLocations, reverseLocation, searchLocations } from './location.service.js';

export async function locationRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/search', {
    schema: {
      tags: ['locations'],
      summary: 'Search locations via OpenStreetMap Nominatim',
      security: [{ bearerAuth: [] }],
      querystring: searchLocationsSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    getActorUserId(request);
    const query = searchLocationsSchema.parse(request.query);
    return { provider: 'nominatim', results: await searchLocations(query) };
  });

  routes.get('/reverse', {
    schema: {
      tags: ['locations'],
      summary: 'Reverse geocode coordinates via OpenStreetMap Nominatim',
      security: [{ bearerAuth: [] }],
      querystring: reverseLocationSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    getActorUserId(request);
    const query = reverseLocationSchema.parse(request.query);
    return reverseLocation(query);
  });

  routes.get('/discover', {
    schema: {
      tags: ['locations'],
      summary: 'Discover nearby map places via OpenStreetMap Overpass',
      security: [{ bearerAuth: [] }],
      querystring: discoverLocationsSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    getActorUserId(request);
    const query = discoverLocationsSchema.parse(request.query);
    return { provider: 'overpass', results: await discoverLocations(query) };
  });

  routes.get('/live/trip/:tripId', {
    schema: {
      tags: ['locations'],
      summary: 'List active live locations for trip members',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    const now = new Date();
    return prisma.userLiveLocation.findMany({
      where: {
        tripId,
        OR: [{ sharedUntil: null }, { sharedUntil: { gt: now } }],
      },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
    });
  });

  routes.patch('/live/trip/:tripId', {
    schema: {
      tags: ['locations'],
      summary: 'Share own live location in a trip',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      body: shareLiveLocationSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const body = shareLiveLocationSchema.parse(request.body);
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    const sharedUntil = new Date(Date.now() + body.sharedMinutes * 60 * 1000);
    return prisma.userLiveLocation.upsert({
      where: { tripId_userId: { tripId, userId: actorUserId } },
      create: {
        tripId,
        userId: actorUserId,
        latitude: body.latitude,
        longitude: body.longitude,
        accuracyMeters: body.accuracyMeters ?? undefined,
        sharedUntil,
      },
      update: {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracyMeters: body.accuracyMeters ?? undefined,
        sharedUntil,
      },
      include: { user: true },
    });
  });

  routes.delete('/live/trip/:tripId', {
    schema: {
      tags: ['locations'],
      summary: 'Stop sharing own live location in a trip',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    await prisma.userLiveLocation.deleteMany({ where: { tripId, userId: actorUserId } });
    return reply.code(204).send(null);
  });
}
