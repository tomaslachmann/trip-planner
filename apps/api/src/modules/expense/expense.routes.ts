import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole, requireTripUsers } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { createExpenseSchema, deleteExpenseSchema, updateExpenseSchema } from './expense.schemas.js';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function equalSplits(amount: number, userIds: string[]) {
  const share = Math.floor((amount * 100) / userIds.length) / 100;
  let assigned = 0;
  return userIds.map((userId, index) => {
    const splitAmount = index === userIds.length - 1 ? roundMoney(amount - assigned) : share;
    assigned = roundMoney(assigned + splitAmount);
    return { userId, amount: splitAmount };
  });
}

export async function expenseRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['expenses'],
      summary: 'List trip expenses',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.expense.findMany({ where: { tripId }, include: { splits: true, paidBy: true } });
  });

  routes.post('', {
    schema: {
      tags: ['expenses'],
      summary: 'Create expense',
      security: [{ actorUserId: [] }],
      body: createExpenseSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createExpenseSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    await requireTripUsers(body.tripId, [body.paidById]);
    if (body.paidById !== actorUserId) await requireTripRole(body.tripId, actorUserId, 'ADMIN');

    const splitUserIds = body.splitAllTripMembers
      ? (await prisma.tripMember.findMany({ where: { tripId: body.tripId }, select: { userId: true } })).map((member) => member.userId)
      : body.splitUserIds ?? [];

    const splits = body.splitType === 'CUSTOM'
      ? body.customSplits ?? []
      : equalSplits(body.amount, splitUserIds);

    await requireTripUsers(body.tripId, splits.map((split) => split.userId));

    const splitTotal = roundMoney(splits.reduce((sum, split) => sum + split.amount, 0));
    if (splitTotal !== roundMoney(body.amount)) {
      throw httpError(400, 'Expense splits must add up to amount');
    }

    if (body.itineraryStopId) {
      const stop = await prisma.itineraryStop.findUniqueOrThrow({ where: { id: body.itineraryStopId }, include: { day: true } });
      if (stop.day.tripId !== body.tripId) throw httpError(400, 'Itinerary stop must belong to the expense trip');
    }

    const expense = await prisma.expense.create({
      data: {
        tripId: body.tripId,
        paidById: body.paidById,
        title: body.title,
        amount: body.amount,
        currency: body.currency,
        splitType: body.splitType,
        itineraryStopId: body.itineraryStopId,
        splits: { create: splits },
      },
      include: { splits: true },
    });
    return reply.code(201).send(expense);
  });

  routes.patch('/:id', {
    schema: {
      tags: ['expenses'],
      summary: 'Update expense',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: updateExpenseSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateExpenseSchema.parse(request.body);
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
    const actorUserId = getActorUserId(request, body);
    if (expense.paidById !== actorUserId) await requireTripRole(expense.tripId, actorUserId, 'ADMIN');

    return prisma.expense.update({
      where: { id },
      data: { title: body.title },
      include: { splits: true, paidBy: true },
    });
  });

  routes.delete('/:id', {
    schema: {
      tags: ['expenses'],
      summary: 'Delete expense',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: deleteExpenseSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = deleteExpenseSchema.parse(request.body ?? {});
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
    const actorUserId = getActorUserId(request, body);
    if (expense.paidById !== actorUserId) await requireTripRole(expense.tripId, actorUserId, 'ADMIN');
    await prisma.expense.delete({ where: { id } });
    return reply.code(204).send(null);
  });
}
