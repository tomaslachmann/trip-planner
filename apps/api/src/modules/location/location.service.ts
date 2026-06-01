import { env } from '../../config/env.js';
import { fetchWithTimeout } from '../../utils/fetch.js';
import { httpError } from '../../utils/http.js';

type NominatimPlace = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
};

type LocationResult = {
  provider: 'nominatim';
  externalId: string;
  label: string;
  latitude: number;
  longitude: number;
  type?: string;
  countryCode?: string;
  raw: unknown;
};

type DiscoveryCategory = 'SIGHTS' | 'FOOD' | 'ACTIVITY' | 'TRANSPORT' | 'OUTDOOR';

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type WikipediaGeoSearchItem = {
  title?: string;
  dist?: number;
};

type WikipediaSearchItem = {
  title?: string;
};

type WikipediaSummaryPayload = {
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
  content_urls?: {
    desktop?: { page?: string };
    mobile?: { page?: string };
  };
};

export type DiscoveryResult = {
  provider: 'overpass';
  externalId: string;
  category: DiscoveryCategory;
  name: string;
  latitude: number;
  longitude: number;
  type?: string;
  description?: string;
  websiteUrl?: string;
  wikipediaTitle?: string;
  wikipediaUrl?: string;
  imageUrl?: string;
  sourceUrl?: string;
  raw: unknown;
};

export type WikipediaSummaryResult = {
  provider: 'wikipedia';
  language: string;
  title: string;
  description?: string;
  extract?: string;
  imageUrl?: string;
  pageUrl?: string;
};

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const overpassTimeoutMs = 45000;
const wikipediaTimeoutMs = 20000;
let wikimediaWindowStartedAt = 0;
let wikimediaRequestCount = 0;
let wikimediaQueue: Promise<void> = Promise.resolve();

function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) return undefined;
  return entry.value as T;
}

function writeCache(key: string, value: unknown) {
  cache.set(key, { value, expiresAt: Date.now() + 10 * 60 * 1000 });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForWikimediaSlot() {
  const limit = env.WIKIMEDIA_RATE_LIMIT_PER_MINUTE;
  const windowMs = 60_000;
  const now = Date.now();
  if (!wikimediaWindowStartedAt || now - wikimediaWindowStartedAt >= windowMs) {
    wikimediaWindowStartedAt = now;
    wikimediaRequestCount = 0;
  }
  if (wikimediaRequestCount >= limit) {
    await delay(Math.max(0, windowMs - (now - wikimediaWindowStartedAt)));
    wikimediaWindowStartedAt = Date.now();
    wikimediaRequestCount = 0;
  }
  wikimediaRequestCount += 1;
}

async function withWikimediaRateLimit<T>(operation: () => Promise<T>) {
  const slot = wikimediaQueue.then(waitForWikimediaSlot, waitForWikimediaSlot);
  wikimediaQueue = slot.then(() => undefined, () => undefined);
  await slot;
  return operation();
}

function normalize(place: NominatimPlace): LocationResult | undefined {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !place.display_name) return undefined;
  return {
    provider: 'nominatim',
    externalId: `${place.osm_type ?? 'place'}:${place.osm_id ?? place.place_id ?? place.display_name}`,
    label: place.display_name,
    latitude,
    longitude,
    type: place.type ?? place.class,
    countryCode: place.address?.country_code?.toUpperCase(),
    raw: place,
  };
}

async function nominatimGet(path: string, query: Record<string, string | number | undefined>) {
  const url = new URL(`${env.NOMINATIM_BASE_URL.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const cacheKey = url.toString();
  const cached = readCache<unknown>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': env.NOMINATIM_USER_AGENT,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `Location search failed: ${text.slice(0, 500)}`);
  }
  const payload = await response.json() as unknown;
  writeCache(cacheKey, payload);
  return payload;
}

export async function searchLocations(input: { q: string; limit: number; latitude?: number; longitude?: number }) {
  const payload = await nominatimGet('/search', {
    q: input.q,
    format: 'jsonv2',
    addressdetails: 1,
    limit: input.limit,
    extratags: 0,
    namedetails: 0,
    ...(input.latitude !== undefined && input.longitude !== undefined
      ? { viewbox: `${input.longitude - 1},${input.latitude + 1},${input.longitude + 1},${input.latitude - 1}` }
      : {}),
  });
  return (Array.isArray(payload) ? payload : [])
    .map((item) => normalize(item as NominatimPlace))
    .filter((item): item is LocationResult => Boolean(item));
}

export async function reverseLocation(input: { latitude: number; longitude: number }) {
  const payload = await nominatimGet('/reverse', {
    lat: input.latitude,
    lon: input.longitude,
    format: 'jsonv2',
    addressdetails: 1,
  });
  const result = normalize(payload as NominatimPlace);
  if (!result) throw httpError(404, 'Location not found');
  return result;
}

function overpassFilter(category: DiscoveryCategory) {
  if (category === 'FOOD') {
    return '["amenity"~"^(restaurant|cafe|bar|pub|fast_food|biergarten|food_court)$"]';
  }
  if (category === 'ACTIVITY') {
    return '["leisure"~"^(park|sports_centre|swimming_pool|playground|stadium)$"]';
  }
  if (category === 'OUTDOOR') {
    return '["natural"~"^(peak|saddle|cliff|ridge|valley|cave_entrance|waterfall)$"]';
  }
  if (category === 'TRANSPORT') {
    return '["amenity"~"^(bus_station|ferry_terminal|taxi)$"]';
  }
  return '["tourism"~"^(attraction|museum|gallery|viewpoint|artwork|zoo|theme_park)$"]';
}

function overpassType(tags: Record<string, string> = {}) {
  return tags.tourism ?? tags.amenity ?? tags.leisure ?? tags.natural ?? tags.public_transport ?? tags.railway;
}

function wikipediaTitle(tags: Record<string, string> = {}) {
  const tagged = tags.wikipedia ?? tags['wikipedia:cs'] ?? tags['wikipedia:en'];
  if (!tagged) return undefined;
  return tagged.includes(':') ? tagged.split(':').slice(1).join(':') : tagged;
}

function wikipediaUrl(title?: string, language = 'cs') {
  if (!title) return undefined;
  return `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}

function normalizeDiscovery(element: OverpassElement, category: DiscoveryCategory): DiscoveryResult | undefined {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const name = element.tags?.name ?? element.tags?.['name:en'] ?? element.tags?.brand;
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  const wikiTitle = wikipediaTitle(element.tags);
  return {
    provider: 'overpass',
    externalId: `${element.type}:${element.id}`,
    category,
    name,
    latitude: latitude as number,
    longitude: longitude as number,
    type: overpassType(element.tags),
    description: element.tags?.description ?? element.tags?.['description:cs'] ?? element.tags?.['description:en'],
    websiteUrl: element.tags?.website ?? element.tags?.['contact:website'],
    wikipediaTitle: wikiTitle,
    wikipediaUrl: wikipediaUrl(wikiTitle),
    imageUrl: element.tags?.image,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    raw: element,
  };
}

async function overpassQuery(query: string) {
  const cacheKey = `overpass:${query}`;
  const cached = readCache<unknown>(cacheKey);
  if (cached) return cached;

  const response = await fetchWithTimeout(env.OVERPASS_BASE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'User-Agent': env.NOMINATIM_USER_AGENT,
    },
    body: new URLSearchParams({ data: query }).toString(),
  }, overpassTimeoutMs);
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `Map discovery failed: ${text.slice(0, 500)}`);
  }
  const payload = await response.json() as unknown;
  writeCache(cacheKey, payload);
  return payload;
}

export async function discoverLocations(input: { latitude: number; longitude: number; radiusMeters: number; category: DiscoveryCategory; limit: number }) {
  const filter = overpassFilter(input.category);
  const radiusMeters = input.category === 'ACTIVITY' ? Math.min(input.radiusMeters, 1800) : input.radiusMeters;
  const limit = input.category === 'ACTIVITY' ? Math.min(input.limit, 18) : input.limit;
  const around = `(around:${radiusMeters},${input.latitude},${input.longitude})`;
  const relationQuery = input.category === 'ACTIVITY' || input.category === 'OUTDOOR' ? '' : `relation${around}${filter};`;
  const outdoorExtras = input.category === 'OUTDOOR'
    ? `
      node${around}["tourism"~"^(viewpoint|alpine_hut|wilderness_hut|picnic_site|camp_site)$"];
      way${around}["tourism"~"^(viewpoint|alpine_hut|wilderness_hut|picnic_site|camp_site)$"];
      node${around}["leisure"~"^(nature_reserve|park)$"];
      way${around}["leisure"~"^(nature_reserve|park)$"];
    `
    : '';
  const query = `
    [out:json][timeout:35];
    (
      node${around}${filter};
      way${around}${filter};
      ${outdoorExtras}
      ${relationQuery}
    );
    out center tags ${limit};
  `;
  const payload = await overpassQuery(query);
  const elements = (payload as { elements?: unknown[] }).elements ?? [];
  const seen = new Set<string>();
  return elements
    .map((item) => normalizeDiscovery(item as OverpassElement, input.category))
    .filter((item): item is DiscoveryResult => Boolean(item))
    .filter((item) => {
      const key = `${item.name}:${item.latitude.toFixed(5)}:${item.longitude.toFixed(5)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleScore(name: string, title: string) {
  const normalizedName = normalizeText(name);
  const normalizedTitle = normalizeText(title);
  if (!normalizedName || !normalizedTitle) return 0;
  if (normalizedName === normalizedTitle) return 1;
  if (normalizedTitle.includes(normalizedName) || normalizedName.includes(normalizedTitle)) return 0.82;
  const nameTokens = new Set(normalizedName.split(' ').filter((token) => token.length > 2));
  const titleTokens = normalizedTitle.split(' ').filter((token) => token.length > 2);
  if (!nameTokens.size || !titleTokens.length) return 0;
  const shared = titleTokens.filter((token) => nameTokens.has(token)).length;
  return shared / Math.max(nameTokens.size, titleTokens.length);
}

function wikipediaOrigin(language: string) {
  const safeLanguage = /^[a-z-]{2,12}$/i.test(language) ? language.toLowerCase() : 'cs';
  return `https://${safeLanguage}.wikipedia.org`;
}

async function wikipediaGet(origin: string, path: string, query: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${origin}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const cacheKey = url.toString();
  const cached = readCache<unknown>(cacheKey);
  if (cached) return cached;

  const response = await withWikimediaRateLimit(() => fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': env.WIKIMEDIA_USER_AGENT,
    },
  }, wikipediaTimeoutMs));
  if (response.status === 404) return undefined;
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `Wikipedia lookup failed: ${text.slice(0, 500)}`);
  }
  const payload = await response.json() as unknown;
  writeCache(cacheKey, payload);
  return payload;
}

async function wikipediaSummary(origin: string, title: string) {
  const payload = await wikipediaGet(origin, `/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(' ', '_'))}`) as WikipediaSummaryPayload | undefined;
  if (!payload?.title) return undefined;
  return payload;
}

function normalizeWikipediaSummary(payload: WikipediaSummaryPayload, language: string): WikipediaSummaryResult | undefined {
  if (!payload.title) return undefined;
  return {
    provider: 'wikipedia',
    language,
    title: payload.title,
    description: payload.description,
    extract: payload.extract,
    imageUrl: payload.originalimage?.source ?? payload.thumbnail?.source,
    pageUrl: payload.content_urls?.desktop?.page ?? payload.content_urls?.mobile?.page,
  };
}

export async function getWikipediaSummary(input: { name: string; latitude?: number; longitude?: number; language: string; radiusMeters: number }) {
  const language = /^[a-z-]{2,12}$/i.test(input.language) ? input.language.toLowerCase() : 'cs';
  const origin = wikipediaOrigin(language);
  const candidates = new Map<string, number>();

  if (input.latitude !== undefined && input.longitude !== undefined) {
    const geoPayload = await wikipediaGet(origin, '/w/api.php', {
      action: 'query',
      list: 'geosearch',
      gscoord: `${input.latitude}|${input.longitude}`,
      gsradius: input.radiusMeters,
      gslimit: 8,
      format: 'json',
    }) as { query?: { geosearch?: WikipediaGeoSearchItem[] } } | undefined;

    for (const item of geoPayload?.query?.geosearch ?? []) {
      if (!item.title) continue;
      const score = titleScore(input.name, item.title) + Math.max(0, 0.3 - (item.dist ?? input.radiusMeters) / input.radiusMeters / 4);
      candidates.set(item.title, Math.max(candidates.get(item.title) ?? 0, score));
    }
  }

  const searchPayload = await wikipediaGet(origin, '/w/api.php', {
    action: 'query',
    list: 'search',
    srsearch: input.name,
    srlimit: 5,
    format: 'json',
  }) as { query?: { search?: WikipediaSearchItem[] } } | undefined;

  for (const item of searchPayload?.query?.search ?? []) {
    if (!item.title) continue;
    candidates.set(item.title, Math.max(candidates.get(item.title) ?? 0, titleScore(input.name, item.title) + 0.25));
  }

  if (!candidates.size) candidates.set(input.name, 0.1);

  const sortedTitles = [...candidates.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([title]) => title)
    .slice(0, 6);

  for (const title of sortedTitles) {
    const summary = await wikipediaSummary(origin, title);
    const normalized = summary ? normalizeWikipediaSummary(summary, language) : undefined;
    if (normalized?.extract || normalized?.imageUrl) return normalized;
  }

  if (language !== 'en') {
    return getWikipediaSummary({ ...input, language: 'en' });
  }

  return null;
}
