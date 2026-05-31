import { Agent, run } from '@openai/agents';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { withTimeout } from '../../utils/fetch.js';
import { httpError } from '../../utils/http.js';
import { getWeatherForPoints } from '../weather/weather.service.js';

const insightOutputSchema = z.object({
  summary: z.string(),
  insights: z.array(z.object({
    title: z.string(),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
    area: z.enum(['MAP', 'ITINERARY', 'STAY', 'COSTS', 'WEATHER', 'TRANSPORT', 'GROUP']),
    detail: z.string(),
    recommendedAction: z.string(),
    target: z.enum(['map', 'plan', 'stay', 'costs', 'settle', 'members', 'more', 'checklist', 'polls', 'itinerary']),
    actions: z.array(z.object({
      type: z.enum(['OPEN_SECTION', 'CREATE_POLL', 'CREATE_CHECKLIST_ITEM', 'REVIEW_ROUTE', 'REVIEW_WEATHER', 'REVIEW_BUDGET']),
      label: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    })).max(3).default([]),
  })).max(8),
});

type InsightOutput = z.infer<typeof insightOutputSchema>;

function compactTripContext(trip: Awaited<ReturnType<typeof getTripContext>>, weather: Awaited<ReturnType<typeof getWeatherForPoints>> | null) {
  return {
    trip: {
      name: trip.name,
      destination: trip.destination,
      startsAt: trip.startsAt,
      endsAt: trip.endsAt,
      currency: trip.currency,
    },
    members: trip.members.map((member) => ({
      id: member.id,
      name: member.user.name,
      role: member.role,
      budgetPreference: member.budgetPreference,
      budgetAmount: member.budgetAmount ? Number(member.budgetAmount) : null,
      availability: member.availabilityWindows.map((item) => ({
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        note: item.note,
      })),
    })),
    places: trip.places.map((place) => ({
      id: place.id,
      name: place.name,
      type: place.type,
      weatherSuitability: place.weatherSuitability,
      durationMin: place.durationMin,
      estimatedCost: place.estimatedCost ? Number(place.estimatedCost) : null,
      accommodationStatus: place.accommodationStatus,
      votes: place.votes.map((vote) => vote.value),
      comments: place.comments.map((comment) => comment.body).slice(-5),
    })),
    itinerary: trip.itineraryDays.map((day) => ({
      id: day.id,
      date: day.date,
      title: day.title,
      basePlace: day.basePlace?.name ?? null,
      intensity: day.intensity,
      rainPlan: day.rainPlan,
      locked: day.locked,
      stops: day.stops.map((stop) => ({
        place: stop.place.name,
        weatherSuitability: stop.place.weatherSuitability,
        startsAt: stop.startsAt,
        endsAt: stop.endsAt,
        attendance: stop.participants.map((participant) => ({
          member: participant.member.user.name,
          status: participant.status,
        })),
      })),
    })),
    expenses: trip.expenses.map((expense) => ({
      title: expense.title,
      amount: Number(expense.amount),
      currency: expense.currency,
      splitCount: expense.splits.length,
    })),
    settlements: trip.settlementPayments.map((settlement) => ({
      amount: Number(settlement.amount),
      currency: settlement.currency,
      status: settlement.status,
    })),
    routes: trip.routePlans.map((route) => ({
      name: route.name,
      mode: route.mode,
      startsAt: route.startsAt,
      endsAt: route.endsAt,
      locked: route.locked,
      distanceMeters: route.legs.reduce((sum, leg) => sum + (leg.distanceMeters ?? 0), 0),
      durationSeconds: route.legs.reduce((sum, leg) => sum + (leg.durationSeconds ?? 0), 0),
      providers: Array.from(new Set(route.legs.map((leg) => leg.provider).filter(Boolean))),
    })),
    weather: weather ? {
      provider: weather.provider,
      days: weather.days.map((day) => ({
        date: day.date,
        place: day.pointLabel,
        weatherCode: day.weatherCode,
        temperatureMax: day.temperatureMax,
        precipitationProbabilityMax: day.precipitationProbabilityMax,
        precipitationSum: day.precipitationSum,
      })),
    } : null,
    polls: trip.polls.map((poll) => ({
      question: poll.question,
      status: poll.status,
      options: poll.options.map((option) => ({ title: option.title, votes: option.votes.length })),
    })),
    checklist: trip.checklistItems.map((item) => ({
      title: item.title,
      scope: item.scope,
      done: item.completions.length,
      assigned: item.assignments.length,
    })),
  };
}

async function getTripContext(tripId: string) {
  return prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      members: { include: { user: true, availabilityWindows: true } },
      places: { include: { votes: true, comments: true } },
      itineraryDays: {
        include: {
          basePlace: true,
          stops: {
            orderBy: { order: 'asc' },
            include: { place: true, participants: { include: { member: { include: { user: true } } } } },
          },
        },
        orderBy: { date: 'asc' },
      },
      expenses: { include: { splits: true } },
      routePlans: { include: { legs: true } },
      settlementPayments: true,
      polls: { include: { options: { include: { votes: true } } } },
      checklistItems: { include: { assignments: true, completions: true } },
    },
  });
}

function buildWeatherPoints(trip: Awaited<ReturnType<typeof getTripContext>>) {
  const pointsByPlace = new Map<string, { id: string; label: string; latitude: number; longitude: number; dates: Set<string> }>();
  trip.itineraryDays.forEach((day) => {
    const date = day.date.toISOString().slice(0, 10);
    const places = [day.basePlace, ...day.stops.map((stop) => stop.place)]
      .filter((place): place is NonNullable<typeof place> => Boolean(place));
    Array.from(new Map(places.map((place) => [place.id, place])).values()).forEach((place) => {
      const current = pointsByPlace.get(place.id);
      if (current) current.dates.add(date);
      else pointsByPlace.set(place.id, {
        id: place.id,
        label: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        dates: new Set([date]),
      });
    });
  });

  return Array.from(pointsByPlace.values()).map((point) => ({
    ...point,
    dates: Array.from(point.dates).sort(),
  }));
}

export async function runTripPlanningAgent(tripId: string) {
  if (!env.OPENAI_API_KEY) throw httpError(503, 'OPENAI_API_KEY is not configured');

  const trip = await getTripContext(tripId);
  const weatherPoints = buildWeatherPoints(trip);
  const weather = weatherPoints.length > 0 ? await getWeatherForPoints(weatherPoints).catch(() => null) : null;
  const agent = new Agent({
    name: 'Trip planning agent',
    model: env.OPENAI_MODEL,
    outputType: insightOutputSchema,
    instructions: [
      'Jsi plánovací agent pro skupinové tripy.',
      'Odpovídej česky a jen strukturovaným výstupem podle schématu.',
      'Nepočítej magické skóre. Pracuj s konkrétními fakty: hlasy, attendance, budgety, počasí vhodnost, ubytování, náklady, checklist, ankety a konflikty v itineráři.',
      'Dávej jen akční doporučení, která uživatel může udělat v aplikaci.',
      'U každého insightu vrať actions s konkrétním typem a popiskem. Když má jít jen o navigaci, použij OPEN_SECTION.',
      'Když data nestačí, označ chybějící rozhodnutí nebo doporuč doplnění dat.',
    ].join('\n'),
  });

  const result = await withTimeout(run(agent, JSON.stringify(compactTripContext(trip, weather)), { maxTurns: 2 }), 'OpenAI trip planning agent', Math.max(env.REQUEST_TIMEOUT_MS, 30000))
    .catch((error) => {
      throw httpError(502, error instanceof Error ? error.message : 'OpenAI agent failed');
    });
  const output = result.finalOutput as InsightOutput | undefined;
  if (!output) throw httpError(502, 'OpenAI agent returned no output');

  return {
    provider: 'openai-agents' as const,
    generatedAt: new Date().toISOString(),
    model: env.OPENAI_MODEL,
    ...output,
  };
}
