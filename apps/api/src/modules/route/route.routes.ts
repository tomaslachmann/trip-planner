import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole, requireTripUsers } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, routePlanIdParamSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { createRoutePlanSchema, deleteRoutePlanSchema, optimizeRoutePlanSchema, routePlanListResponseSchema, routePlanResponseSchema, updateRoutePlanSchema } from './route.schemas.js';
import { distanceMeters, optimizePlaceOrder, resolveRouteLeg } from './route.service.js';

type TravelMode = 'DRIVE' | 'WALK' | 'BIKE' | 'TRANSIT';
type PlaceForRoute = { id: string; latitude: number; longitude: number };

async function getPlacesForRoute(tripId: string, placeIds: string[]) {
  const places = await prisma.place.findMany({
    where: { tripId, id: { in: placeIds } },
    select: { id: true, latitude: true, longitude: true },
  });
  if (places.length !== new Set(placeIds).size) throw httpError(400, 'All route places must belong to the trip');
  const byId = new Map(places.map((place) => [place.id, place]));
  return placeIds.map((placeId) => byId.get(placeId)).filter((place): place is PlaceForRoute => Boolean(place));
}

async function buildLegs(places: PlaceForRoute[], mode: TravelMode) {
  return Promise.all(places.slice(0, -1).map(async (fromPlace, index) => {
    const toPlace = places[index + 1];
    const leg = await resolveRouteLeg(fromPlace, toPlace, mode);
    return {
      fromPlaceId: fromPlace.id,
      toPlaceId: toPlace.id,
      order: index,
      ...leg,
    };
  }));
}

async function assertParticipantsAvailable(tripId: string, participantUserIds: string[] | undefined, startsAt?: string, endsAt?: string) {
  if (!participantUserIds?.length) return;
  await requireTripUsers(tripId, participantUserIds);
  if (!startsAt || !endsAt) return;

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const availableMembers = await prisma.tripMember.findMany({
    where: {
      tripId,
      userId: { in: participantUserIds },
      availabilityWindows: { some: { startsAt: { lte: start }, endsAt: { gte: end } } },
    },
  });
  if (availableMembers.length !== new Set(participantUserIds).size) {
    throw httpError(400, 'All route participants must be available for the selected route time');
  }
}

export async function routeRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['routes'],
      summary: 'List trip routes',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: routePlanListResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.routePlan.findMany({
      where: { tripId },
      include: { legs: { orderBy: { order: 'asc' }, include: { fromPlace: true, toPlace: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  routes.post('', {
    schema: {
      tags: ['routes'],
      summary: 'Create route plan from ordered places',
      security: [{ actorUserId: [] }],
      body: createRoutePlanSchema,
      response: { 201: routePlanResponseSchema },
    },
  }, async (request, reply) => {
    const body = createRoutePlanSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    const places = await getPlacesForRoute(body.tripId, body.placeIds);
    const legs = await buildLegs(places, body.mode);

    const route = await prisma.routePlan.create({
      data: {
        tripId: body.tripId,
        name: body.name,
        mode: body.mode,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        legs: { create: legs },
      },
      include: { legs: { orderBy: { order: 'asc' }, include: { fromPlace: true, toPlace: true } } },
    });
    return reply.code(201).send(route);
  });

  routes.post('/optimize', {
    schema: {
      tags: ['routes'],
      summary: 'Create optimized route plan',
      security: [{ actorUserId: [] }],
      body: optimizeRoutePlanSchema,
      response: { 201: routePlanResponseSchema },
    },
  }, async (request, reply) => {
    const body = optimizeRoutePlanSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    await assertParticipantsAvailable(body.tripId, body.participantUserIds, body.startsAt, body.endsAt);

    const places = await getPlacesForRoute(body.tripId, body.placeIds);
    const optimizedPlaces = optimizePlaceOrder(places);
    const legs = await buildLegs(optimizedPlaces, body.mode);

    const route = await prisma.routePlan.create({
      data: {
        tripId: body.tripId,
        name: body.name,
        mode: body.mode,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        legs: { create: legs },
      },
      include: { legs: { orderBy: { order: 'asc' }, include: { fromPlace: true, toPlace: true } } },
    });
    return reply.code(201).send(route);
  });

  routes.patch('/:routePlanId', {
    schema: {
      tags: ['routes'],
      summary: 'Update route plan',
      security: [{ actorUserId: [] }],
      params: routePlanIdParamSchema,
      body: updateRoutePlanSchema,
      response: { 200: routePlanResponseSchema },
    },
  }, async (request) => {
    const { routePlanId } = request.params as { routePlanId: string };
    const body = updateRoutePlanSchema.parse(request.body);
    const route = await prisma.routePlan.findUniqueOrThrow({ where: { id: routePlanId } });
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(route.tripId, actorUserId, 'ADMIN');

    return prisma.routePlan.update({
      where: { id: routePlanId },
      data: { name: body.name, locked: body.locked },
      include: { legs: { orderBy: { order: 'asc' }, include: { fromPlace: true, toPlace: true } } },
    });
  });

  routes.delete('/:routePlanId', {
    schema: {
      tags: ['routes'],
      summary: 'Delete route plan',
      security: [{ actorUserId: [] }],
      params: routePlanIdParamSchema,
      body: deleteRoutePlanSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { routePlanId } = request.params as { routePlanId: string };
    const body = deleteRoutePlanSchema.parse(request.body ?? {});
    const route = await prisma.routePlan.findUniqueOrThrow({ where: { id: routePlanId } });
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(route.tripId, actorUserId, 'ADMIN');
    await prisma.routePlan.delete({ where: { id: routePlanId } });
    return reply.code(204).send(null);
  });
}
