import { Agent, run } from '@openai/agents';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { withTimeout } from '../../utils/fetch.js';
import { httpError } from '../../utils/http.js';
import { discoverLocations, getWikipediaSummary, searchLocations, type DiscoveryResult } from '../location/location.service.js';
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
      payload: z.string().nullable(),
    })).max(3),
  })).max(8),
});

type InsightOutput = z.infer<typeof insightOutputSchema>;

const candidateTypeSchema = z.enum(['PLACE', 'FOOD', 'ACTIVITY', 'DAY_TRIP', 'TRANSPORT', 'CUSTOM']);

const suggestionCandidateOutputSchema = z.object({
  name: z.string(),
  type: candidateTypeSchema,
  reason: z.string(),
  estimatedDurationMin: z.number().nullable(),
  estimatedCost: z.number().nullable(),
  weatherSuitability: z.enum(['INDOOR', 'OUTDOOR', 'MIXED']),
  confidence: z.number(),
  searchQuery: z.string(),
});

const suggestionsOutputSchema = z.object({
  summary: z.string(),
  candidates: z.array(suggestionCandidateOutputSchema).max(12),
});

const planDraftOutputSchema = z.object({
  summary: z.string(),
  days: z.array(z.object({
    date: z.string(),
    title: z.string(),
    theme: z.string(),
    items: z.array(z.object({
      kind: z.enum(['EXISTING_PLACE', 'NEW_CANDIDATE', 'NOTE']),
      title: z.string(),
      startsAt: z.string().nullable(),
      durationMin: z.number().nullable(),
      placeId: z.string().nullable(),
      candidateName: z.string().nullable(),
      reason: z.string(),
    })).max(8),
  })).max(14),
  candidates: z.array(suggestionCandidateOutputSchema).max(10),
});

type SuggestionCandidateOutput = z.infer<typeof suggestionCandidateOutputSchema>;
type PlanDraftOutput = z.infer<typeof planDraftOutputSchema>;
type VerifiedCandidate = Awaited<ReturnType<typeof verifyCandidate>>;
type AiMapFocus = { latitude: number; longitude: number; radiusMeters?: number; label?: string };
type AiDraftInput = { focus?: AiMapFocus };

function compactTripContext(
  trip: Awaited<ReturnType<typeof getTripContext>>,
  weather: Awaited<ReturnType<typeof getWeatherForPoints>> | null,
  nearbySeeds: Awaited<ReturnType<typeof loadNearbySeeds>> = [],
  focus?: AiMapFocus,
) {
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
    focus: focus ? {
      label: focus.label ?? 'Aktuální oblast mapy',
      latitude: focus.latitude,
      longitude: focus.longitude,
      radiusMeters: focus.radiusMeters ?? 5000,
    } : null,
    nearbySeeds,
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

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'navrh';
}

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nameSimilarity(left: string, right: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.82;
  const aTokens = new Set(a.split(' ').filter((token) => token.length > 2));
  const bTokens = b.split(' ').filter((token) => token.length > 2);
  if (!aTokens.size || !bTokens.length) return 0;
  const shared = bTokens.filter((token) => aTokens.has(token)).length;
  return shared / Math.max(aTokens.size, bTokens.length);
}

function buildTripCenter(trip: Awaited<ReturnType<typeof getTripContext>>, focus?: AiMapFocus) {
  if (focus) return { latitude: focus.latitude, longitude: focus.longitude };
  const points = trip.places.filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  if (!points.length) return null;
  return {
    latitude: points.reduce((sum, place) => sum + place.latitude, 0) / points.length,
    longitude: points.reduce((sum, place) => sum + place.longitude, 0) / points.length,
  };
}

async function loadNearbySeeds(trip: Awaited<ReturnType<typeof getTripContext>>, focus?: AiMapFocus) {
  const center = buildTripCenter(trip, focus);
  if (!center) return [];
  const categories: Array<'SIGHTS' | 'FOOD' | 'ACTIVITY' | 'OUTDOOR'> = ['SIGHTS', 'FOOD', 'ACTIVITY', 'OUTDOOR'];
  const baseRadius = focus?.radiusMeters ?? 3500;
  const groups = await Promise.all(categories.map((category) => discoverLocations({
    ...center,
    category,
    radiusMeters: category === 'OUTDOOR' ? Math.max(baseRadius, 10000) : baseRadius,
    limit: category === 'OUTDOOR' ? 10 : 8,
  }).catch(() => [] as DiscoveryResult[])));
  return groups.flat().map((item) => ({
    name: item.name,
    category: item.category,
    type: item.type ?? null,
    description: item.description ?? null,
    latitude: item.latitude,
    longitude: item.longitude,
    wikipediaTitle: item.wikipediaTitle ?? null,
    sourceUrl: item.sourceUrl ?? null,
  })).slice(0, 30);
}

function findSeedMatch(name: string, seeds: Awaited<ReturnType<typeof loadNearbySeeds>>) {
  const normalized = normalizeName(name);
  if (!normalized) return undefined;
  return seeds.find((seed) => {
    const seedName = normalizeName(seed.name);
    return seedName === normalized || seedName.includes(normalized) || normalized.includes(seedName);
  });
}

async function verifyCandidate(candidate: SuggestionCandidateOutput, trip: Awaited<ReturnType<typeof getTripContext>>, seeds: Awaited<ReturnType<typeof loadNearbySeeds>>, index: number, focus?: AiMapFocus) {
  const seed = findSeedMatch(candidate.name, seeds);
  const center = buildTripCenter(trip, focus);
  const query = candidate.searchQuery || `${candidate.name} ${trip.destination}`;
  const geocoded = await searchLocations({
    q: query,
    limit: 1,
    latitude: center?.latitude,
    longitude: center?.longitude,
  }).then((items) => items[0]).catch(() => undefined);
  const latitude = seed?.latitude ?? geocoded?.latitude;
  const longitude = seed?.longitude ?? geocoded?.longitude;
  const wiki = await getWikipediaSummary({
    name: seed?.wikipediaTitle ?? candidate.name,
    latitude,
    longitude,
    language: 'cs',
    radiusMeters: 1800,
  }).catch(() => null);
  const relevantWiki = wiki && nameSimilarity(candidate.name, wiki.title) >= 0.45 ? wiki : null;
  const provider = seed ? 'overpass' : geocoded ? 'nominatim' : relevantWiki ? 'wikipedia' : null;

  return {
    id: `ai-${index + 1}-${slug(candidate.name)}`,
    name: candidate.name,
    type: candidate.type,
    reason: candidate.reason,
    estimatedDurationMin: candidate.estimatedDurationMin,
    estimatedCost: candidate.estimatedCost,
    weatherSuitability: candidate.weatherSuitability,
    confidence: Math.max(0, Math.min(1, candidate.confidence)),
    searchQuery: query,
    verification: {
      status: provider && latitude !== undefined && longitude !== undefined ? 'VERIFIED' as const : provider ? 'PARTIAL' as const : 'UNVERIFIED' as const,
      provider,
      externalId: geocoded?.externalId ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      title: relevantWiki?.title ?? seed?.name ?? geocoded?.label ?? null,
      description: relevantWiki?.extract ?? seed?.description ?? geocoded?.label ?? null,
      imageUrl: relevantWiki?.imageUrl ?? null,
      sourceUrl: seed?.sourceUrl ?? null,
      wikipediaUrl: relevantWiki?.pageUrl ?? null,
    },
  };
}

async function verifyCandidates(candidates: SuggestionCandidateOutput[], trip: Awaited<ReturnType<typeof getTripContext>>, seeds: Awaited<ReturnType<typeof loadNearbySeeds>>, focus?: AiMapFocus) {
  const seen = new Set<string>();
  const unique = candidates.filter((candidate) => {
    const key = normalizeName(candidate.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return Promise.all(unique.map((candidate, index) => verifyCandidate(candidate, trip, seeds, index, focus)));
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
      'Každý insight musí obsahovat actions; pokud není co doporučit, vrať prázdné pole.',
      'Každá action musí obsahovat payload jako JSON string; pokud není potřeba, vrať null.',
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

export async function runTripSuggestionAgent(tripId: string, input: AiDraftInput = {}) {
  if (!env.OPENAI_API_KEY) throw httpError(503, 'OPENAI_API_KEY is not configured');

  const trip = await getTripContext(tripId);
  const focus = input.focus;
  const weatherPoints = buildWeatherPoints(trip);
  const weather = weatherPoints.length > 0 ? await getWeatherForPoints(weatherPoints).catch(() => null) : null;
  const nearbySeeds = await loadNearbySeeds(trip, focus);
  const agent = new Agent({
    name: 'Trip place suggestion agent',
    model: env.OPENAI_MODEL,
    outputType: suggestionsOutputSchema,
    instructions: [
      'Jsi plánovací copilota pro skupinové cestování.',
      'Odpovídej česky a jen strukturovaným výstupem podle schématu.',
      'Navrhuj konkrétní místa, oblasti, aktivity, restaurace a fallbacky do deště.',
      'Můžeš použít existing places a nearbySeeds z OpenStreetMap/Overpass, ale nepiš nic do databáze.',
      'Pokud je v kontextu focus, návrhy musí prioritně vycházet z téhle aktuální oblasti mapy a nearbySeeds; obecnou destinaci použij jen jako fallback.',
      'Každý kandidát musí mít searchQuery pro pozdější ověření přes geocoder nebo POI provider.',
      'Nevymýšlej souřadnice. Pokud místo znáš jen obecně, vrať pořád searchQuery a nižší confidence.',
      'Preferuj návrhy, které dávají smysl pro počasí, rozpočet, dostupnost lidí a existující itinerář.',
    ].join('\n'),
  });

  const result = await withTimeout(run(agent, JSON.stringify(compactTripContext(trip, weather, nearbySeeds, focus)), { maxTurns: 2 }), 'OpenAI trip suggestion agent', Math.max(env.REQUEST_TIMEOUT_MS, 60000))
    .catch((error) => {
      throw httpError(502, error instanceof Error ? error.message : 'OpenAI suggestion agent failed');
    });
  const output = result.finalOutput as z.infer<typeof suggestionsOutputSchema> | undefined;
  if (!output) throw httpError(502, 'OpenAI suggestion agent returned no output');
  const candidates = await verifyCandidates(output.candidates, trip, nearbySeeds, focus);

  return {
    provider: 'openai-agents' as const,
    generatedAt: new Date().toISOString(),
    model: env.OPENAI_MODEL,
    summary: output.summary,
    candidates,
  };
}

export async function runTripPlanDraftAgent(tripId: string, input: AiDraftInput = {}) {
  if (!env.OPENAI_API_KEY) throw httpError(503, 'OPENAI_API_KEY is not configured');

  const trip = await getTripContext(tripId);
  const focus = input.focus;
  const weatherPoints = buildWeatherPoints(trip);
  const weather = weatherPoints.length > 0 ? await getWeatherForPoints(weatherPoints).catch(() => null) : null;
  const nearbySeeds = await loadNearbySeeds(trip, focus);
  const agent = new Agent({
    name: 'Trip itinerary draft agent',
    model: env.OPENAI_MODEL,
    outputType: planDraftOutputSchema,
    instructions: [
      'Jsi plánovací copilota pro skupinové cestování.',
      'Odpovídej česky a jen strukturovaným výstupem podle schématu.',
      'Navrhni draft rozložení do dnů. Nesmíš zapisovat data do databáze.',
      'Používej existující místa přes placeId, nové návrhy jako kandidáty podle schématu.',
      'Pokud je v kontextu focus, nové kandidáty a denní návrh směřuj kolem aktuální oblasti mapy; obecnou destinaci použij jen jako fallback.',
      'U nových míst nevymýšlej souřadnice; dej searchQuery a backend je ověří.',
      'Respektuj počasí, intenzitu dne, dostupnost členů, délku zastávek a logickou trasu.',
      'Pokud chybí data, vrať NOTE položku místo falešné jistoty.',
    ].join('\n'),
  });

  const result = await withTimeout(run(agent, JSON.stringify(compactTripContext(trip, weather, nearbySeeds, focus)), { maxTurns: 2 }), 'OpenAI trip draft agent', Math.max(env.REQUEST_TIMEOUT_MS, 60000))
    .catch((error) => {
      throw httpError(502, error instanceof Error ? error.message : 'OpenAI draft agent failed');
    });
  const output = result.finalOutput as PlanDraftOutput | undefined;
  if (!output) throw httpError(502, 'OpenAI draft agent returned no output');
  const candidates = await verifyCandidates(output.candidates, trip, nearbySeeds, focus);
  const candidateByName = new Map(candidates.map((candidate) => [normalizeName(candidate.name), candidate.id]));

  return {
    provider: 'openai-agents' as const,
    generatedAt: new Date().toISOString(),
    model: env.OPENAI_MODEL,
    summary: output.summary,
    days: output.days.map((day, dayIndex) => ({
      ...day,
      title: `Den ${dayIndex + 1}`,
      items: day.items.map((item, itemIndex) => ({
        id: `draft-${dayIndex + 1}-${itemIndex + 1}`,
        kind: item.kind,
        title: item.title,
        startsAt: item.startsAt,
        durationMin: item.durationMin,
        placeId: item.placeId,
        candidateId: item.candidateName ? candidateByName.get(normalizeName(item.candidateName)) ?? null : null,
        reason: item.reason,
      })),
    })),
    candidates,
  };
}
