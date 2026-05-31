import { z } from 'zod';
import { tripIdParamSchema } from '../../utils/openapiSchemas.js';

export const aiTripParamSchema = tripIdParamSchema;

export const tripPlanningInsightSchema = z.object({
  title: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  area: z.enum(['MAP', 'ITINERARY', 'STAY', 'COSTS', 'WEATHER', 'TRANSPORT', 'GROUP']),
  detail: z.string(),
  recommendedAction: z.string(),
  target: z.enum(['map', 'plan', 'stay', 'costs', 'settle', 'members', 'more', 'checklist', 'polls', 'itinerary']),
});

export const tripPlanningAgentResponseSchema = z.object({
  provider: z.literal('openai-agents'),
  generatedAt: z.string(),
  model: z.string(),
  summary: z.string(),
  insights: z.array(tripPlanningInsightSchema),
});
