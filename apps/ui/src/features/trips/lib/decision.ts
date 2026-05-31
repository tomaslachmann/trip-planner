import type { ItineraryDay, Place, Settlement, Trip, TripMember, WeatherDayForecast } from '../types';

export type PlaceStatus = 'PROPOSED' | 'SHORTLISTED' | 'APPROVED' | 'REJECTED';

export const placeStatusMeta: Record<PlaceStatus, { label: string; cls: string }> = {
  PROPOSED: { label: 'Návrh', cls: 'muted' },
  SHORTLISTED: { label: 'Shortlist', cls: 'amber' },
  APPROVED: { label: 'Schváleno', cls: 'green' },
  REJECTED: { label: 'Zamítnuto', cls: 'red' },
};

export function normalizePlaceStatus(value?: string | null): PlaceStatus {
  if (value === 'SHORTLISTED' || value === 'APPROVED' || value === 'REJECTED') return value;
  return 'PROPOSED';
}

export function voteScore(place: Place) {
  return (place.votes ?? []).reduce((sum, vote) => {
    if (vote.value === 'MUST_HAVE') return sum + 4;
    if (vote.value === 'UP') return sum + 2;
    if (vote.value === 'MAYBE') return sum + 1;
    if (vote.value === 'DOWN') return sum - 3;
    return sum;
  }, 0);
}

export function placeRecommendationScore(place: Place, members: TripMember[] = []) {
  const status = normalizePlaceStatus(place.status);
  const statusScore = status === 'APPROVED' ? 30 : status === 'SHORTLISTED' ? 14 : status === 'REJECTED' ? -40 : 0;
  const voteCoverage = members.length ? ((place.votes?.length ?? 0) / members.length) * 10 : 0;
  return Math.round(Math.max(0, Math.min(100, 45 + statusScore + voteScore(place) * 6 + voteCoverage)));
}

export function topPlaces(places: Place[], members: TripMember[] = [], limit = 5) {
  return places
    .filter((place) => normalizePlaceStatus(place.status) !== 'REJECTED')
    .map((place) => ({ place, score: placeRecommendationScore(place, members) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function distanceMeters(from: Pick<Place, 'latitude' | 'longitude'>, to: Pick<Place, 'latitude' | 'longitude'>) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function accommodationRecommendationScore(place: Place, places: Place[], members: TripMember[] = []) {
  const top = topPlaces(places.filter((item) => item.id !== place.id && item.type !== 'ACCOMMODATION'), members, 5);
  const averageDistance = top.length
    ? top.reduce((sum, item) => sum + distanceMeters(place, item.place), 0) / top.length
    : 2000;
  const distanceScore = Math.max(0, 25 - Math.min(25, averageDistance / 400));
  const rating = Number(place.accommodationReviewScore ?? place.accommodationRating ?? 0);
  const ratingScore = Math.min(25, rating > 5 ? rating * 2.5 : rating * 5);
  const reviewCount = Math.min(10, Math.log10((place.accommodationReviewCount ?? 0) + 1) * 5);
  const price = Number(place.estimatedCost ?? 0);
  const priceScore = price > 0 ? Math.max(0, 20 - Math.min(20, price / 80)) : 10;
  const status = normalizePlaceStatus(place.status);
  const statusScore = status === 'APPROVED' ? 10 : status === 'SHORTLISTED' ? 5 : status === 'REJECTED' ? -20 : 0;
  return Math.round(Math.max(0, Math.min(100, distanceScore + ratingScore + reviewCount + priceScore + voteScore(place) * 4 + statusScore)));
}

export function buildDecisionItems(input: {
  trip?: Trip;
  places: Place[];
  itinerary: ItineraryDay[];
  settlements: Settlement[];
  weatherDays?: WeatherDayForecast[];
}) {
  const accommodations = input.places.filter((place) => place.type === 'ACCOMMODATION');
  const approvedAccommodations = accommodations.filter((place) => ['APPROVED', 'SHORTLISTED'].includes(normalizePlaceStatus(place.status)) || ['SELECTED', 'BOOKED'].includes(String(place.accommodationStatus ?? '')));
  const pendingPlaces = input.places.filter((place) => normalizePlaceStatus(place.status) === 'PROPOSED' && (place.votes?.length ?? 0) === 0);
  const missingItineraryDays = input.itinerary.filter((day) => (day.stops ?? []).length === 0);
  const openSettlements = input.settlements.filter((settlement) => settlement.status !== 'CONFIRMED');
  const rainyDays = (input.weatherDays ?? []).filter((day) => (day.precipitationProbabilityMax ?? 0) >= 60);

  return [
    ...(accommodations.length > 0 && approvedAccommodations.length === 0 ? [{ tone: 'amber' as const, title: 'Vybrat ubytování', detail: `${accommodations.length} kandidátů čeká na rozhodnutí`, target: 'stay' as const }] : []),
    ...(missingItineraryDays.length > 0 ? [{ tone: 'amber' as const, title: 'Doplnit itinerář', detail: `${missingItineraryDays.length} dnů nemá žádné zastávky`, target: 'itinerary' as const }] : []),
    ...(openSettlements.length > 0 ? [{ tone: 'red' as const, title: 'Vyrovnat platby', detail: `${openSettlements.length} převodů ještě není potvrzeno`, target: 'settle' as const }] : []),
    ...(pendingPlaces.length > 0 ? [{ tone: 'muted' as const, title: 'Rozhodnout místa', detail: `${pendingPlaces.length} míst čeká na první hlas nebo status`, target: 'places' as const }] : []),
    ...(rainyDays.length > 0 ? [{ tone: 'amber' as const, title: 'Zkontrolovat rain plan', detail: `${rainyDays.length} předpovědí má vyšší riziko deště`, target: 'itinerary' as const }] : []),
  ];
}
