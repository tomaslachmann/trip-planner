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
  ROUTING_OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
  JWT_SECRET: z.string().min(16).default(process.env.SESSION_SECRET ?? 'dev-trip-planner-jwt-secret'),
});

export const env = envSchema.parse(process.env);
