import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  BOOKING_API_BASE_URL: z.string().url().default('https://demandapi-sandbox.booking.com/3.1'),
  BOOKING_AFFILIATE_ID: z.string().optional(),
  BOOKING_API_TOKEN: z.string().optional(),
  BOOKING_PROVIDER: z.enum(['demand', 'rapidapi']).default('rapidapi'),
  BOOKING_RAPIDAPI_BASE_URL: z.string().url().default('https://booking-com15.p.rapidapi.com'),
  BOOKING_RAPIDAPI_HOST: z.string().min(1).default('booking-com15.p.rapidapi.com'),
  RAPIDAPI_KEY: z.string().optional(),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  ROUTING_OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
  ROUTING_PROVIDER: z.enum(['osrm']).default('osrm'),
  TRANSIT_PROVIDER: z.enum(['none', 'otp']).default('none'),
  TRANSIT_OTP_BASE_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().url().optional()),
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  NOMINATIM_USER_AGENT: z.string().min(1).default('trip-planner-local/0.1'),
  WIKIMEDIA_USER_AGENT: z.string().min(1).default('trip-planner-local/0.1 (http://localhost:3001)'),
  WIKIMEDIA_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(200),
  OVERPASS_BASE_URL: z.string().url().default('https://overpass-api.de/api/interpreter'),
  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1/forecast'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  JWT_SECRET: z.string().min(16).default(process.env.SESSION_SECRET ?? 'dev-trip-planner-jwt-secret'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  PUBLIC_API_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
