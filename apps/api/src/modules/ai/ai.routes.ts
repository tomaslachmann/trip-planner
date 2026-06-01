import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { aiDraftRequestSchema, aiPlanDraftResponseSchema, aiSuggestionsResponseSchema, aiTripParamSchema, tripPlanningAgentResponseSchema } from './ai.schemas.js';
import { runTripPlanDraftAgent, runTripPlanningAgent, runTripSuggestionAgent } from './ai.service.js';

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

  routes.post('/trip/:tripId/suggestions', {
    schema: {
      tags: ['ai'],
      summary: 'Generate AI place and activity suggestions as a verified draft',
      security: [{ bearerAuth: [] }],
      params: aiTripParamSchema,
      body: aiDraftRequestSchema,
      response: { 200: aiSuggestionsResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return runTripSuggestionAgent(tripId, request.body);
  });

  routes.post('/trip/:tripId/plan-draft', {
    schema: {
      tags: ['ai'],
      summary: 'Generate an AI itinerary draft without mutating trip data',
      security: [{ bearerAuth: [] }],
      params: aiTripParamSchema,
      body: aiDraftRequestSchema,
      response: { 200: aiPlanDraftResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return runTripPlanDraftAgent(tripId, request.body);
  });
}
