import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: 'tomas@example.com' },
    create: { email: 'tomas@example.com', name: 'Tomas' },
    update: { name: 'Tomas' },
  });
  const anna = await prisma.user.upsert({
    where: { email: 'anna@example.com' },
    create: { email: 'anna@example.com', name: 'Anna' },
    update: { name: 'Anna' },
  });
  const petr = await prisma.user.upsert({
    where: { email: 'petr@example.com' },
    create: { email: 'petr@example.com', name: 'Petr' },
    update: { name: 'Petr' },
  });

  const existing = await prisma.trip.findUnique({ where: { inviteCode: 'demo-barcelona-2026' } });
  if (existing) await prisma.trip.delete({ where: { id: existing.id } });

  const trip = await prisma.trip.create({
    data: {
      name: 'Barcelona 2026',
      destination: 'Barcelona, Spain',
      startsAt: new Date('2026-06-12T09:00:00.000Z'),
      endsAt: new Date('2026-06-18T18:00:00.000Z'),
      currency: 'EUR',
      inviteCode: 'demo-barcelona-2026',
      members: {
        create: [
          { userId: owner.id, role: 'OWNER' },
          { userId: anna.id, role: 'MEMBER' },
          { userId: petr.id, role: 'MEMBER' },
        ],
      },
    },
    include: { members: true },
  });

  await prisma.tripMemberAvailability.createMany({
    data: trip.members.map((member, index) => ({
      tripMemberId: member.id,
      startsAt: new Date(index === 2 ? '2026-06-14T09:00:00.000Z' : '2026-06-12T09:00:00.000Z'),
      endsAt: new Date('2026-06-18T18:00:00.000Z'),
      note: index === 2 ? 'Joins after the weekend' : 'Full trip',
    })),
  });

  const places = await prisma.place.createManyAndReturn({
    data: [
      {
        tripId: trip.id,
        createdById: owner.id,
        type: 'PLACE',
        name: 'Sagrada Familia',
        latitude: 41.4036,
        longitude: 2.1744,
        durationMin: 120,
        estimatedCost: 26,
      },
      {
        tripId: trip.id,
        createdById: anna.id,
        type: 'ACTIVITY',
        name: 'Park Guell',
        latitude: 41.4145,
        longitude: 2.1527,
        durationMin: 90,
        estimatedCost: 10,
      },
      {
        tripId: trip.id,
        createdById: petr.id,
        type: 'FOOD',
        name: 'La Boqueria Market',
        latitude: 41.3817,
        longitude: 2.1713,
        durationMin: 60,
        estimatedCost: 18,
      },
      {
        tripId: trip.id,
        createdById: owner.id,
        type: 'ACCOMMODATION',
        name: 'Eixample Design Loft',
        latitude: 41.396,
        longitude: 2.178,
        estimatedCost: 505,
        sourceUrl: 'https://www.booking.com/',
      },
    ],
  });

  const day = await prisma.itineraryDay.create({
    data: {
      tripId: trip.id,
      date: new Date('2026-06-13T00:00:00.000Z'),
      title: 'Day 1',
      stops: {
        create: places.slice(0, 2).map((place, order) => ({
          placeId: place.id,
          order,
          startsAt: new Date(`2026-06-13T${order === 0 ? '09:30' : '13:00'}:00.000Z`),
        })),
      },
    },
    include: { stops: true },
  });

  await prisma.expense.create({
    data: {
      tripId: trip.id,
      paidById: owner.id,
      title: 'Sagrada Familia tickets',
      amount: 78,
      currency: 'EUR',
      splitType: 'EQUAL',
      itineraryStopId: day.stops[0]?.id,
      splits: {
        create: [owner.id, anna.id, petr.id].map((userId) => ({ userId, amount: 26 })),
      },
    },
  });

  console.log(`Seeded ${trip.name}`);
  console.log(`Owner actor id: ${owner.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
