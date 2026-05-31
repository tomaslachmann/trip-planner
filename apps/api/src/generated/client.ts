import createClient from 'openapi-fetch';
import type { paths } from './openapi-types.js';

export function createTripPlannerClient(baseUrl: string, accessToken?: string) {
  return createClient<paths>({
    baseUrl,
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
  });
}

export type TripPlannerClient = ReturnType<typeof createTripPlannerClient>;
