import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { jsonResponseSchema } from '../../utils/openapiSchemas.js';
import { reverseLocationSchema, searchLocationsSchema } from './location.schemas.js';
import { reverseLocation, searchLocations } from './location.service.js';

export async function locationRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/search', {
    schema: {
      tags: ['locations'],
      summary: 'Search locations via OpenStreetMap Nominatim',
      querystring: searchLocationsSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const query = searchLocationsSchema.parse(request.query);
    return { provider: 'nominatim', results: await searchLocations(query) };
  });

  routes.get('/reverse', {
    schema: {
      tags: ['locations'],
      summary: 'Reverse geocode coordinates via OpenStreetMap Nominatim',
      querystring: reverseLocationSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const query = reverseLocationSchema.parse(request.query);
    return reverseLocation(query);
  });
}
