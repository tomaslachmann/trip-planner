import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { actorQuerySchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { calculateTripSettlements } from './settlement.service.js';

export async function settlementRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['settlements'],
      summary: 'Calculate trip settlements',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return calculateTripSettlements(tripId);
  });
}
