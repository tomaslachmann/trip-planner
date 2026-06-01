type MapPoint = {
  name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
};

function toCoordinate(value: MapPoint['latitude']) {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : undefined;
}

export function externalMapUrl(point?: MapPoint | null) {
  const latitude = toCoordinate(point?.latitude);
  const longitude = toCoordinate(point?.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;

  const query = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
