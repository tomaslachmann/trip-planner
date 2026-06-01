import type { TripMember } from '../types';

function dateKey(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function isMemberAvailableForRange(member: Pick<TripMember, 'availabilityWindows'>, startsAt?: string | null, endsAt?: string | null) {
  const start = dateKey(startsAt);
  const end = dateKey(endsAt);
  if (start === null || end === null) return true;

  const windows = member.availabilityWindows ?? [];
  if (windows.length === 0) return true;

  return windows.some((window) => {
    const windowStart = dateKey(window.startsAt);
    const windowEnd = dateKey(window.endsAt);
    if (windowStart === null || windowEnd === null) return false;
    return windowStart <= start && windowEnd >= end;
  });
}

export function memberAvailabilitySummary(member: Pick<TripMember, 'availabilityWindows'>) {
  const windows = member.availabilityWindows ?? [];
  if (windows.length === 0) return 'Dostupný celý výlet';

  return windows
    .map((window) => {
      const start = new Date(window.startsAt);
      const end = new Date(window.endsAt);
      return `${start.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    })
    .join(', ');
}
