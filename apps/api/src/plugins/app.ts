import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { tripRoutes } from '../modules/trip/trip.routes.js';
import { placeRoutes } from '../modules/place/place.routes.js';
import { expenseRoutes } from '../modules/expense/expense.routes.js';
import { settlementRoutes } from '../modules/settlement/settlement.routes.js';
import { paymentRoutes } from '../modules/payment/payment.routes.js';

export async function registerApp(app: FastifyInstance) {
  await app.register(cors, { origin: true });
  await app.register(helmet);

  app.get('/health', async () => ({ ok: true }));

  await app.register(tripRoutes, { prefix: '/trips' });
  await app.register(placeRoutes, { prefix: '/places' });
  await app.register(expenseRoutes, { prefix: '/expenses' });
  await app.register(settlementRoutes, { prefix: '/settlements' });
  await app.register(paymentRoutes, { prefix: '/payments' });
}
