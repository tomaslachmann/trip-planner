import { env } from '../../config/env.js';
import { fetchWithTimeout } from '../../utils/fetch.js';
import { httpError } from '../../utils/http.js';

export type AccommodationSearchInput = {
  destination?: string;
  checkin?: string;
  checkout?: string;
  startsAt?: string;
  endsAt?: string;
  adults: number;
  rooms: number;
  currency: string;
  latitude?: number;
  longitude?: number;
  radiusKm: number;
  minPrice?: number;
  maxPrice?: number;
  limit: number;
  bookingRequest?: Record<string, unknown>;
};

export type AccommodationSearchResult = {
  provider: 'booking';
  externalId: string;
  name: string;
  type?: string;
  photoUrl?: string;
  latitude: number;
  longitude: number;
  priceTotal?: number;
  priceDisplay?: string;
  currency?: string;
  rating?: number;
  reviewScore?: number;
  reviewCount?: number;
  sourceUrl?: string;
  deepLinkUrl?: string;
  raw?: unknown;
};

type UnknownRecord = Record<string, unknown>;

function dateOnly(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return value.slice(0, 10);
}

function pickNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function matchesPriceRange(item: AccommodationSearchResult, input: AccommodationSearchInput) {
  if (item.priceTotal === undefined) return true;
  if (input.minPrice !== undefined && item.priceTotal < input.minPrice) return false;
  if (input.maxPrice !== undefined && item.priceTotal > input.maxPrice) return false;
  return true;
}

function pickUrl(...values: unknown[]): string | undefined {
  const value = pickString(...values);
  if (!value) return undefined;
  try {
    return new URL(value).toString();
  } catch {
    return undefined;
  }
}

function pickId(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : undefined;
}

function asRecordArray(value: unknown): UnknownRecord[] | undefined {
  return Array.isArray(value) ? value.filter((item): item is UnknownRecord => Boolean(asRecord(item))) : undefined;
}

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickPriceDisplay(...values: unknown[]): string | undefined {
  return pickString(...values.map((value) => typeof value === 'number' ? Math.round(value).toLocaleString('cs-CZ') : value));
}

function slugifyBookingHotelName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addBookingSearchParams(url: URL, input: AccommodationSearchInput) {
  const dates = searchDates(input);
  url.searchParams.set('checkin', dates.checkin);
  url.searchParams.set('checkout', dates.checkout);
  url.searchParams.set('group_adults', String(input.adults));
  url.searchParams.set('no_rooms', String(input.rooms));
  url.searchParams.set('group_children', '0');
  url.searchParams.set('selected_currency', input.currency);
  url.searchParams.set('lang', 'cs');
}

function buildBookingSearchUrl(input: AccommodationSearchInput) {
  const url = new URL('https://www.booking.com/searchresults.html');
  url.searchParams.set('ss', input.destination ?? '');
  addBookingSearchParams(url, input);
  return url.toString();
}

function isBookingDetailUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const bookingHost = /(^|\.)booking\.com$/i.test(url.hostname);
    if (!bookingHost) return true;
    return url.pathname.includes('/hotel/') && url.pathname.endsWith('.html');
  } catch {
    return false;
  }
}

function withBookingSearchParams(value: string, input: AccommodationSearchInput) {
  try {
    const url = new URL(value);
    if (/(^|\.)booking\.com$/i.test(url.hostname)) addBookingSearchParams(url, input);
    return url.toString();
  } catch {
    return value;
  }
}

function buildBookingHotelUrl(item: UnknownRecord, property: UnknownRecord | undefined, input: AccommodationSearchInput, name: string, externalId: string) {
  const explicit = pickUrl(item.deeplink, item.deepLinkUrl, item.deep_link_url, item.hotel_url, property?.deepLinkUrl, property?.deep_link_url, item.url, property?.url);
  if (isBookingDetailUrl(explicit)) return withBookingSearchParams(explicit!, input);

  const country = pickString(item.countrycode, item.countryCode, property?.countrycode, property?.countryCode)?.toLowerCase();
  const slug = slugifyBookingHotelName(name);
  if (!country || !slug) return undefined;

  const url = new URL(`https://www.booking.com/hotel/${country}/${slug}.html`);
  addBookingSearchParams(url, input);
  url.searchParams.set('hotel_id', externalId);
  const ufi = pickId(item.ufi, property?.ufi);
  if (ufi) url.searchParams.set('dest_id', ufi);
  url.searchParams.set('dest_type', 'hotel');
  return url.toString();
}

function normalizeBookingType(item: UnknownRecord, property?: UnknownRecord) {
  const explicit = pickString(
    property?.propertyType,
    property?.property_type,
    item.accommodation_type_name,
    item.accommodationTypeName,
    item.ht_name,
  );
  if (explicit && explicit !== 'property_card') return explicit;

  const unitLabel = stripHtml(pickString(item.unit_configuration_label));
  const unitType = unitLabel?.split(':')[0]?.split(' – ')[0]?.trim();
  if (unitType) return unitType;

  const rawType = pickString(property?.type, item.type);
  if (rawType && rawType !== 'property_card') return rawType.replace(/_/g, ' ');
  return undefined;
}

function normalizeBookingResult(item: Record<string, unknown>, index: number): AccommodationSearchResult | undefined {
  const location = item.location as Record<string, unknown> | undefined;
  const coordinates = location?.coordinates as Record<string, unknown> | undefined;
  const price = item.price as Record<string, unknown> | undefined;
  const displayPrice = price?.display as Record<string, unknown> | undefined;
  const totalPrice = price?.total as Record<string, unknown> | undefined;
  const reviewScore = item.review_score as Record<string, unknown> | undefined;

  const latitude = pickNumber(item.latitude, location?.latitude, coordinates?.latitude, coordinates?.lat);
  const longitude = pickNumber(item.longitude, location?.longitude, coordinates?.longitude, coordinates?.lng, coordinates?.lon);
  if (latitude === undefined || longitude === undefined) return undefined;
  const sourceUrl = pickUrl(item.url);
  const deepLinkUrl = pickUrl(item.deep_link_url);

  return {
    provider: 'booking',
    externalId: String(item.id ?? item.accommodation ?? `booking-${index}`),
    name: pickString(item.name, item.title) ?? `Booking stay ${index + 1}`,
    type: pickString(item.type as string | undefined, item.accommodation_type as string | undefined),
    photoUrl: pickString(item.main_photo_url, item.photo_url),
    latitude,
    longitude,
    priceTotal: pickNumber(totalPrice?.amount, price?.total, price?.book, price?.base),
    priceDisplay: pickString(displayPrice?.amount as string | undefined, displayPrice?.gross as string | undefined),
    currency: pickString(item.currency as string | undefined, price?.currency as string | undefined),
    rating: pickNumber(item.rating, item.stars),
    reviewScore: pickNumber(reviewScore?.score, item.review_score),
    reviewCount: pickNumber(reviewScore?.review_count, item.review_count),
    sourceUrl: isBookingDetailUrl(sourceUrl) ? sourceUrl : undefined,
    deepLinkUrl: isBookingDetailUrl(deepLinkUrl) ? deepLinkUrl : undefined,
    raw: item,
  };
}

function normalizeRapidApiHotel(item: UnknownRecord, index: number, input: AccommodationSearchInput): AccommodationSearchResult | undefined {
  const property = asRecord(item.property);
  const location = asRecord(item.location);
  const priceBreakdown = asRecord(item.priceBreakdown ?? item.price_breakdown ?? item.composite_price_breakdown);
  const grossPrice = asRecord(priceBreakdown?.grossPrice ?? priceBreakdown?.gross_price ?? priceBreakdown?.gross_amount);
  const allInclusivePrice = asRecord(priceBreakdown?.allInclusiveAmount ?? priceBreakdown?.all_inclusive_amount);
  const strikethroughPrice = asRecord(priceBreakdown?.strikethroughPrice ?? priceBreakdown?.strikethrough_price);

  const latitude = pickNumber(item.latitude, item.lat, property?.latitude, property?.lat, location?.latitude, location?.lat);
  const longitude = pickNumber(item.longitude, item.lng, item.lon, property?.longitude, property?.lng, property?.lon, location?.longitude, location?.lng, location?.lon);
  if (latitude === undefined || longitude === undefined) return undefined;

  const externalId = pickId(item.hotel_id, item.hotelId, item.id, property?.id, property?.hotel_id) ?? `rapidapi-${index}`;
  const name = pickString(property?.name, item.name, item.hotel_name_trans, item.hotel_name, item.title) ?? `Booking stay ${index + 1}`;
  const searchUrl = buildBookingSearchUrl(input);
  const detailUrl = buildBookingHotelUrl(item, property, input, name, externalId);
  const priceTotal = pickNumber(grossPrice?.value, grossPrice?.amount, allInclusivePrice?.value, priceBreakdown?.grossPrice, priceBreakdown?.gross_price, item.min_total_price, item.price);
  const currency = pickString(grossPrice?.currency, allInclusivePrice?.currency, priceBreakdown?.currency, item.currency, item.currencycode) ?? input.currency;
  const priceDisplay = pickPriceDisplay(grossPrice?.amount_rounded, grossPrice?.amount_unrounded, allInclusivePrice?.amount_rounded, allInclusivePrice?.amount_unrounded);

  return {
    provider: 'booking',
    externalId,
    name,
    type: normalizeBookingType(item, property),
    photoUrl: pickString(property?.photoUrl, property?.photo_url, item.photoUrl, item.photo_url, item.main_photo_url),
    latitude,
    longitude,
    priceTotal,
    priceDisplay: priceDisplay ?? (priceTotal === undefined ? undefined : `${Math.round(priceTotal).toLocaleString('cs-CZ')} ${currency}`),
    currency,
    rating: pickNumber(property?.propertyClass, property?.class, item.class, item.stars),
    reviewScore: pickNumber(property?.reviewScore, property?.review_score, item.reviewScore, item.review_score),
    reviewCount: pickNumber(property?.reviewCount, property?.review_count, item.reviewCount, item.review_count, item.review_nr),
    sourceUrl: detailUrl ?? searchUrl,
    deepLinkUrl: detailUrl,
    raw: { ...item, strikethroughPrice },
  };
}

function extractRapidApiHotels(payload: unknown): UnknownRecord[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  return (
    asRecordArray(data?.hotels) ??
    asRecordArray(data?.result) ??
    asRecordArray(data?.results) ??
    asRecordArray(root?.hotels) ??
    asRecordArray(root?.result) ??
    asRecordArray(root?.results) ??
    asRecordArray(root?.data) ??
    []
  );
}

function extractRapidApiDestination(payload: unknown): UnknownRecord | undefined {
  const root = asRecord(payload);
  const data = asRecordArray(root?.data);
  return data?.find((item) => pickId(item.dest_id, item.destId, item.id)) ?? data?.[0];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function searchDates(input: AccommodationSearchInput) {
  const checkin = dateOnly(input.checkin ?? input.startsAt);
  const checkout = dateOnly(input.checkout ?? input.endsAt);
  if (checkin && checkout) return { checkin, checkout };

  const fallbackCheckin = checkin ?? toIsoDate(addDays(new Date(), 30));
  return {
    checkin: fallbackCheckin,
    checkout: checkout ?? toIsoDate(addDays(new Date(`${fallbackCheckin}T00:00:00.000Z`), 3)),
  };
}

function rapidApiHeaders() {
  if (!env.RAPIDAPI_KEY) throw httpError(500, 'RapidAPI key is not configured');
  return {
    'x-rapidapi-key': env.RAPIDAPI_KEY,
    'x-rapidapi-host': env.BOOKING_RAPIDAPI_HOST,
    'Content-Type': 'application/json',
  };
}

async function rapidApiGet(path: string, query: Record<string, string | number | undefined>) {
  const url = new URL(`${env.BOOKING_RAPIDAPI_BASE_URL.replace(/\/$/, '')}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const response = await fetchWithTimeout(url, { headers: rapidApiHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `RapidAPI Booking search failed: ${text.slice(0, 500)}`);
  }
  return response.json() as Promise<unknown>;
}

async function searchRapidApiAccommodations(input: AccommodationSearchInput): Promise<AccommodationSearchResult[]> {
  const dates = searchDates(input);
  const commonQuery = {
    arrival_date: dates.checkin,
    departure_date: dates.checkout,
    adults: input.adults,
    room_qty: input.rooms,
    currency_code: input.currency,
    languagecode: 'cs',
  };

  const searchPayload = input.latitude !== undefined && input.longitude !== undefined
    ? await rapidApiGet('/api/v1/hotels/searchHotelsByCoordinates', {
      latitude: input.latitude,
      longitude: input.longitude,
      arrival_date: dates.checkin,
      departure_date: dates.checkout,
      radius: input.radiusKm,
      adults: input.adults,
      room_qty: input.rooms,
      units: 'metric',
      page_number: 1,
      temperature_unit: 'c',
      languagecode: 'cs',
      currency_code: input.currency,
      location: 'US',
    })
    : await searchRapidApiByDestination(input, commonQuery);

  return extractRapidApiHotels(searchPayload)
    .map((item, index) => normalizeRapidApiHotel(item, index, input))
    .filter((item): item is AccommodationSearchResult => Boolean(item))
    .filter((item) => matchesPriceRange(item, input))
    .slice(0, input.limit);
}

async function searchRapidApiByDestination(input: AccommodationSearchInput, commonQuery: Record<string, string | number | undefined>) {
  const destination = input.destination?.trim();
  if (!destination) throw httpError(400, 'Destination or coordinates are required for Booking search');

  const destinationPayload = await rapidApiGet('/api/v1/hotels/searchDestination', { query: destination });
  const destinationResult = extractRapidApiDestination(destinationPayload);
  const destId = pickId(destinationResult?.dest_id, destinationResult?.destId, destinationResult?.id);
  if (!destId) throw httpError(502, 'RapidAPI Booking destination lookup did not return dest_id');

  return rapidApiGet('/api/v1/hotels/searchHotels', {
    ...commonQuery,
    dest_id: destId,
    search_type: pickString(destinationResult?.search_type, destinationResult?.searchType, destinationResult?.dest_type) ?? 'city',
  });
}

function buildBookingRequest(input: AccommodationSearchInput) {
  if (input.bookingRequest) return input.bookingRequest;
  return {
    booker: { country: 'cz', platform: 'desktop' },
    checkin: dateOnly(input.checkin ?? input.startsAt),
    checkout: dateOnly(input.checkout ?? input.endsAt),
    guests: {
      number_of_adults: input.adults,
      number_of_rooms: input.rooms,
    },
    currency: input.currency,
    extras: ['extra_charges', 'products'],
    rows: input.limit,
    ...(input.latitude !== undefined && input.longitude !== undefined
      ? { coordinates: { latitude: input.latitude, longitude: input.longitude, radius: input.radiusKm } }
      : {}),
  };
}

export async function searchAccommodations(input: AccommodationSearchInput): Promise<AccommodationSearchResult[]> {
  if (env.BOOKING_PROVIDER === 'rapidapi') {
    return searchRapidApiAccommodations(input);
  }

  if (!env.BOOKING_AFFILIATE_ID || !env.BOOKING_API_TOKEN) {
    throw httpError(500, 'Booking Demand API credentials are not configured');
  }

  const response = await fetchWithTimeout(`${env.BOOKING_API_BASE_URL.replace(/\/$/, '')}/accommodations/search`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.BOOKING_API_TOKEN}`,
      'content-type': 'application/json',
      'x-affiliate-id': env.BOOKING_AFFILIATE_ID,
    },
    body: JSON.stringify(buildBookingRequest(input)),
  });

  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `Booking search failed: ${text.slice(0, 500)}`);
  }

  const payload = await response.json() as { data?: Array<Record<string, unknown>> };
  return (payload.data ?? [])
    .map((item, index) => normalizeBookingResult(item, index))
    .filter((item): item is AccommodationSearchResult => Boolean(item))
    .filter((item) => matchesPriceRange(item, input))
    .slice(0, input.limit);
}
