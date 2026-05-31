import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { jsonResponseSchema } from '../../utils/openapiSchemas.js';
import { createPaymentAccountSchema } from './payment.schemas.js';

export async function paymentRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.post('/accounts', {
    schema: {
      tags: ['payments'],
      summary: 'Create payment account',
      security: [{ actorUserId: [] }],
      body: createPaymentAccountSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createPaymentAccountSchema.parse(request.body);
    const actorUserId = getActorUserId(request, { actorUserId: body.actorUserId ?? body.userId });
    if (actorUserId !== body.userId) throw httpError(403, 'Payment account userId must match actor user id');
    const { actorUserId: _actorUserId, ...data } = body;
    const account = await prisma.paymentAccount.create({ data });
    return reply.code(201).send(account);
  });
}
