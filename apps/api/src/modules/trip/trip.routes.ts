import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, memberIdParamSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { httpError } from '../../utils/http.js';
import { getActorUserId, requireTripMember, requireTripRole } from '../access/access.js';
import { requireJwt } from '../auth/jwt.js';
import { createTripSchema, deleteTripSchema, joinTripSchema, tripMemberResponseSchema, tripSummaryListResponseSchema, tripSummaryResponseSchema, updateTripMemberRoleSchema, updateTripSchema } from './trip.schemas.js';

export async function tripRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('', {
    schema: {
      tags: ['trips'],
      summary: 'List trips',
      security: [{ actorUserId: [] }],
      response: { 200: tripSummaryListResponseSchema },
    },
  }, async (request) => {
    const actorUserId = getActorUserId(request);
    return prisma.trip.findMany({
      where: { members: { some: { userId: actorUserId } } },
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  routes.get('/available', {
    schema: {
      tags: ['trips'],
      summary: 'List trips available to join',
      security: [{ actorUserId: [] }],
      response: { 200: tripSummaryListResponseSchema },
    },
  }, async (request) => {
    const actorUserId = getActorUserId(request);
    return prisma.trip.findMany({
      where: { members: { none: { userId: actorUserId } } },
      include: { members: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  routes.get('/:id', {
    schema: {
      tags: ['trips'],
      summary: 'Get trip detail',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(id, actorUserId);
    return prisma.trip.findUniqueOrThrow({
      where: { id },
      include: {
        members: { include: { user: true, availabilityWindows: true } },
        places: true,
        expenses: { include: { splits: true } },
        itineraryDays: { include: { stops: { include: { place: true, participants: true } } } },
        routePlans: { include: { legs: true } },
      },
    });
  });

  routes.post('', {
    schema: {
      tags: ['trips'],
      summary: 'Create trip',
      security: [{ actorUserId: [] }],
      body: createTripSchema,
      response: { 201: tripSummaryResponseSchema },
    },
  }, async (request, reply) => {
    const body = createTripSchema.parse(request.body);
    const session = requireJwt(request);
    const owner = await prisma.user.upsert({
      where: { id: session.sub },
      create: { id: session.sub, email: session.email, name: body.owner.name },
      update: { name: body.owner.name },
    });

    const trip = await prisma.trip.create({
      data: {
        name: body.name,
        destination: body.destination,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        currency: body.currency,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
      include: { members: { include: { user: true } } },
    });

    return reply.code(201).send(trip);
  });

  routes.patch('/:id', {
    schema: {
      tags: ['trips'],
      summary: 'Update trip',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: updateTripSchema,
      response: { 200: tripSummaryResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateTripSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(id, actorUserId, 'ADMIN');

    return prisma.trip.update({
      where: { id },
      data: {
        name: body.name,
        destination: body.destination,
        startsAt: body.startsAt === undefined ? undefined : body.startsAt === null ? null : new Date(body.startsAt),
        endsAt: body.endsAt === undefined ? undefined : body.endsAt === null ? null : new Date(body.endsAt),
        currency: body.currency,
      },
      include: { members: { include: { user: true } } },
    });
  });

  routes.delete('/:id', {
    schema: {
      tags: ['trips'],
      summary: 'Delete trip',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: deleteTripSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = deleteTripSchema.parse(request.body ?? {});
    const actorUserId = getActorUserId(request, body);
    await requireTripRole(id, actorUserId, 'OWNER');
    await prisma.trip.delete({ where: { id } });
    return reply.code(204).send(null);
  });

  routes.post('/join', {
    schema: {
      tags: ['trips'],
      summary: 'Join trip by invite code',
      security: [{ actorUserId: [] }],
      body: joinTripSchema,
      response: { 201: tripMemberResponseSchema },
    },
  }, async (request, reply) => {
    const body = joinTripSchema.parse(request.body);
    const session = requireJwt(request);
    const trip = await prisma.trip.findUniqueOrThrow({ where: { inviteCode: body.inviteCode } });
    const user = await prisma.user.upsert({
      where: { id: session.sub },
      create: { id: session.sub, email: session.email, name: body.user.name },
      update: { name: body.user.name },
    });
    const member = await prisma.tripMember.upsert({
      where: { tripId_userId: { tripId: trip.id, userId: user.id } },
      create: { tripId: trip.id, userId: user.id },
      update: {},
      include: { user: true, trip: true },
    });
    return reply.code(201).send(member);
  });

  routes.patch('/:tripId/members/:memberId/role', {
    schema: {
      tags: ['trips'],
      summary: 'Update trip member role',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema.merge(memberIdParamSchema),
      body: updateTripMemberRoleSchema,
      response: { 200: tripMemberResponseSchema },
    },
  }, async (request) => {
    const { tripId, memberId } = request.params as { tripId: string; memberId: string };
    const body = updateTripMemberRoleSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    const actorMember = await requireTripRole(tripId, actorUserId, 'ADMIN');
    const targetMember = await prisma.tripMember.findUniqueOrThrow({ where: { id: memberId, tripId } });
    if (body.role === 'OWNER') throw httpError(403, 'Owner transfer is not supported by this endpoint');
    if (targetMember.role === 'OWNER' && actorMember.role !== 'OWNER') throw httpError(403, 'Only owner can change owner role');
    if (targetMember.userId === actorUserId && actorMember.role === 'OWNER') throw httpError(400, 'Owner cannot change their own role here');

    return prisma.tripMember.update({
      where: { id: memberId, tripId },
      data: { role: body.role },
      include: { user: true, availabilityWindows: true },
    });
  });
}
