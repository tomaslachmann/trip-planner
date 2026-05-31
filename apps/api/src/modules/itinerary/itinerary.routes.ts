import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripMembersByIds, requireTripRole } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, dayIdParamSchema, emptyResponseSchema, jsonResponseSchema, placeIdParamSchema, stopIdParamSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import {
  createItineraryDaySchema,
  createItineraryStopSchema,
  deleteItinerarySchema,
  lockItineraryDaySchema,
  placeDayVoteSchema,
  reorderItineraryStopsSchema,
  syncItineraryDaysSchema,
  updateStopAttendanceSchema,
  updateItineraryDaySchema,
  updateItineraryStopSchema,
} from './itinerary.schemas.js';
import { syncItineraryDaysForTrip } from './itinerary.service.js';

async function assertPlaceBelongsToTrip(tripId: string, placeId: string) {
  const place = await prisma.place.findUniqueOrThrow({ where: { id: placeId } });
  if (place.tripId !== tripId) throw httpError(400, 'Place must belong to itinerary trip');
}

async function getDayForMutation(dayId: string) {
  const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: dayId } });
  if (day.locked) throw httpError(409, 'Itinerary day is locked');
  return day;
}

async function assertParticipantsAvailableForStop(tripId: string, tripMemberIds: string[] | undefined, startsAt?: string | null, endsAt?: string | null) {
  if (!tripMemberIds?.length || !startsAt || !endsAt) return;

  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const availableMembers = await prisma.tripMember.findMany({
    where: {
      tripId,
      id: { in: tripMemberIds },
      OR: [
        { availabilityWindows: { none: {} } },
        { availabilityWindows: { some: { startsAt: { lte: start }, endsAt: { gte: end } } } },
      ],
    },
    select: { id: true },
  });

  if (availableMembers.length !== new Set(tripMemberIds).size) {
    throw httpError(400, 'All itinerary participants must be available for the selected stop time');
  }
}

export async function itineraryRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['itinerary'],
      summary: 'List trip itinerary days',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.itineraryDay.findMany({
      where: { tripId },
      orderBy: { date: 'asc' },
      include: {
        stops: {
          orderBy: { order: 'asc' },
          include: { place: true, participants: { include: { member: { include: { user: true } } } } },
        },
        basePlace: true,
        placeVotes: true,
      },
    });
  });

  routes.post('/trip/:tripId/sync-days', {
    schema: {
      tags: ['itinerary'],
      summary: 'Synchronize itinerary days from trip date range',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      body: syncItineraryDaysSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const body = syncItineraryDaysSchema.parse(request.body ?? {});
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(tripId, actorUserId, 'ADMIN');
    const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });
    return syncItineraryDaysForTrip(tripId, trip.startsAt, trip.endsAt);
  });

  routes.post('/days', {
    schema: {
      tags: ['itinerary'],
      summary: 'Create itinerary day',
      security: [{ bearerAuth: [] }],
      body: createItineraryDaySchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createItineraryDaySchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(body.tripId, actorUserId, 'ADMIN');
    const day = await prisma.itineraryDay.create({
      data: {
        tripId: body.tripId,
        date: new Date(body.date),
        title: body.title,
        intensity: body.intensity,
        rainPlan: body.rainPlan,
        bufferMinutes: body.bufferMinutes,
      },
      include: { stops: true },
    });
    return reply.code(201).send(day);
  });

  routes.patch('/days/:dayId', {
    schema: {
      tags: ['itinerary'],
      summary: 'Update itinerary day',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema,
      body: updateItineraryDaySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { dayId } = request.params as { dayId: string };
    const body = updateItineraryDaySchema.parse(request.body);
    const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: dayId } });
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(day.tripId, actorUserId, 'ADMIN');
    if (body.basePlaceId) await assertPlaceBelongsToTrip(day.tripId, body.basePlaceId);

    return prisma.itineraryDay.update({
      where: { id: dayId },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        title: body.title,
        basePlaceId: body.basePlaceId,
        intensity: body.intensity,
        rainPlan: body.rainPlan,
        bufferMinutes: body.bufferMinutes,
        locked: body.locked,
      },
      include: { basePlace: true, stops: { include: { place: true, participants: true } }, placeVotes: true },
    });
  });

  routes.put('/days/:dayId/places/:placeId/vote', {
    schema: {
      tags: ['itinerary'],
      summary: 'Vote for a place on a specific itinerary day',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema.merge(placeIdParamSchema),
      body: placeDayVoteSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { dayId, placeId } = request.params as { dayId: string; placeId: string };
    const body = placeDayVoteSchema.parse(request.body);
    const actorUserId = getActorUserId(request);
    const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: dayId } });
    await requireTripMember(day.tripId, actorUserId);
    await assertPlaceBelongsToTrip(day.tripId, placeId);
    return prisma.placeDayVote.upsert({
      where: { placeId_itineraryDayId_userId: { placeId, itineraryDayId: dayId, userId: actorUserId } },
      create: { placeId, itineraryDayId: dayId, userId: actorUserId, value: body.value },
      update: { value: body.value },
    });
  });

  routes.delete('/days/:dayId/places/:placeId/vote', {
    schema: {
      tags: ['itinerary'],
      summary: 'Remove own vote for a place on a specific itinerary day',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema.merge(placeIdParamSchema),
      body: syncItineraryDaysSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { dayId, placeId } = request.params as { dayId: string; placeId: string };
    const body = syncItineraryDaysSchema.parse(request.body ?? {});
    const actorUserId = getActorUserId(request, body);
    const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: dayId } });
    await requireTripMember(day.tripId, actorUserId);
    await prisma.placeDayVote.deleteMany({ where: { placeId, itineraryDayId: dayId, userId: actorUserId } });
    return reply.code(204).send(null);
  });

  routes.patch('/days/:dayId/lock', {
    schema: {
      tags: ['itinerary'],
      summary: 'Lock or unlock itinerary day',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema,
      body: lockItineraryDaySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { dayId } = request.params as { dayId: string };
    const body = lockItineraryDaySchema.parse(request.body);
    const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: dayId } });
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(day.tripId, actorUserId, 'ADMIN');
    return prisma.itineraryDay.update({ where: { id: dayId }, data: { locked: body.locked } });
  });

  routes.delete('/days/:dayId', {
    schema: {
      tags: ['itinerary'],
      summary: 'Delete itinerary day',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema,
      body: deleteItinerarySchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { dayId } = request.params as { dayId: string };
    const body = deleteItinerarySchema.parse(request.body ?? {});
    const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: dayId } });
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(day.tripId, actorUserId, 'ADMIN');
    await prisma.itineraryDay.delete({ where: { id: dayId } });
    return reply.code(204).send(null);
  });

  routes.post('/days/:dayId/stops', {
    schema: {
      tags: ['itinerary'],
      summary: 'Create itinerary stop',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema,
      body: createItineraryStopSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { dayId } = request.params as { dayId: string };
    const body = createItineraryStopSchema.parse(request.body);
    const day = await getDayForMutation(dayId);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(day.tripId, actorUserId);
    await assertPlaceBelongsToTrip(day.tripId, body.placeId);
    const participantIds = body.tripMemberIds ?? (await prisma.tripMember.findMany({
      where: { tripId: day.tripId },
      select: { id: true },
    })).map((member) => member.id);
    await requireTripMembersByIds(day.tripId, participantIds);
    await assertParticipantsAvailableForStop(day.tripId, participantIds, body.startsAt, body.endsAt);

    const stop = await prisma.itineraryStop.create({
      data: {
        dayId,
        placeId: body.placeId,
        order: body.order,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        note: body.note,
        participants: { create: participantIds.map((tripMemberId) => ({ tripMemberId })) },
      },
      include: { place: true, participants: true },
    });
    return reply.code(201).send(stop);
  });

  routes.patch('/stops/:stopId', {
    schema: {
      tags: ['itinerary'],
      summary: 'Update itinerary stop',
      security: [{ bearerAuth: [] }],
      params: stopIdParamSchema,
      body: updateItineraryStopSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { stopId } = request.params as { stopId: string };
    const body = updateItineraryStopSchema.parse(request.body);
    const existing = await prisma.itineraryStop.findUniqueOrThrow({ where: { id: stopId }, include: { day: true, participants: true } });
    if (existing.day.locked) throw httpError(409, 'Itinerary day is locked');
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(existing.day.tripId, actorUserId);
    if (body.placeId) await assertPlaceBelongsToTrip(existing.day.tripId, body.placeId);
    if (body.tripMemberIds) await requireTripMembersByIds(existing.day.tripId, body.tripMemberIds);
    await assertParticipantsAvailableForStop(
      existing.day.tripId,
      body.tripMemberIds ?? existing.participants.map((participant) => participant.tripMemberId),
      body.startsAt === undefined ? existing.startsAt?.toISOString() : body.startsAt,
      body.endsAt === undefined ? existing.endsAt?.toISOString() : body.endsAt,
    );

    return prisma.$transaction(async (tx) => {
      if (body.tripMemberIds) {
        await tx.itineraryStopParticipant.deleteMany({ where: { stopId } });
      }
      return tx.itineraryStop.update({
        where: { id: stopId },
        data: {
          placeId: body.placeId,
          order: body.order,
          startsAt: body.startsAt === undefined ? undefined : body.startsAt === null ? null : new Date(body.startsAt),
          endsAt: body.endsAt === undefined ? undefined : body.endsAt === null ? null : new Date(body.endsAt),
          note: body.note,
          participants: body.tripMemberIds
            ? { create: body.tripMemberIds.map((tripMemberId) => ({ tripMemberId })) }
            : undefined,
        },
        include: { place: true, participants: true },
      });
    });
  });

  routes.patch('/stops/:stopId/attendance', {
    schema: {
      tags: ['itinerary'],
      summary: 'Update own attendance for itinerary stop',
      security: [{ bearerAuth: [] }],
      params: stopIdParamSchema,
      body: updateStopAttendanceSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { stopId } = request.params as { stopId: string };
    const body = updateStopAttendanceSchema.parse(request.body);
    const stop = await prisma.itineraryStop.findUniqueOrThrow({
      where: { id: stopId },
      include: { day: true },
    });
    const actorUserId = getActorUserId(request, body);
    const member = await requireTripMember(stop.day.tripId, actorUserId);
    if (stop.day.locked) throw httpError(409, 'Itinerary day is locked');
    return prisma.itineraryStopParticipant.upsert({
      where: { stopId_tripMemberId: { stopId, tripMemberId: member.id } },
      create: { stopId, tripMemberId: member.id, status: body.status },
      update: { status: body.status },
      include: { member: { include: { user: true } } },
    });
  });

  routes.patch('/days/:dayId/stops/reorder', {
    schema: {
      tags: ['itinerary'],
      summary: 'Reorder itinerary stops for a day',
      security: [{ bearerAuth: [] }],
      params: dayIdParamSchema,
      body: reorderItineraryStopsSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { dayId } = request.params as { dayId: string };
    const body = reorderItineraryStopsSchema.parse(request.body);
    const day = await getDayForMutation(dayId);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(day.tripId, actorUserId);

    const stops = await prisma.itineraryStop.findMany({ where: { dayId, id: { in: body.stopIds } } });
    if (stops.length !== new Set(body.stopIds).size) throw httpError(400, 'All reordered stops must belong to the day');

    return prisma.$transaction(async (tx) => {
      for (const [index, stopId] of body.stopIds.entries()) {
        await tx.itineraryStop.update({ where: { id: stopId }, data: { order: index + 10000 } });
      }
      for (const [index, stopId] of body.stopIds.entries()) {
        await tx.itineraryStop.update({ where: { id: stopId }, data: { order: index } });
      }
      return tx.itineraryDay.findUniqueOrThrow({
        where: { id: dayId },
        include: {
          stops: {
            orderBy: { order: 'asc' },
            include: { place: true, participants: true },
          },
        },
      });
    });
  });

  routes.delete('/stops/:stopId', {
    schema: {
      tags: ['itinerary'],
      summary: 'Delete itinerary stop',
      security: [{ bearerAuth: [] }],
      params: stopIdParamSchema,
      body: deleteItinerarySchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { stopId } = request.params as { stopId: string };
    const body = deleteItinerarySchema.parse(request.body ?? {});
    const stop = await prisma.itineraryStop.findUniqueOrThrow({ where: { id: stopId }, include: { day: true } });
    if (stop.day.locked) throw httpError(409, 'Itinerary day is locked');
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(stop.day.tripId, actorUserId);
    await prisma.itineraryStop.delete({ where: { id: stopId } });
    return reply.code(204).send(null);
  });
}
