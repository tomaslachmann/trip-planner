import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { createTripSchema, joinTripSchema } from './trip.schemas.js';

export async function tripRoutes(app: FastifyInstance) {
  app.get('/', async () => prisma.trip.findMany({ include: { members: { include: { user: true } } } }));

  app.get('/:id', async (request) => {
    const { id } = request.params as { id: string };
    return prisma.trip.findUniqueOrThrow({
      where: { id },
      include: { members: { include: { user: true } }, places: true, expenses: true },
    });
  });

  app.post('/', async (request, reply) => {
    const body = createTripSchema.parse(request.body);
    const owner = await prisma.user.upsert({
      where: { email: body.owner.email },
      create: body.owner,
      update: { name: body.owner.name },
    });

    const trip = await prisma.trip.create({
      data: {
        name: body.name,
        destination: body.destination,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        currency: body.currency,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
      include: { members: { include: { user: true } } },
    });

    return reply.code(201).send(trip);
  });

  app.post('/join', async (request, reply) => {
    const body = joinTripSchema.parse(request.body);
    const trip = await prisma.trip.findUniqueOrThrow({ where: { inviteCode: body.inviteCode } });
    const user = await prisma.user.upsert({
      where: { email: body.user.email },
      create: body.user,
      update: { name: body.user.name },
    });
    const member = await prisma.tripMember.upsert({
      where: { tripId_userId: { tripId: trip.id, userId: user.id } },
      create: { tripId: trip.id, userId: user.id },
      update: {},
      include: { user: true, trip: true },
    });
    return reply.code(201).send(member);
  });
}
