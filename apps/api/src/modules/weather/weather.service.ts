import { env } from '../../config/env.js';
import { fetchWithTimeout } from '../../utils/fetch.js';
import { httpError } from '../../utils/http.js';

type WeatherPoint = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  dates: string[];
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: Array<number | null>;
  temperature_2m_max?: Array<number | null>;
  temperature_2m_min?: Array<number | null>;
  precipitation_probability_max?: Array<number | null>;
  precipitation_sum?: Array<number | null>;
  wind_speed_10m_max?: Array<number | null>;
  sunrise?: Array<string | null>;
  sunset?: Array<string | null>;
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

const cache = new Map<string, { expiresAt: number; value: OpenMeteoResponse }>();

function dateOnly(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function readCache(key: string) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) return undefined;
  return entry.value;
}

function writeCache(key: string, value: OpenMeteoResponse) {
  cache.set(key, { value, expiresAt: Date.now() + 30 * 60 * 1000 });
}

async function fetchPointForecast(point: WeatherPoint, startDate: string, endDate: string) {
  const url = new URL(env.OPEN_METEO_BASE_URL);
  url.searchParams.set('latitude', String(point.latitude));
  url.searchParams.set('longitude', String(point.longitude));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum',
    'wind_speed_10m_max',
    'sunrise',
    'sunset',
  ].join(','));

  const cacheKey = url.toString();
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text();
    throw httpError(response.status, `Weather provider failed: ${text.slice(0, 500)}`);
  }
  const payload = await response.json() as OpenMeteoResponse;
  writeCache(cacheKey, payload);
  return payload;
}

export async function getWeatherForPoints(points: WeatherPoint[]) {
  const pointsById = new Map<string, WeatherPoint>();
  points.forEach((point) => {
    const current = pointsById.get(point.id);
    if (current) current.dates = Array.from(new Set([...current.dates, ...point.dates]));
    else pointsById.set(point.id, { ...point, dates: [...point.dates] });
  });
  const uniquePoints = Array.from(pointsById.values())
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && point.dates.length > 0);

  const days = [];
  for (const point of uniquePoints) {
    const sortedDates = Array.from(new Set(point.dates.map(dateOnly))).sort();
    const payload = await fetchPointForecast(point, sortedDates[0], sortedDates[sortedDates.length - 1]);
    const daily = payload.daily ?? {};
    for (const date of sortedDates) {
      const index = daily.time?.indexOf(date) ?? -1;
      if (index < 0) continue;
      days.push({
        date,
        pointId: point.id,
        pointLabel: point.label,
        weatherCode: daily.weather_code?.[index] ?? null,
        temperatureMax: daily.temperature_2m_max?.[index] ?? null,
        temperatureMin: daily.temperature_2m_min?.[index] ?? null,
        precipitationProbabilityMax: daily.precipitation_probability_max?.[index] ?? null,
        precipitationSum: daily.precipitation_sum?.[index] ?? null,
        windSpeedMax: daily.wind_speed_10m_max?.[index] ?? null,
        sunrise: daily.sunrise?.[index] ?? null,
        sunset: daily.sunset?.[index] ?? null,
      });
    }
  }

  return {
    provider: 'open-meteo' as const,
    generatedAt: new Date().toISOString(),
    points: uniquePoints.map(({ dates: _dates, ...point }) => point),
    days,
  };
}
