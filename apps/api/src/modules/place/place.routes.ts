import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { commentPlaceSchema, createPlaceSchema, deletePlaceSchema, updatePlaceSchema, votePlaceSchema } from './place.schemas.js';

export async function placeRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['places'],
      summary: 'List trip places',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.place.findMany({ where: { tripId }, include: { votes: true, comments: true } });
  });

  routes.post('', {
    schema: {
      tags: ['places'],
      summary: 'Create place',
      security: [{ actorUserId: [] }],
      body: createPlaceSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createPlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request, { actorUserId: body.createdById });
    if (actorUserId !== body.createdById) throw httpError(403, 'createdById must match actor user id');
    await requireTripMember(body.tripId, actorUserId);

    const place = await prisma.place.create({ data: body });
    return reply.code(201).send(place);
  });

  routes.patch('/:id', {
    schema: {
      tags: ['places'],
      summary: 'Update place',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: updatePlaceSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updatePlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    const place = await prisma.place.findUniqueOrThrow({ where: { id } });
    if (place.createdById !== actorUserId) await requireTripRole(place.tripId, actorUserId, 'ADMIN');

    const { actorUserId: _actorUserId, ...data } = body;
    return prisma.place.update({ where: { id }, data });
  });

  routes.delete('/:id', {
    schema: {
      tags: ['places'],
      summary: 'Delete place',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: deletePlaceSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = deletePlaceSchema.parse(request.body ?? {});
    const actorUserId = getActorUserId(request, body);
    const place = await prisma.place.findUniqueOrThrow({ where: { id } });
    if (place.createdById !== actorUserId) await requireTripRole(place.tripId, actorUserId, 'ADMIN');
    await prisma.place.delete({ where: { id } });
    return reply.code(204).send(null);
  });

  routes.post('/:id/votes', {
    schema: {
      tags: ['places'],
      summary: 'Vote for place',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: votePlaceSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = votePlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request, { actorUserId: body.actorUserId ?? body.userId });
    if (actorUserId !== body.userId) throw httpError(403, 'Vote userId must match actor user id');
    const place = await prisma.place.findUniqueOrThrow({ where: { id } });
    await requireTripMember(place.tripId, actorUserId);

    const vote = await prisma.placeVote.upsert({
      where: { placeId_userId: { placeId: id, userId: body.userId } },
      create: { placeId: id, userId: body.userId, value: body.value },
      update: { value: body.value },
    });
    return reply.code(201).send(vote);
  });

  routes.post('/:id/comments', {
    schema: {
      tags: ['places'],
      summary: 'Comment on place',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: commentPlaceSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = commentPlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request, { actorUserId: body.actorUserId ?? body.userId });
    if (actorUserId !== body.userId) throw httpError(403, 'Comment userId must match actor user id');
    const place = await prisma.place.findUniqueOrThrow({ where: { id } });
    await requireTripMember(place.tripId, actorUserId);

    const comment = await prisma.placeComment.create({ data: { placeId: id, userId: body.userId, body: body.body } });
    return reply.code(201).send(comment);
  });
}
