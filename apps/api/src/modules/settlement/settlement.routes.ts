import type { FastifyInstance } from 'fastify';
import { calculateTripSettlements } from './settlement.service.js';

export async function settlementRoutes(app: FastifyInstance) {
  app.get('/trip/:tripId', async (request) => {
    const { tripId } = request.params as { tripId: string };
    return calculateTripSettlements(tripId);
  });
}
