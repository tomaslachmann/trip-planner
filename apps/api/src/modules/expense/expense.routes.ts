import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole, requireTripUsers } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { createExpenseSchema, deleteExpenseSchema, updateExpenseSchema } from './expense.schemas.js';
import { recordActivity } from '../activity/activity.service.js';

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
        originalAmount: body.originalAmount,
        originalCurrency: body.originalCurrency,
        exchangeRate: body.exchangeRate,
        exchangeDate: body.exchangeDate ? new Date(body.exchangeDate) : undefined,
        splitType: body.splitType,
        itineraryStopId: body.itineraryStopId,
        splits: { create: splits },
      },
      include: { splits: true, paidBy: true },
    });
    await recordActivity({
      tripId: body.tripId,
      actorUserId,
      type: 'EXPENSE_CREATED',
      entityType: 'expense',
      entityId: expense.id,
      label: `Přidán výdaj ${expense.title}`,
      metadata: { amount: Number(expense.amount), currency: expense.currency },
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
    const expense = await prisma.expense.findUniqueOrThrow({ where: { id }, include: { splits: true } });
    const actorUserId = getActorUserId(request, body);
    if (expense.paidById !== actorUserId) await requireTripRole(expense.tripId, actorUserId, 'ADMIN');
    if (body.paidById && body.paidById !== actorUserId) await requireTripRole(expense.tripId, actorUserId, 'ADMIN');

    const nextPaidById = body.paidById ?? expense.paidById;
    await requireTripUsers(expense.tripId, [nextPaidById]);

    if (body.itineraryStopId) {
      const stop = await prisma.itineraryStop.findUniqueOrThrow({ where: { id: body.itineraryStopId }, include: { day: true } });
      if (stop.day.tripId !== expense.tripId) throw httpError(400, 'Itinerary stop must belong to the expense trip');
    }

    const shouldUpdateSplits = body.amount !== undefined || body.splitType !== undefined || body.splitAllTripMembers !== undefined || body.splitUserIds !== undefined || body.customSplits !== undefined;
    const nextAmount = body.amount ?? Number(expense.amount);
    const nextSplitType = body.splitType ?? expense.splitType;
    const splitUserIds = body.splitAllTripMembers
      ? (await prisma.tripMember.findMany({ where: { tripId: expense.tripId }, select: { userId: true } })).map((member) => member.userId)
      : body.splitUserIds ?? expense.splits.map((split) => split.userId);

    const nextSplits = nextSplitType === 'CUSTOM'
      ? body.customSplits ?? expense.splits.map((split) => ({ userId: split.userId, amount: Number(split.amount) }))
      : equalSplits(nextAmount, splitUserIds);

    if (shouldUpdateSplits) {
      await requireTripUsers(expense.tripId, nextSplits.map((split) => split.userId));
      const splitTotal = roundMoney(nextSplits.reduce((sum, split) => sum + split.amount, 0));
      if (splitTotal !== roundMoney(nextAmount)) throw httpError(400, 'Expense splits must add up to amount');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldUpdateSplits) await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
      return tx.expense.update({
        where: { id },
        data: {
          title: body.title,
          paidById: nextPaidById,
          amount: body.amount,
          currency: body.currency,
          originalAmount: body.originalAmount,
          originalCurrency: body.originalCurrency,
          exchangeRate: body.exchangeRate,
          exchangeDate: body.exchangeDate === undefined ? undefined : body.exchangeDate === null ? null : new Date(body.exchangeDate),
          splitType: body.splitType,
          itineraryStopId: body.itineraryStopId,
          splits: shouldUpdateSplits ? { create: nextSplits } : undefined,
        },
        include: { splits: true, paidBy: true },
      });
    });
    await recordActivity({
      tripId: expense.tripId,
      actorUserId,
      type: 'EXPENSE_UPDATED',
      entityType: 'expense',
      entityId: id,
      label: `Upraven výdaj ${body.title ?? expense.title}`,
    });
    return updated;
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
    await recordActivity({
      tripId: expense.tripId,
      actorUserId,
      type: 'EXPENSE_DELETED',
      entityType: 'expense',
      entityId: id,
      label: `Smazán výdaj ${expense.title}`,
    });
    return reply.code(204).send(null);
  });
}
