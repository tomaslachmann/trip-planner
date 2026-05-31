import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { createExpenseSchema } from './expense.schemas.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function expenseRoutes(app: FastifyInstance) {
  app.get('/trip/:tripId', async (request) => {
    const { tripId } = request.params as { tripId: string };
    return prisma.expense.findMany({ where: { tripId }, include: { splits: true, paidBy: true } });
  });

  app.post('/', async (request, reply) => {
    const body = createExpenseSchema.parse(request.body);
    const share = roundMoney(body.amount / body.splitUserIds.length);
    const expense = await prisma.expense.create({
      data: {
        tripId: body.tripId,
        paidById: body.paidById,
        title: body.title,
        amount: body.amount,
        currency: body.currency,
        splitType: 'EQUAL',
        splits: { create: body.splitUserIds.map((userId) => ({ userId, amount: share })) },
      },
      include: { splits: true },
    });
    return reply.code(201).send(expense);
  });
}
