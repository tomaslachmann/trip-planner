import { z } from 'zod';
import { tripIdParamSchema } from '../../utils/openapiSchemas.js';

export const aiTripParamSchema = tripIdParamSchema;

export const aiMapFocusSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().positive().max(50000).optional(),
  label: z.string().max(160).optional(),
});

export const aiDraftRequestSchema = z.object({
  focus: aiMapFocusSchema.optional(),
});

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

export const aiSuggestionCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['PLACE', 'FOOD', 'ACTIVITY', 'DAY_TRIP', 'TRANSPORT', 'CUSTOM']),
  reason: z.string(),
  estimatedDurationMin: z.number().nullable(),
  estimatedCost: z.number().nullable(),
  weatherSuitability: z.enum(['INDOOR', 'OUTDOOR', 'MIXED']),
  confidence: z.number(),
  searchQuery: z.string(),
  verification: z.object({
    status: z.enum(['VERIFIED', 'PARTIAL', 'UNVERIFIED']),
    provider: z.string().nullable(),
    externalId: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    imageUrl: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    wikipediaUrl: z.string().nullable(),
  }),
});

export const aiSuggestionsResponseSchema = z.object({
  provider: z.literal('openai-agents'),
  generatedAt: z.string(),
  model: z.string(),
  summary: z.string(),
  candidates: z.array(aiSuggestionCandidateSchema),
});

export const aiPlanDraftItemSchema = z.object({
  id: z.string(),
  kind: z.enum(['EXISTING_PLACE', 'NEW_CANDIDATE', 'NOTE']),
  title: z.string(),
  startsAt: z.string().nullable(),
  durationMin: z.number().nullable(),
  placeId: z.string().nullable(),
  candidateId: z.string().nullable(),
  reason: z.string(),
});

export const aiPlanDraftDaySchema = z.object({
  date: z.string(),
  title: z.string(),
  theme: z.string(),
  items: z.array(aiPlanDraftItemSchema),
});

export const aiPlanDraftResponseSchema = z.object({
  provider: z.literal('openai-agents'),
  generatedAt: z.string(),
  model: z.string(),
  summary: z.string(),
  days: z.array(aiPlanDraftDaySchema),
  candidates: z.array(aiSuggestionCandidateSchema),
});
