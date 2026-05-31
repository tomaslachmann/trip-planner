import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { createPollSchema, deletePollSchema, updatePollSchema, votePollOptionSchema } from './poll.schemas.js';

async function assertPollContextBelongsToTrip(tripId: string, contextDayId?: string, contextPlaceId?: string) {
  if (contextDayId) {
    const day = await prisma.itineraryDay.findUniqueOrThrow({ where: { id: contextDayId } });
    if (day.tripId !== tripId) throw httpError(400, 'Poll day context must belong to the trip');
  }
  if (contextPlaceId) {
    const place = await prisma.place.findUniqueOrThrow({ where: { id: contextPlaceId } });
    if (place.tripId !== tripId) throw httpError(400, 'Poll place context must belong to the trip');
  }
}

export async function pollRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['polls'],
      summary: 'List trip polls',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.poll.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: true, options: { orderBy: { order: 'asc' }, include: { votes: { include: { user: true } } } } },
    });
  });

  routes.post('', {
    schema: {
      tags: ['polls'],
      summary: 'Create poll',
      security: [{ actorUserId: [] }],
      body: createPollSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createPollSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    await assertPollContextBelongsToTrip(body.tripId, body.contextDayId, body.contextPlaceId);
    for (const option of body.options) {
      await assertPollContextBelongsToTrip(body.tripId, option.itineraryDayId, option.placeId);
    }

    const poll = await prisma.poll.create({
      data: {
        tripId: body.tripId,
        createdById: actorUserId,
        question: body.question,
        multiChoice: body.multiChoice,
        closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
        contextDayId: body.contextDayId,
        contextPlaceId: body.contextPlaceId,
        options: {
          create: body.options.map((option, index) => ({
            title: option.title,
            order: index,
            placeId: option.placeId,
            itineraryDayId: option.itineraryDayId,
          })),
        },
      },
      include: { createdBy: true, options: { orderBy: { order: 'asc' }, include: { votes: true } } },
    });
    return reply.code(201).send(poll);
  });

  routes.patch('/:id', {
    schema: {
      tags: ['polls'],
      summary: 'Update poll',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: updatePollSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updatePollSchema.parse(request.body);
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    const actorUserId = getActorUserId(request, body);
    if (poll.createdById !== actorUserId) await requireTripRole(poll.tripId, actorUserId, 'ADMIN');
    return prisma.poll.update({
      where: { id },
      data: {
        question: body.question,
        status: body.status,
        multiChoice: body.multiChoice,
        closesAt: body.closesAt === undefined ? undefined : body.closesAt === null ? null : new Date(body.closesAt),
      },
      include: { createdBy: true, options: { orderBy: { order: 'asc' }, include: { votes: true } } },
    });
  });

  routes.delete('/:id', {
    schema: {
      tags: ['polls'],
      summary: 'Delete poll',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: deletePollSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = deletePollSchema.parse(request.body ?? {});
    const poll = await prisma.poll.findUniqueOrThrow({ where: { id } });
    const actorUserId = getActorUserId(request, body);
    if (poll.createdById !== actorUserId) await requireTripRole(poll.tripId, actorUserId, 'ADMIN');
    await prisma.poll.delete({ where: { id } });
    return reply.code(204).send(null);
  });

  routes.post('/options/:id/vote', {
    schema: {
      tags: ['polls'],
      summary: 'Vote for poll option',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: votePollOptionSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = votePollOptionSchema.parse(request.body ?? {});
    const actorUserId = getActorUserId(request, { actorUserId: body.actorUserId ?? body.userId });
    if (body.userId && body.userId !== actorUserId) throw httpError(403, 'Vote userId must match actor user id');
    const option = await prisma.pollOption.findUniqueOrThrow({ where: { id }, include: { poll: { include: { options: true } } } });
    await requireTripMember(option.poll.tripId, actorUserId);
    if (option.poll.status !== 'OPEN') throw httpError(409, 'Poll is closed');
    if (!option.poll.multiChoice) {
      await prisma.pollVote.deleteMany({ where: { userId: actorUserId, optionId: { in: option.poll.options.map((pollOption) => pollOption.id) } } });
    }
    const vote = await prisma.pollVote.upsert({
      where: { optionId_userId: { optionId: id, userId: actorUserId } },
      create: { optionId: id, userId: actorUserId },
      update: {},
    });
    return reply.code(201).send(vote);
  });

  routes.delete('/options/:id/vote', {
    schema: {
      tags: ['polls'],
      summary: 'Remove own poll option vote',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: votePollOptionSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = votePollOptionSchema.parse(request.body ?? {});
    const actorUserId = getActorUserId(request, body);
    const option = await prisma.pollOption.findUniqueOrThrow({ where: { id }, include: { poll: true } });
    await requireTripMember(option.poll.tripId, actorUserId);
    await prisma.pollVote.deleteMany({ where: { optionId: id, userId: actorUserId } });
    return reply.code(204).send(null);
  });
}
