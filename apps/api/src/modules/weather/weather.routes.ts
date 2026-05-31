import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember } from '../access/access.js';
import { weatherTripParamSchema, weatherTripResponseSchema } from './weather.schemas.js';
import { getWeatherForPoints } from './weather.service.js';

export async function weatherRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['weather'],
      summary: 'Get weather forecast for itinerary days and places',
      security: [{ bearerAuth: [] }],
      params: weatherTripParamSchema,
      response: { 200: weatherTripResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);

    const days = await prisma.itineraryDay.findMany({
      where: { tripId },
      orderBy: { date: 'asc' },
      include: {
        basePlace: true,
        stops: { include: { place: true } },
      },
    });

    const pointsByPlace = new Map<string, { id: string; label: string; latitude: number; longitude: number; dates: Set<string> }>();
    days.forEach((day) => {
      const date = day.date.toISOString().slice(0, 10);
      const places = [day.basePlace, ...day.stops.map((stop) => stop.place)]
        .filter((place): place is NonNullable<typeof place> => Boolean(place));
      const uniquePlaces = Array.from(new Map(places.map((place) => [place.id, place])).values());
      uniquePlaces.forEach((place) => {
        const current = pointsByPlace.get(place.id);
        if (current) current.dates.add(date);
        else pointsByPlace.set(place.id, {
          id: place.id,
          label: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          dates: new Set([date]),
        });
      });
    });

    return getWeatherForPoints(Array.from(pointsByPlace.values()).map((point) => ({
      ...point,
      dates: Array.from(point.dates).sort(),
    })));
  });
}
