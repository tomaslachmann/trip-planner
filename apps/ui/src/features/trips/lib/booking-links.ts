import type { Trip } from '../types';

type BookingLinkCandidate = {
  deepLinkUrl?: string | null;
  accommodationDeepLinkUrl?: string | null;
  sourceUrl?: string | null;
};

function isBookingHost(url: URL) {
  return /(^|\.)booking\.com$/i.test(url.hostname);
}

export function isUsableBookingDetailUrl(value?: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (!isBookingHost(url)) return true;
    return url.pathname.includes('/hotel/') && url.pathname.endsWith('.html');
  } catch {
    return false;
  }
}

function firstDetailUrl(...values: Array<string | null | undefined>) {
  return values.find(isUsableBookingDetailUrl);
}

export function bookingDetailUrl(candidate: BookingLinkCandidate, trip?: Trip) {
  const url = firstDetailUrl(candidate.deepLinkUrl, candidate.accommodationDeepLinkUrl, candidate.sourceUrl);
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    if (isBookingHost(parsed)) {
      const startsAt = trip?.startsAt?.slice(0, 10);
      const endsAt = trip?.endsAt?.slice(0, 10);
      if (startsAt && !parsed.searchParams.has('checkin')) parsed.searchParams.set('checkin', startsAt);
      if (endsAt && !parsed.searchParams.has('checkout')) parsed.searchParams.set('checkout', endsAt);
      if (trip?.currency && !parsed.searchParams.has('selected_currency')) parsed.searchParams.set('selected_currency', trip.currency);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
