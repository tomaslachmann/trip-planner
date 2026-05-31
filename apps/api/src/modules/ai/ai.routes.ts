import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { aiTripParamSchema, tripPlanningAgentResponseSchema } from './ai.schemas.js';
import { runTripPlanningAgent } from './ai.service.js';

export async function aiRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post('/trip/:tripId/insights', {
    schema: {
      tags: ['ai'],
      summary: 'Generate trip planning insights with OpenAI Agents SDK',
      security: [{ bearerAuth: [] }],
      params: aiTripParamSchema,
      response: { 200: tripPlanningAgentResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return runTripPlanningAgent(tripId);
  });
}
