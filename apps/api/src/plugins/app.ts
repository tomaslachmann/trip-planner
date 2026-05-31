import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { tripRoutes } from '../modules/trip/trip.routes.js';
import { placeRoutes } from '../modules/place/place.routes.js';
import { expenseRoutes } from '../modules/expense/expense.routes.js';
import { settlementRoutes } from '../modules/settlement/settlement.routes.js';
import { paymentRoutes } from '../modules/payment/payment.routes.js';
import { memberRoutes } from '../modules/member/member.routes.js';
import { itineraryRoutes } from '../modules/itinerary/itinerary.routes.js';
import { routeRoutes } from '../modules/route/route.routes.js';
import { accommodationRoutes } from '../modules/accommodation/accommodation.routes.js';
import { authRoutes } from '../modules/auth/auth.routes.js';
import { checklistRoutes } from '../modules/checklist/checklist.routes.js';
import { locationRoutes } from '../modules/location/location.routes.js';
import { pollRoutes } from '../modules/poll/poll.routes.js';
import { activityRoutes } from '../modules/activity/activity.routes.js';
import { registerOpenApi } from './openapi.js';

export async function registerApp(app: FastifyInstance) {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 86400,
  });
  await app.register(helmet);
  await registerOpenApi(app);

  app.get('/health', {
    schema: {
      tags: ['system'],
      summary: 'Health check',
      response: { 200: z.object({ ok: z.boolean() }) },
    },
  }, async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(tripRoutes, { prefix: '/trips' });
  await app.register(placeRoutes, { prefix: '/places' });
  await app.register(memberRoutes, { prefix: '/members' });
  await app.register(itineraryRoutes, { prefix: '/itinerary' });
  await app.register(routeRoutes, { prefix: '/routes' });
  await app.register(accommodationRoutes, { prefix: '/accommodations' });
  await app.register(pollRoutes, { prefix: '/polls' });
  await app.register(checklistRoutes, { prefix: '/checklist' });
  await app.register(locationRoutes, { prefix: '/locations' });
  await app.register(activityRoutes, { prefix: '/activity' });
  await app.register(expenseRoutes, { prefix: '/expenses' });
  await app.register(settlementRoutes, { prefix: '/settlements' });
  await app.register(paymentRoutes, { prefix: '/payments' });
}
