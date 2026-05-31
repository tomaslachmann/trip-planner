import { env } from '../../config/env.js';
import { fetchWithTimeout } from '../../utils/fetch.js';
import { httpError } from '../../utils/http.js';

type Coordinate = { latitude: number; longitude: number };
type PlaceForRoute = Coordinate & { id: string };
type TravelMode = keyof typeof averageSpeedMetersPerSecond;

const averageSpeedMetersPerSecond = {
  DRIVE: 16.7,
  WALK: 1.4,
  BIKE: 4.5,
  TRANSIT: 8.3,
} as const;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: Coordinate, to: Coordinate): number {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function encodeSigned(value: number): string {
  let encoded = value < 0 ? ~(value << 1) : value << 1;
  let output = '';
  while (encoded >= 0x20) {
    output += String.fromCharCode((0x20 | (encoded & 0x1f)) + 63);
    encoded >>= 5;
  }
  return output + String.fromCharCode(encoded + 63);
}

export function encodePolyline(points: Coordinate[]): string {
  let previousLatitude = 0;
  let previousLongitude = 0;
  let output = '';

  for (const point of points) {
    const latitude = Math.round(point.latitude * 1e5);
    const longitude = Math.round(point.longitude * 1e5);
    output += encodeSigned(latitude - previousLatitude);
    output += encodeSigned(longitude - previousLongitude);
    previousLatitude = latitude;
    previousLongitude = longitude;
  }

  return output;
}

export function estimateDurationSeconds(distance: number, mode: TravelMode): number {
  return Math.round(distance / averageSpeedMetersPerSecond[mode]);
}

function osrmProfile(mode: TravelMode) {
  if (mode === 'WALK') return 'foot';
  if (mode === 'BIKE') return 'bike';
  return 'driving';
}

function decodePolyline(polyline: string): Coordinate[] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const points: Coordinate[] = [];

  while (index < polyline.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < polyline.length);
    latitude += (result & 1) ? ~(result >> 1) : (result >> 1);

    result = 0;
    shift = 0;
    do {
      byte = polyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < polyline.length);
    longitude += (result & 1) ? ~(result >> 1) : (result >> 1);

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
}

function routeDate() {
  return new Date().toISOString().slice(0, 10);
}

function routeTime() {
  return new Date().toISOString().slice(11, 16);
}

async function resolveOpenTripPlannerLeg(fromPlace: PlaceForRoute, toPlace: PlaceForRoute) {
  if (!env.TRANSIT_OTP_BASE_URL) throw httpError(501, 'TRANSIT_OTP_BASE_URL is not configured for OpenTripPlanner transit routing');

  const url = new URL(`${env.TRANSIT_OTP_BASE_URL.replace(/\/$/, '')}/otp/routers/default/plan`);
  url.searchParams.set('fromPlace', `${fromPlace.latitude},${fromPlace.longitude}`);
  url.searchParams.set('toPlace', `${toPlace.latitude},${toPlace.longitude}`);
  url.searchParams.set('mode', 'TRANSIT,WALK');
  url.searchParams.set('date', routeDate());
  url.searchParams.set('time', routeTime());
  url.searchParams.set('arriveBy', 'false');
  url.searchParams.set('numItineraries', '1');

  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `OpenTripPlanner transit routing failed: ${text.slice(0, 500)}`);
  }

  const payload = await response.json() as {
    plan?: {
      itineraries?: Array<{
        duration?: number;
        legs?: Array<{ distance?: number; legGeometry?: { points?: string } }>;
      }>;
    };
    error?: { msg?: string; message?: string };
  };
  const itinerary = payload.plan?.itineraries?.[0];
  if (!itinerary) throw httpError(502, payload.error?.msg ?? payload.error?.message ?? 'OpenTripPlanner returned no transit itinerary');

  const legs = itinerary.legs ?? [];
  const decodedPoints = legs.flatMap((leg) => leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : []);
  const encodedPolyline = decodedPoints.length >= 2 ? encodePolyline(decodedPoints) : encodePolyline([fromPlace, toPlace]);

  return {
    distanceMeters: Math.round(legs.reduce((sum, leg) => sum + (leg.distance ?? 0), 0)),
    durationSeconds: Math.round(itinerary.duration ?? estimateDurationSeconds(distanceMeters(fromPlace, toPlace), 'TRANSIT')),
    encodedPolyline,
    provider: 'opentripplanner',
  };
}

export async function resolveRouteLeg(fromPlace: PlaceForRoute, toPlace: PlaceForRoute, mode: TravelMode) {
  if (mode === 'TRANSIT') {
    if (env.TRANSIT_PROVIDER === 'otp') return resolveOpenTripPlannerLeg(fromPlace, toPlace);
    throw httpError(501, 'Public transit routing requires a GTFS-backed provider. Configure TRANSIT_PROVIDER=otp and TRANSIT_OTP_BASE_URL for OpenTripPlanner.');
  }

  const coordinates = `${fromPlace.longitude},${fromPlace.latitude};${toPlace.longitude},${toPlace.latitude}`;
  const url = new URL(`${env.ROUTING_OSRM_BASE_URL.replace(/\/$/, '')}/route/v1/${osrmProfile(mode)}/${coordinates}`);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'polyline');
  url.searchParams.set('alternatives', 'false');
  url.searchParams.set('steps', 'false');

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `Routing provider failed: ${text.slice(0, 500)}`);
  }

  const payload = await response.json() as { routes?: Array<{ distance?: number; duration?: number; geometry?: string }> };
  const route = payload.routes?.[0];
  if (!route?.geometry || route.distance === undefined || route.duration === undefined) {
    throw httpError(502, 'Routing provider returned no route');
  }

  return {
    distanceMeters: Math.round(route.distance),
    durationSeconds: Math.round(route.duration),
    encodedPolyline: route.geometry,
    provider: `osrm-${osrmProfile(mode)}`,
  };
}

function routeDistance(places: PlaceForRoute[]): number {
  return places.slice(0, -1).reduce((sum, place, index) => sum + distanceMeters(place, places[index + 1]), 0);
}

function twoOptSwap(places: PlaceForRoute[], startIndex: number, endIndex: number) {
  return [
    ...places.slice(0, startIndex),
    ...places.slice(startIndex, endIndex + 1).reverse(),
    ...places.slice(endIndex + 1),
  ];
}

function improveWithTwoOpt(places: PlaceForRoute[]): PlaceForRoute[] {
  if (places.length < 4) return places;

  let best = places;
  let bestDistance = routeDistance(best);
  let improved = true;

  while (improved) {
    improved = false;
    for (let startIndex = 1; startIndex < best.length - 2; startIndex += 1) {
      for (let endIndex = startIndex + 1; endIndex < best.length - 1; endIndex += 1) {
        const candidate = twoOptSwap(best, startIndex, endIndex);
        const candidateDistance = routeDistance(candidate);
        if (candidateDistance < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
          improved = true;
        }
      }
    }
  }

  return best;
}

export function optimizePlaceOrder(places: PlaceForRoute[]): PlaceForRoute[] {
  const [first, ...rest] = places;
  if (!first) return [];
  const ordered = [first];
  const remaining = [...rest];

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    let nextIndex = 0;
    let nextDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const distance = distanceMeters(current, remaining[index]);
      if (distance < nextDistance) {
        nextDistance = distance;
        nextIndex = index;
      }
    }
    const [next] = remaining.splice(nextIndex, 1);
    ordered.push(next);
  }

  return improveWithTwoOpt(ordered);
}
