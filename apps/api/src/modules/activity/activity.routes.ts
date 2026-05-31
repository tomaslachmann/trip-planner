import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { actorQuerySchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';

export async function activityRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['activity'],
      summary: 'List trip activity events',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.activityEvent.findMany({
      where: { tripId },
      include: { actor: true },
      orderBy: { createdAt: 'desc' },
      take: 60,
    });
  });
}
