import { env } from '../../config/env.js';
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

const cache = new Map<string, { expiresAt: number; value: unknown }>();

function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) return undefined;
  return entry.value as T;
}

function writeCache(key: string, value: unknown) {
  cache.set(key, { value, expiresAt: Date.now() + 10 * 60 * 1000 });
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

  const response = await fetch(url, {
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
