import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { createPaymentAccountSchema } from './payment.schemas.js';

export async function paymentRoutes(app: FastifyInstance) {
  app.post('/accounts', async (request, reply) => {
    const body = createPaymentAccountSchema.parse(request.body);
    const account = await prisma.paymentAccount.create({ data: body });
    return reply.code(201).send(account);
  });
}
