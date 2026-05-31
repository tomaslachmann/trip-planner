import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId } from '../access/access.js';
import { jsonResponseSchema } from '../../utils/openapiSchemas.js';
import { createPaymentAccountSchema } from './payment.schemas.js';

export async function paymentRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post('/accounts', {
    schema: {
      tags: ['payments'],
      summary: 'Create payment account',
      security: [{ bearerAuth: [] }],
      body: createPaymentAccountSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createPaymentAccountSchema.parse(request.body);
    const actorUserId = getActorUserId(request);
    const account = await prisma.paymentAccount.create({ data: { ...body, userId: actorUserId } });
    return reply.code(201).send(account);
  });
}
