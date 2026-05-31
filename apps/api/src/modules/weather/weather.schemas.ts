import { z } from 'zod';
import { tripIdParamSchema } from '../../utils/openapiSchemas.js';

export const weatherTripParamSchema = tripIdParamSchema;

export const weatherPointSchema = z.object({
  id: z.string(),
  label: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const weatherDayForecastSchema = z.object({
  date: z.string(),
  pointId: z.string(),
  pointLabel: z.string(),
  weatherCode: z.number().nullable(),
  temperatureMax: z.number().nullable(),
  temperatureMin: z.number().nullable(),
  precipitationProbabilityMax: z.number().nullable(),
  precipitationSum: z.number().nullable(),
  windSpeedMax: z.number().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
});

export const weatherTripResponseSchema = z.object({
  provider: z.literal('open-meteo'),
  generatedAt: z.string(),
  points: z.array(weatherPointSchema),
  days: z.array(weatherDayForecastSchema),
});
