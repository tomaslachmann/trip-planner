import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { commentPlaceSchema, createPlaceSchema, deletePlaceSchema, updatePlaceSchema, votePlaceSchema } from './place.schemas.js';
import { recordActivity } from '../activity/activity.service.js';

export async function placeRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['places'],
      summary: 'List trip places',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.place.findMany({ where: { tripId }, include: { votes: true, comments: true, dayVotes: true } });
  });

  routes.post('', {
    schema: {
      tags: ['places'],
      summary: 'Create place',
      security: [{ bearerAuth: [] }],
      body: createPlaceSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createPlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request);
    await requireTripMember(body.tripId, actorUserId);

    const place = await prisma.place.create({ data: { ...body, createdById: actorUserId } });
    return reply.code(201).send(place);
  });

  routes.patch('/:id', {
    schema: {
      tags: ['places'],
      summary: 'Update place',
      security: [{ bearerAuth: [] }],
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
    if (body.accommodationStatus !== undefined && place.type !== 'ACCOMMODATION') throw httpError(400, 'Only accommodation places can have accommodation status');

    const updated = await prisma.place.update({ where: { id }, data: body });
    if (body.accommodationStatus !== undefined) {
      if (body.accommodationStatus === 'BOOKED') {
        const title = `Potvrdit check-in: ${updated.name}`;
        const existingChecklistItem = await prisma.checklistItem.findFirst({ where: { tripId: place.tripId, title } });
        if (!existingChecklistItem) {
          await prisma.checklistItem.create({
            data: {
              tripId: place.tripId,
              createdById: actorUserId,
              title,
              note: 'Automaticky vytvořeno po označení ubytování jako rezervované.',
              scope: 'SHARED',
            },
          });
        }
      }
      await recordActivity({
        tripId: place.tripId,
        actorUserId,
        type: `ACCOMMODATION_${body.accommodationStatus ?? 'SAVED'}`,
        entityType: 'place',
        entityId: id,
        label: `Ubytování ${updated.name}: ${body.accommodationStatus ?? 'uloženo'}`,
      });
    }
    return updated;
  });

  routes.delete('/:id', {
    schema: {
      tags: ['places'],
      summary: 'Delete place',
      security: [{ bearerAuth: [] }],
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
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: votePlaceSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = votePlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request);
    const place = await prisma.place.findUniqueOrThrow({ where: { id } });
    await requireTripMember(place.tripId, actorUserId);

    const vote = await prisma.placeVote.upsert({
      where: { placeId_userId: { placeId: id, userId: actorUserId } },
      create: { placeId: id, userId: actorUserId, value: body.value },
      update: { value: body.value },
    });
    return reply.code(201).send(vote);
  });

  routes.post('/:id/comments', {
    schema: {
      tags: ['places'],
      summary: 'Comment on place',
      security: [{ bearerAuth: [] }],
      params: idParamSchema,
      body: commentPlaceSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = commentPlaceSchema.parse(request.body);
    const actorUserId = getActorUserId(request);
    const place = await prisma.place.findUniqueOrThrow({ where: { id } });
    await requireTripMember(place.tripId, actorUserId);

    const comment = await prisma.placeComment.create({ data: { placeId: id, userId: actorUserId, body: body.body } });
    return reply.code(201).send(comment);
  });
}
