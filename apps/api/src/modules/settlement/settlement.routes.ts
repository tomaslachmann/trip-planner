import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { actorQuerySchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { getActorUserId, requireTripMember, requireTripUsers } from '../access/access.js';
import { recordActivity } from '../activity/activity.service.js';
import { updateSettlementStatusSchema } from './settlement.schemas.js';
import { calculateTripSettlements } from './settlement.service.js';

export async function settlementRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['settlements'],
      summary: 'Calculate trip settlements',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return calculateTripSettlements(tripId);
  });

  routes.patch('/trip/:tripId/status', {
    schema: {
      tags: ['settlements'],
      summary: 'Update settlement payment status',
      security: [{ bearerAuth: [] }],
      params: tripIdParamSchema,
      body: updateSettlementStatusSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const body = updateSettlementStatusSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(tripId, actorUserId);
    await requireTripUsers(tripId, [body.fromUserId, body.toUserId]);

    const now = new Date();
    const payment = await prisma.settlementPayment.upsert({
      where: {
        tripId_fromUserId_toUserId_currency: {
          tripId,
          fromUserId: body.fromUserId,
          toUserId: body.toUserId,
          currency: body.currency,
        },
      },
      create: {
        tripId,
        fromUserId: body.fromUserId,
        toUserId: body.toUserId,
        amount: body.amount,
        currency: body.currency,
        status: body.status,
        note: body.note,
        markedById: actorUserId,
        paidAt: body.status === 'PAID' || body.status === 'CONFIRMED' ? now : undefined,
        confirmedAt: body.status === 'CONFIRMED' ? now : undefined,
      },
      update: {
        amount: body.amount,
        status: body.status,
        note: body.note,
        markedById: actorUserId,
        paidAt: body.status === 'OPEN' ? null : body.status === 'PAID' || body.status === 'CONFIRMED' ? now : undefined,
        confirmedAt: body.status === 'CONFIRMED' ? now : body.status === 'OPEN' || body.status === 'PAID' ? null : undefined,
      },
    });
    await recordActivity({
      tripId,
      actorUserId,
      type: `SETTLEMENT_${body.status}`,
      entityType: 'settlement',
      entityId: payment.id,
      label: body.status === 'CONFIRMED' ? 'Platba vyrovnání potvrzena' : body.status === 'PAID' ? 'Platba vyrovnání označena jako zaplacená' : 'Stav vyrovnání upraven',
      metadata: { fromUserId: body.fromUserId, toUserId: body.toUserId, amount: body.amount, currency: body.currency, status: body.status },
    });
    return payment;
  });
}
