import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { commentPlaceSchema, createPlaceSchema, votePlaceSchema } from './place.schemas.js';

export async function placeRoutes(app: FastifyInstance) {
  app.get('/trip/:tripId', async (request) => {
    const { tripId } = request.params as { tripId: string };
    return prisma.place.findMany({ where: { tripId }, include: { votes: true, comments: true } });
  });

  app.post('/', async (request, reply) => {
    const body = createPlaceSchema.parse(request.body);
    const place = await prisma.place.create({ data: body });
    return reply.code(201).send(place);
  });

  app.post('/:id/votes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = votePlaceSchema.parse(request.body);
    const vote = await prisma.placeVote.upsert({
      where: { placeId_userId: { placeId: id, userId: body.userId } },
      create: { placeId: id, userId: body.userId, value: body.value },
      update: { value: body.value },
    });
    return reply.code(201).send(vote);
  });

  app.post('/:id/comments', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = commentPlaceSchema.parse(request.body);
    const comment = await prisma.placeComment.create({ data: { placeId: id, ...body } });
    return reply.code(201).send(comment);
  });
}
