import { prisma } from '../../db/prisma.js';

type ItinerarySyncClient = Pick<typeof prisma, 'itineraryDay'>;

function dayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function tripDateRange(startsAt?: Date | string | null, endsAt?: Date | string | null) {
  if (!startsAt || !endsAt) return [];
  const start = dayStart(new Date(startsAt));
  const end = dayStart(new Date(endsAt));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const days: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

export async function syncItineraryDaysForTrip(
  tripId: string,
  startsAt?: Date | string | null,
  endsAt?: Date | string | null,
  client: ItinerarySyncClient = prisma,
) {
  const days = tripDateRange(startsAt, endsAt);
  if (!days.length) return [];

  await client.itineraryDay.createMany({
    data: days.map((date, index) => ({ tripId, date, title: `Den ${index + 1}` })),
    skipDuplicates: true,
  });

  await client.itineraryDay.deleteMany({
    where: {
      tripId,
      locked: false,
      stops: { none: {} },
      OR: [{ date: { lt: days[0] } }, { date: { gt: days[days.length - 1] } }],
    },
  });

  return client.itineraryDay.findMany({
    where: { tripId },
    orderBy: { date: 'asc' },
    include: { stops: { orderBy: { order: 'asc' }, include: { place: true, participants: true } }, basePlace: true, placeVotes: true },
  });
}
