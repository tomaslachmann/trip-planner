import type { Place, RoutePlan, Trip } from '../types';

export function formatTripRange(trip?: Trip) {
  if (!trip?.startsAt && !trip?.endsAt) return 'Termín otevřený';
  const formatter = new Intl.DateTimeFormat('cs-CZ', { month: 'short', day: 'numeric' });
  const start = trip.startsAt ? formatter.format(new Date(trip.startsAt)) : 'Otevřeno';
  const end = trip.endsAt ? formatter.format(new Date(trip.endsAt)) : 'Otevřeno';
  return `${start} - ${end}`;
}

export function routeDistanceKm(routes: RoutePlan[]) {
  const meters = routes.reduce((sum, route) => sum + (route.legs ?? []).reduce((legSum, leg) => legSum + (leg.distanceMeters ?? 0), 0), 0);
  return Math.round(meters / 100) / 10;
}

export function pinPosition(point: Pick<Place, 'latitude' | 'longitude'>, index: number) {
  if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
    const left = 8 + (((point.longitude + 180) / 360) * 84);
    const top = 8 + (((90 - point.latitude) / 180) * 84);
    return { left: `${Math.min(92, Math.max(8, left))}%`, top: `${Math.min(92, Math.max(8, top))}%` };
  }
  return { left: `${16 + ((index * 19) % 70)}%`, top: `${18 + ((index * 29) % 64)}%` };
}

export function categoryKey(type?: string) {
  if (type === 'FOOD') return 'food';
  if (type === 'ACTIVITY') return 'act';
  if (type === 'DAY_TRIP') return 'day';
  if (type === 'ACCOMMODATION' || type === 'STAY_AREA') return 'stay';
  if (type === 'TRANSPORT') return 'trans';
  return 'see';
}

export function roleLabel(role?: string) {
  if (role === 'OWNER') return 'Vlastník';
  if (role === 'ADMIN') return 'Správce';
  if (role === 'GUEST') return 'Host';
  return 'Člen';
}
