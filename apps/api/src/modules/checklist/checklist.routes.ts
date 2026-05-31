import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { prisma } from '../../db/prisma.js';
import { getActorUserId, requireTripMember, requireTripRole, requireTripUsers } from '../access/access.js';
import { httpError } from '../../utils/http.js';
import { actorQuerySchema, emptyResponseSchema, idParamSchema, jsonResponseSchema, tripIdParamSchema } from '../../utils/openapiSchemas.js';
import { completeChecklistItemSchema, createChecklistItemSchema, deleteChecklistItemSchema, updateChecklistItemSchema } from './checklist.schemas.js';

async function assignmentUsers(tripId: string, actorUserId: string, scope: 'PERSONAL' | 'SHARED' | 'EVERYONE', assignedUserIds?: string[]) {
  if (scope === 'EVERYONE') {
    const members = await prisma.tripMember.findMany({ where: { tripId }, select: { userId: true } });
    return members.map((member) => member.userId);
  }
  const userIds = assignedUserIds?.length ? assignedUserIds : scope === 'PERSONAL' ? [actorUserId] : [];
  await requireTripUsers(tripId, userIds);
  return [...new Set(userIds)];
}

export async function checklistRoutes(app: FastifyInstance) {
  const routes = app.withTypeProvider<ZodTypeProvider>();

  routes.get('/trip/:tripId', {
    schema: {
      tags: ['checklist'],
      summary: 'List trip checklist items',
      security: [{ actorUserId: [] }],
      params: tripIdParamSchema,
      querystring: actorQuerySchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { tripId } = request.params as { tripId: string };
    const actorUserId = getActorUserId(request);
    await requireTripMember(tripId, actorUserId);
    return prisma.checklistItem.findMany({
      where: { tripId },
      orderBy: { createdAt: 'asc' },
      include: { createdBy: true, assignments: { include: { user: true } }, completions: { include: { user: true } } },
    });
  });

  routes.post('', {
    schema: {
      tags: ['checklist'],
      summary: 'Create checklist item',
      security: [{ actorUserId: [] }],
      body: createChecklistItemSchema,
      response: { 201: jsonResponseSchema },
    },
  }, async (request, reply) => {
    const body = createChecklistItemSchema.parse(request.body);
    const actorUserId = getActorUserId(request, body);
    await requireTripMember(body.tripId, actorUserId);
    const userIds = await assignmentUsers(body.tripId, actorUserId, body.scope, body.assignedUserIds);

    const item = await prisma.checklistItem.create({
      data: {
        tripId: body.tripId,
        createdById: actorUserId,
        title: body.title,
        note: body.note,
        scope: body.scope,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        assignments: { create: userIds.map((userId) => ({ userId })) },
      },
      include: { createdBy: true, assignments: { include: { user: true } }, completions: { include: { user: true } } },
    });
    return reply.code(201).send(item);
  });

  routes.patch('/:id', {
    schema: {
      tags: ['checklist'],
      summary: 'Update checklist item',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: updateChecklistItemSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = updateChecklistItemSchema.parse(request.body);
    const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id } });
    const actorUserId = getActorUserId(request, body);
    if (item.createdById !== actorUserId) await requireTripRole(item.tripId, actorUserId, 'ADMIN');
    const scope = body.scope ?? item.scope;
    const userIds = body.assignedUserIds || body.scope
      ? await assignmentUsers(item.tripId, actorUserId, scope, body.assignedUserIds)
      : undefined;

    return prisma.$transaction(async (tx) => {
      if (userIds) await tx.checklistAssignment.deleteMany({ where: { itemId: id } });
      return tx.checklistItem.update({
        where: { id },
        data: {
          title: body.title,
          note: body.note,
          scope: body.scope,
          dueAt: body.dueAt === undefined ? undefined : body.dueAt === null ? null : new Date(body.dueAt),
          assignments: userIds ? { create: userIds.map((userId) => ({ userId })) } : undefined,
        },
        include: { createdBy: true, assignments: { include: { user: true } }, completions: { include: { user: true } } },
      });
    });
  });

  routes.patch('/:id/complete', {
    schema: {
      tags: ['checklist'],
      summary: 'Complete or uncomplete a checklist item',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: completeChecklistItemSchema,
      response: { 200: jsonResponseSchema },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = completeChecklistItemSchema.parse(request.body);
    const actorUserId = getActorUserId(request, { actorUserId: body.actorUserId ?? body.userId });
    if (body.userId && body.userId !== actorUserId) throw httpError(403, 'Completion userId must match actor user id');
    const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id }, include: { assignments: true } });
    await requireTripMember(item.tripId, actorUserId);
    if (item.assignments.length && !item.assignments.some((assignment) => assignment.userId === actorUserId)) {
      throw httpError(403, 'Checklist item is not assigned to this user');
    }
    if (body.completed) {
      await prisma.checklistCompletion.upsert({
        where: { itemId_userId: { itemId: id, userId: actorUserId } },
        create: { itemId: id, userId: actorUserId },
        update: { completedAt: new Date() },
      });
    } else {
      await prisma.checklistCompletion.deleteMany({ where: { itemId: id, userId: actorUserId } });
    }
    return prisma.checklistItem.findUniqueOrThrow({
      where: { id },
      include: { createdBy: true, assignments: { include: { user: true } }, completions: { include: { user: true } } },
    });
  });

  routes.delete('/:id', {
    schema: {
      tags: ['checklist'],
      summary: 'Delete checklist item',
      security: [{ actorUserId: [] }],
      params: idParamSchema,
      body: deleteChecklistItemSchema,
      response: { 204: emptyResponseSchema },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = deleteChecklistItemSchema.parse(request.body ?? {});
    const item = await prisma.checklistItem.findUniqueOrThrow({ where: { id } });
    const actorUserId = getActorUserId(request, body);
    if (item.createdById !== actorUserId) await requireTripRole(item.tripId, actorUserId, 'ADMIN');
    await prisma.checklistItem.delete({ where: { id } });
    return reply.code(204).send(null);
  });
}
