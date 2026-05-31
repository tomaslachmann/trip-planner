import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, availabilityIdParamSchema, emptyResponseSchema, jsonResponseSchema, tripIdParamSchema, tripMemberIdParamSchema } from '../../utils/openapiSchemas.js';
import { createAvailabilitySchema, deleteAvailabilitySchema, updateAvailabilitySchema, updateMemberPlanningSchema } from './member.schemas.js';

async function requireMemberOwnerOrTripAdmin(tripMemberId: string, actorUserId: string) {
  const member = await prisma.tripMember.findUniqueOrThrow({
    where: { id: tripMemberId },
    include: { user: true },
  });
  if (member.userId !== actorUserId) await requireTripRole(member.tripId, actorUserId, 'ADMIN');
  return member;
}

async function assertPlacesBelongToTrip(tripId: string, placeIds: Array<string | null | undefined>) {
  const ids = placeIds.filter((id): id is string => Boolean(id));
  if (!ids.length) return;
  const count = await prisma.place.count({ where: { tripId, id: { in: ids } } });
  if (count !== new Set(ids).size) throw httpError(400, 'Availability places must belong to the trip');
}

export async function memberRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['members'],
      summary: 'List trip members',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.tripMember.findMany({
      where: { tripId },
      include: { user: true, availabilityWindows: { include: { startPlace: true, endPlace: true } } },
    });
  });

  routes.post('/:tripMemberId/availability', {
    schema: {
      tags: ['members'],
      summary: 'Create member availability window',
      security: [{ bearerAuth: [] }],
      params: tripMemberIdParamSchema,
      body: createAvailabilitySchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { tripMemberId } = request.params as { tripMemberId: string };
    const body = createAvailabilitySchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    const member = await requireMemberOwnerOrTripAdmin(tripMemberId, actorUserId);
    await assertPlacesBelongToTrip(member.tripId, [body.startPlaceId, body.endPlaceId]);

    const window = await prisma.tripMemberAvailability.create({
      data: {
        tripMemberId,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
        startPlaceId: body.startPlaceId,
        endPlaceId: body.endPlaceId,
        note: body.note,
      },
      include: { startPlace: true, endPlace: true },
    });
    return reply.code(201).send(window);
  });

  routes.patch('/:tripMemberId/planning', {
    schema: {
      tags: ['members'],
      summary: 'Update member trip planning preferences',
      security: [{ bearerAuth: [] }],
      params: tripMemberIdParamSchema,
      body: updateMemberPlanningSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripMemberId } = request.params as { tripMemberId: string };
    const body = updateMemberPlanningSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireMemberOwnerOrTripAdmin(tripMemberId, actorUserId);
    return prisma.tripMember.update({
      where: { id: tripMemberId },
      data: {
        budgetPreference: body.budgetPreference,
        budgetAmount: body.budgetAmount,
      },
      include: { user: true, availabilityWindows: { include: { startPlace: true, endPlace: true } } },
    });
  });

  routes.patch('/availability/:availabilityId', {
    schema: {
      tags: ['members'],
      summary: 'Update member availability window',
      security: [{ bearerAuth: [] }],
      params: availabilityIdParamSchema,
      body: updateAvailabilitySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { availabilityId } = request.params as { availabilityId: string };
    const body = updateAvailabilitySchema.parse(request.body);
    const existing = await prisma.tripMemberAvailability.findUniqueOrThrow({
      where: { id: availabilityId },
      include: { member: true },
    });
    const actorUserId = getActorUserId(request, body);
    await requireMemberOwnerOrTripAdmin(existing.tripMemberId, actorUserId);
    await assertPlacesBelongToTrip(existing.member.tripId, [body.startPlaceId, body.endPlaceId]);

    const startsAt = body.startsAt ? new Date(body.startsAt) : existing.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : existing.endsAt;
    if (startsAt > endsAt) throw httpError(400, 'endsAt must be after startsAt');

    return prisma.tripMemberAvailability.update({
      where: { id: availabilityId },
      data: {
        startsAt: body.startsAt === undefined ? undefined : startsAt,
        endsAt: body.endsAt === undefined ? undefined : endsAt,
        startPlaceId: body.startPlaceId,
        endPlaceId: body.endPlaceId,
        note: body.note,
      },
      include: { startPlace: true, endPlace: true },
    });
  });

  routes.delete('/availability/:availabilityId', {
    schema: {
      tags: ['members'],
      summary: 'Delete member availability window',
      security: [{ bearerAuth: [] }],
      params: availabilityIdParamSchema,
      body: deleteAvailabilitySchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { availabilityId } = request.params as { availabilityId: string };
    const body = deleteAvailabilitySchema.parse(request.body ?? {});
    const existing = await prisma.tripMemberAvailability.findUniqueOrThrow({ where: { id: availabilityId } });
    const actorUserId = getActorUserId(request, body);
    await requireMemberOwnerOrTripAdmin(existing.tripMemberId, actorUserId);
    await prisma.tripMemberAvailability.delete({ where: { id: availabilityId } });
    return reply.code(204).send(null);
  });
}
