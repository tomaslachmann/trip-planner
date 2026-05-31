'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearAccessToken, createTripPlannerClient, getSessionUser, readAccessToken, signInRequest, signOutRequest, writeAccessToken } from '@/lib/api';
import type { Accommodation, ActivityEvent, ChecklistItem, DiscoveryPlace, Expense, ItineraryDay, LiveLocation, LocationResult, Place, PlaceType, Poll, TabKey, Trip, TripAiInsights, TripData, TripWeather } from '../types';

const emptyData: TripData = { places: [], itinerary: [], expenses: [], routes: [], settlements: [], polls: [], checklist: [], activity: [], liveLocations: [], weather: null, aiInsights: null };
const routeTabs: TabKey[] = ['map', 'plan', 'stay', 'costs', 'settle', 'members', 'more', 'checklist', 'polls', 'itinerary'];

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function parseDurationMinutes(value: string) {
  const text = value.trim().toLowerCase();
  if (!text) return undefined;
  const numeric = Number(text);
  if (Number.isFinite(numeric)) return numeric;
  const hours = text.match(/(\d+(?:[.,]\d+)?)\s*(h|hod|hodin)/);
  const minutes = text.match(/(\d+(?:[.,]\d+)?)\s*(m|min)/);
  const total = (hours ? Number(hours[1].replace(',', '.')) * 60 : 0) + (minutes ? Number(minutes[1].replace(',', '.')) : 0);
  return total > 0 ? Math.round(total) : undefined;
}

type PlannerRoute = {
  routeTripId?: string;
  routeView?: TabKey;
  redirectAfterSignIn?: boolean;
};

export function useTripPlanner({ routeTripId, routeView, redirectAfterSignIn = true }: PlannerRoute = {}) {
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [availableTrips, setAvailableTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(routeTripId ?? '');
  const [actorUserId, setActorUserId] = useState('');
  const [viewerEmail, setViewerEmail] = useState('');
  const [viewerName, setViewerName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>(routeView ?? 'map');
  const [data, setData] = useState<TripData>(emptyData);
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState('');
  const [discoveries, setDiscoveries] = useState<DiscoveryPlace[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchingStay, setSearchingStay] = useState(false);
  const [sharingLiveLocation, setSharingLiveLocation] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const restoreStartedRef = useRef(false);
  const loadingDetailKeyRef = useRef('');
  const loadedDetailKeyRef = useRef('');
  const liveLocationWatchRef = useRef<number | null>(null);

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId), [selectedTripId, trips]);
  const joinedTrips = trips;
  const selectedPlace = useMemo(() => data.places.find((place) => place.id === selectedPlaceId), [data.places, selectedPlaceId]);
  const selectedExpense = useMemo(() => data.expenses.find((expense) => expense.id === selectedExpenseId), [data.expenses, selectedExpenseId]);
  const selectedAccommodation = useMemo(() => accommodations.find((stay) => stay.externalId === selectedAccommodationId), [accommodations, selectedAccommodationId]);
  const actorMember = useMemo(() => selectedTrip?.members?.find((member) => member.userId === actorUserId), [actorUserId, selectedTrip]);
  const api = useMemo(() => createTripPlannerClient(accessToken), [accessToken]);

  function tripHref(tab: TabKey, tripId = selectedTripId) {
    if (!tripId) return '/trips';
    return `/trips/${encodeURIComponent(tripId)}/${encodeURIComponent(tab)}`;
  }

  function setRoutedTab(tab: TabKey, mode: 'push' | 'replace' = 'push') {
    setActiveTab(tab);
    const href = tripHref(tab);
    if (href === '/') return;
    if (mode === 'replace') router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  }

  async function loadTrips(token = accessToken) {
    if (!token) {
      setTrips([]);
      setAvailableTrips([]);
      setLoading(false);
      return [] as Trip[];
    }
    setLoading(true);
    setMessage(null);
    const client = createTripPlannerClient(token);
    const [joined, available] = await Promise.all([
      client.GET('/trips'),
      client.GET('/trips/available'),
    ]);
    if (joined.error || available.error) {
      if ((joined.response?.status ?? available.response?.status) === 401) {
        clearAccessToken();
        setAccessToken('');
        setActorUserId('');
        setViewerEmail('');
        setViewerName('');
        setMessage('Přihlášení vypršelo. Přihlas se znovu.');
      } else {
        setMessage('Nepodařilo se načíst data. Zkontroluj připojení k API.');
      }
      setLoading(false);
      return [] as Trip[];
    }
    const nextTrips = uniqueById((joined.data as Trip[] | undefined) ?? []);
    setTrips(nextTrips);
    setAvailableTrips(uniqueById((available.data as Trip[] | undefined) ?? []));
    setLoading(false);
    return nextTrips;
  }

  async function loadTripDetail(trip = selectedTrip, actor = actorUserId, token = accessToken, options: { force?: boolean } = {}) {
    if (!trip || !actor || !token) return;
    const requestKey = `${trip.id}:${actor}:${token}`;
    if (!options.force && (loadingDetailKeyRef.current === requestKey || loadedDetailKeyRef.current === requestKey)) return;
    loadingDetailKeyRef.current = requestKey;
    const client = createTripPlannerClient(token);
    try {
      const [tripDetail, places, itinerary, expenses, routes, settlements, polls, checklist, activity, liveLocations, weather] = await Promise.all([
        client.GET('/trips/{id}', { params: { path: { id: trip.id } } }),
        client.GET('/places/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/itinerary/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/expenses/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/routes/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/settlements/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        apiFetch<Poll[]>(`/polls/trip/${encodeURIComponent(trip.id)}`, {}, token).then((result) => ({ data: result })).catch(() => ({ data: [] as Poll[] })),
        apiFetch<ChecklistItem[]>(`/checklist/trip/${encodeURIComponent(trip.id)}`, {}, token).then((result) => ({ data: result })).catch(() => ({ data: [] as ChecklistItem[] })),
        apiFetch<ActivityEvent[]>(`/activity/trip/${encodeURIComponent(trip.id)}`, {}, token).then((result) => ({ data: result })).catch(() => ({ data: [] as ActivityEvent[] })),
        apiFetch<LiveLocation[]>(`/locations/live/trip/${encodeURIComponent(trip.id)}`, {}, token).then((result) => ({ data: result })).catch(() => ({ data: [] as LiveLocation[] })),
        apiFetch<TripWeather>(`/weather/trip/${encodeURIComponent(trip.id)}`, {}, token).then((result) => ({ data: result })).catch(() => ({ data: null as TripWeather | null })),
      ]);
      if (tripDetail.data) {
        const detailedTrip = tripDetail.data as Trip;
        setTrips((current) => uniqueById(current.map((item) => item.id === detailedTrip.id ? detailedTrip : item)));
      }
      const nextPlaces = uniqueById((places.data as Place[] | undefined) ?? []);
      setData((current) => ({
        places: nextPlaces,
        itinerary: uniqueById((itinerary.data as ItineraryDay[] | undefined) ?? []),
        expenses: uniqueById((expenses.data as TripData['expenses'] | undefined) ?? []),
        routes: uniqueById((routes.data as TripData['routes'] | undefined) ?? []),
        settlements: (settlements.data as TripData['settlements'] | undefined) ?? [],
        polls: uniqueById(polls.data),
        checklist: uniqueById(checklist.data),
        activity: uniqueById(activity.data),
        liveLocations: uniqueById(liveLocations.data),
        weather: weather.data,
        aiInsights: current.aiInsights ?? null,
      }));
      setSelectedPlaceId((current) => nextPlaces.some((place) => place.id === current) ? current : '');
      loadedDetailKeyRef.current = requestKey;
    } finally {
      if (loadingDetailKeyRef.current === requestKey) loadingDetailKeyRef.current = '';
    }
  }

  useEffect(() => {
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    const token = readAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    async function restoreSession() {
      try {
        const { user } = await getSessionUser(token);
        setAccessToken(token);
        setActorUserId(user.id);
        setViewerEmail(user.email.toLowerCase());
        setViewerName(user.name);
        await loadTrips(token);
      } catch {
        clearAccessToken();
        setAccessToken('');
        setActorUserId('');
        setViewerEmail('');
        setViewerName('');
        setLoading(false);
      }
    }

    void restoreSession();
  }, []);

  useEffect(() => {
    if (selectedTrip && actorUserId && accessToken) void loadTripDetail(selectedTrip, actorUserId, accessToken);
  }, [selectedTrip, actorUserId, accessToken]);

  useEffect(() => {
    if (routeView && routeTabs.includes(routeView)) setActiveTab(routeView);
  }, [routeView]);

  useEffect(() => {
    if (!routeTripId) return;
    setSelectedTripId(routeTripId);
  }, [routeTripId]);

  useEffect(() => {
    if (!routeTripId || !actorUserId || loading) return;
    const trip = trips.find((item) => item.id === routeTripId);
    if (!trip) return setMessage('Trip z URL neexistuje.');
    const member = trip.members?.find((item) => item.userId === actorUserId);
    if (!member) {
      setActorUserId('');
      return setMessage('K tomuhle tripu nemáš přístup. Připoj se nebo změň účet.');
    }
    setSelectedTripId(trip.id);
    setMessage(null);
  }, [routeTripId, actorUserId, loading, trips]);

  async function signIn(formData: FormData) {
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    const name = String(formData.get('name') ?? '').trim();
    if (!email) return setMessage('E-mail je povinný.');
    const nextName = name || email.split('@')[0] || 'Cestovatel';
    setLoading(true);
    try {
      const session = await signInRequest({ email, name: nextName });
      writeAccessToken(session.accessToken);
      setAccessToken(session.accessToken);
      setViewerEmail(session.user.email.toLowerCase());
      setViewerName(session.user.name);
      setActorUserId(session.user.id);
      setSelectedTripId(routeTripId ?? '');
      setData(emptyData);
      setMessage(null);
      await loadTrips(session.accessToken);
      if (redirectAfterSignIn && !routeTripId) router.push('/trips', { scroll: false });
    } catch {
      setMessage('Přihlášení se nepodařilo.');
      setLoading(false);
    }
  }

  async function signOut() {
    if (accessToken) {
      try {
        await signOutRequest(accessToken);
      } catch {
        // JWT je stateless; lokální odhlášení je rozhodující i když API neodpoví.
      }
    }
    clearAccessToken();
    setAccessToken('');
    setViewerEmail('');
    setViewerName('');
    setActorUserId('');
    setSelectedTripId('');
    setData(emptyData);
    setSelectedPlaceId('');
    setSelectedExpenseId('');
    setAccommodations([]);
    setDiscoveries([]);
    setSelectedAccommodationId('');
    setSharingLiveLocation(false);
    if (liveLocationWatchRef.current !== null) {
      navigator.geolocation?.clearWatch(liveLocationWatchRef.current);
      liveLocationWatchRef.current = null;
    }
    setMessage(null);
    router.push('/', { scroll: false });
  }

  async function openTrip(tripId: string) {
    const trip = trips.find((item) => item.id === tripId);
    if (!trip || !actorUserId) return setMessage('Nejdřív se přihlaš.');
    const member = trip.members?.find((item) => item.userId === actorUserId);
    if (!member) return setMessage('Nejdřív se k tomuhle tripu připoj.');
    setSelectedTripId(trip.id);
    setActiveTab('map');
    router.push(tripHref('map', trip.id), { scroll: false });
    setMessage(null);
    await loadTripDetail(trip, member.userId, accessToken, { force: true });
  }

  async function joinTrip(tripId: string) {
    const trip = availableTrips.find((item) => item.id === tripId);
    if (!trip || !viewerEmail || !accessToken) return setMessage('Nejdřív se přihlaš.');
    const { data: member, error } = await api.POST('/trips/join', {
      body: { inviteCode: trip.inviteCode, user: { email: viewerEmail, name: viewerName || viewerEmail.split('@')[0] || 'Cestovatel' } },
    });
    if (error) return setMessage('Nepodařilo se připojit k tripu.');
    await loadTrips(accessToken);
    setSelectedTripId(trip.id);
    setActiveTab('map');
    router.push(tripHref('map', trip.id), { scroll: false });
    setMessage(null);
    if ((member as { userId?: string } | undefined)?.userId) await loadTripDetail(trip, (member as { userId: string }).userId, accessToken, { force: true });
  }

  async function joinTripByInviteCode(inviteCode: string) {
    if (!accessToken) return setMessage('Nejdřív se přihlaš.');
    const { data: member, error } = await api.POST('/trips/invite/{inviteCode}/join', {
      params: { path: { inviteCode } },
    });
    if (error) return setMessage('Nepodařilo se připojit k tripu.');
    const tripId = (member as { tripId?: string } | undefined)?.tripId;
    const nextTrips = await loadTrips(accessToken);
    const trip = nextTrips.find((item) => item.id === tripId);
    if (trip) {
      setSelectedTripId(trip.id);
      setActiveTab('map');
      router.push(tripHref('map', trip.id), { scroll: false });
      await loadTripDetail(trip, actorUserId, accessToken, { force: true });
    } else {
      router.push('/trips', { scroll: false });
    }
  }

  async function updateTrip(data: { name?: string; destination?: string; startsAt?: string | null; endsAt?: string | null; currency?: string }) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.PATCH('/trips/{id}', {
      params: { path: { id: selectedTrip.id } },
      body: data,
    });
    if (error) return setMessage('Trip se nepodařilo aktualizovat.');
    const nextTrips = await loadTrips(accessToken);
    const nextTrip = nextTrips.find((trip) => trip.id === selectedTrip.id) ?? selectedTrip;
    await loadTripDetail(nextTrip, actorUserId, accessToken, { force: true });
  }

  async function deleteTrip() {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.DELETE('/trips/{id}', {
      params: { path: { id: selectedTrip.id } },
      body: {},
    });
    if (error) return setMessage('Trip se nepodařilo smazat.');
    setSelectedTripId('');
    setData(emptyData);
    await loadTrips(accessToken);
    router.push('/trips', { scroll: false });
  }

  async function createTrip(formData: FormData) {
    if (!accessToken || !viewerEmail) return setMessage('Nejdřív se přihlaš.');
    const name = String(formData.get('name') ?? '').trim();
    const destination = String(formData.get('destination') ?? '').trim();
    const currency = String(formData.get('currency') ?? 'CZK').trim().toUpperCase() || 'CZK';
    const ownerName = viewerName || viewerEmail.split('@')[0] || 'Cestovatel';
    if (!name) return setMessage('Název tripu je povinný.');
    const { data: created, error } = await api.POST('/trips', {
      body: { name, destination: destination || undefined, currency, owner: { name: ownerName, email: viewerEmail } },
    });
    if (error) return setMessage('Trip se nepodařilo vytvořit.');
    const trip = created as Trip;
    setSelectedTripId(trip.id);
    setData(emptyData);
    await loadTrips(accessToken);
    router.push(tripHref('map', trip.id), { scroll: false });
  }

  async function addPlace(formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const name = String(formData.get('placeName') ?? '').trim();
    const type = String(formData.get('placeType') ?? 'PLACE') as PlaceType;
    const description = String(formData.get('notes') ?? '').trim();
    const durationText = String(formData.get('durationMin') ?? formData.get('duration') ?? '').trim();
    const priceText = String(formData.get('estimatedCost') ?? formData.get('price') ?? '').trim();
    const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
    const weatherSuitability = String(formData.get('weatherSuitability') ?? 'MIXED').trim() as 'INDOOR' | 'OUTDOOR' | 'MIXED';
    const latitude = Number(formData.get('latitude') || Number.NaN);
    const longitude = Number(formData.get('longitude') || Number.NaN);
    const durationMin = parseDurationMinutes(durationText);
    const estimatedCost = priceText ? Number(priceText) : undefined;
    if (!name) return setMessage('Název místa je povinný.');
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return setMessage('Vyber lokaci z našeptávače.');
    const { data: created, error } = await api.POST('/places', {
      body: {
        tripId: selectedTrip.id,
        type,
        name,
        latitude,
        longitude,
        description: description || undefined,
        durationMin: durationMin && Number.isFinite(durationMin) ? durationMin : undefined,
        estimatedCost: estimatedCost !== undefined && Number.isFinite(estimatedCost) ? estimatedCost : undefined,
        sourceUrl: sourceUrl || undefined,
        weatherSuitability,
      },
    });
    if (error) return setMessage('Místo se nepodařilo přidat.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
    return created as Place;
  }

  async function updatePlace(placeId: string, formData: FormData) {
    if (!actorUserId) return setMessage('Nejdřív se přihlaš.');
    const name = String(formData.get('placeName') ?? '').trim();
    const type = String(formData.get('placeType') ?? '').trim() as PlaceType;
    const description = String(formData.get('notes') ?? '').trim();
    const durationText = String(formData.get('durationMin') ?? formData.get('duration') ?? '').trim();
    const priceText = String(formData.get('estimatedCost') ?? formData.get('price') ?? '').trim();
    const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
    const weatherSuitability = String(formData.get('weatherSuitability') ?? '').trim() as 'INDOOR' | 'OUTDOOR' | 'MIXED' | '';
    const latitudeValue = String(formData.get('latitude') ?? '').trim();
    const longitudeValue = String(formData.get('longitude') ?? '').trim();
    const durationMin = parseDurationMinutes(durationText);
    const estimatedCost = priceText ? Number(priceText) : undefined;
    const latitude = latitudeValue ? Number(latitudeValue) : undefined;
    const longitude = longitudeValue ? Number(longitudeValue) : undefined;
    const { data: updated, error } = await api.PATCH('/places/{id}', {
      params: { path: { id: placeId } },
      body: {
        name: name || undefined,
        type: type || undefined,
        description: description || null,
        latitude: latitude !== undefined && Number.isFinite(latitude) ? latitude : undefined,
        longitude: longitude !== undefined && Number.isFinite(longitude) ? longitude : undefined,
        durationMin: durationMin !== undefined && Number.isFinite(durationMin) ? durationMin : null,
        estimatedCost: estimatedCost !== undefined && Number.isFinite(estimatedCost) ? estimatedCost : null,
        sourceUrl: sourceUrl || null,
        weatherSuitability: weatherSuitability || undefined,
      },
    });
    if (error) return setMessage('Místo se nepodařilo upravit.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
    return updated as Place;
  }

  async function deletePlace(placeId: string) {
    if (!actorUserId) return setMessage('Nejdřív se přihlaš.');
    const { error } = await api.DELETE('/places/{id}', {
      params: { path: { id: placeId } },
      body: {},
    });
    if (error) return setMessage('Místo se nepodařilo smazat.');
    setSelectedPlaceId('');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function createDefaultItineraryDay() {
    if (!selectedTrip || !actorUserId) throw new Error('Chybí trip nebo uživatel');
    const { data: day, error } = await api.POST('/itinerary/days', {
      body: { tripId: selectedTrip.id, date: selectedTrip.startsAt ?? new Date().toISOString(), title: 'Den 1' },
    });
    if (error) throw new Error('Nepodařilo se vytvořit den itineráře');
    return day as ItineraryDay;
  }

  function dayTimeToIso(day: ItineraryDay, value?: string) {
    if (!value) return undefined;
    return new Date(`${day.date.slice(0, 10)}T${value}:00`).toISOString();
  }

  function isoPlusMinutes(value: string | undefined, minutes?: number | null) {
    if (!value || !minutes) return undefined;
    const date = new Date(value);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString();
  }

  async function addPlaceToItinerary(placeId: string, dayId?: string, input: { startsAtTime?: string; endsAtTime?: string; note?: string; tripMemberIds?: string[] } = {}) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const day = dayId ? data.itinerary.find((item) => item.id === dayId) : data.itinerary[0] ?? await createDefaultItineraryDay();
    if (!day) return setMessage('Nejdřív vytvoř den itineráře.');
    const place = data.places.find((item) => item.id === placeId);
    const startsAt = dayTimeToIso(day, input.startsAtTime);
    const endsAt = dayTimeToIso(day, input.endsAtTime) ?? isoPlusMinutes(startsAt, place?.durationMin);
    const { error } = await api.POST('/itinerary/days/{dayId}/stops', {
      params: { path: { dayId: day.id } },
      body: { placeId, order: day.stops?.length ?? 0, startsAt, endsAt, note: input.note || undefined, tripMemberIds: input.tripMemberIds },
    });
    if (error) return setMessage('Místo se nepodařilo přidat do itineráře.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
    setRoutedTab('plan');
  }

  async function voteForPlace(placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.POST('/places/{id}/votes', {
      params: { path: { id: placeId } },
      body: { value },
    });
    if (error) return setMessage('Hlas se nepodařilo uložit.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function updateAccommodationStatus(placeId: string, status: 'SAVED' | 'SHORTLISTED' | 'SELECTED' | 'BOOKED' | 'REJECTED') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch<Place>(`/places/${encodeURIComponent(placeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accommodationStatus: status }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Stav ubytování se nepodařilo uložit.');
    }
  }

  async function voteForPlaceOnDay(dayId: string, placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch(`/itinerary/days/${encodeURIComponent(dayId)}/places/${encodeURIComponent(placeId)}/vote`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Hlas pro den se nepodařilo uložit.');
    }
  }

  async function commentOnPlace(placeId: string, body: string) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const text = body.trim();
    if (!text) return setMessage('Komentář nesmí být prázdný.');
    const { error } = await api.POST('/places/{id}/comments', {
      params: { path: { id: placeId } },
      body: { body: text },
    });
    if (error) return setMessage('Komentář se nepodařilo uložit.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function reorderStops(dayId: string, stopIds: string[]) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.PATCH('/itinerary/days/{dayId}/stops/reorder', {
      params: { path: { dayId } },
      body: { stopIds },
    });
    if (error) return setMessage('Pořadí itineráře se nepodařilo uložit.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function updateItineraryStop(stopId: string, input: { startsAt?: string | null; endsAt?: string | null; note?: string | null; tripMemberIds?: string[] }) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/itinerary/stops/${encodeURIComponent(stopId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Zastávku se nepodařilo upravit.');
    }
  }

  async function updateStopAttendance(stopId: string, status: 'GOING' | 'MAYBE' | 'NO') {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/itinerary/stops/${encodeURIComponent(stopId)}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Účast se nepodařilo uložit.');
    }
  }

  async function deleteItineraryStop(stopId: string) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/itinerary/stops/${encodeURIComponent(stopId)}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Zastávku se nepodařilo smazat.');
    }
  }

  async function addExpense(formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const title = String(formData.get('expenseTitle') ?? '').trim();
    const amount = Number(formData.get('amount') || 0);
    const originalAmount = Number(formData.get('originalAmount') || 0);
    const originalCurrency = String(formData.get('originalCurrency') ?? '').trim();
    const exchangeRate = Number(formData.get('exchangeRate') || 0);
    const paidById = String(formData.get('paidById') ?? actorUserId).trim() || actorUserId;
    const splitScope = String(formData.get('splitScope') ?? 'all');
    const splitUserIds = formData.getAll('splitUserIds').map(String).filter(Boolean);
    if (!title || amount <= 0) return setMessage('Název nákladu a částka jsou povinné.');
    if (splitScope === 'selected' && splitUserIds.length === 0) return setMessage('Vyber aspoň jednoho účastníka splitu.');
    const { error } = await api.POST('/expenses', {
      body: {
        tripId: selectedTrip.id,
        paidById,
        title,
        amount,
        currency: selectedTrip.currency,
        originalAmount: originalAmount > 0 ? originalAmount : undefined,
        originalCurrency: originalCurrency || undefined,
        exchangeRate: exchangeRate > 0 ? exchangeRate : undefined,
        splitType: 'EQUAL',
        splitAllTripMembers: splitScope === 'all',
        splitUserIds: splitScope === 'selected' ? splitUserIds : undefined,
      } as never,
    });
    if (error) return setMessage('Náklad se nepodařilo přidat.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  function expensePayloadFromForm(formData: FormData) {
    const title = String(formData.get('expenseTitle') ?? '').trim();
    const amount = Number(formData.get('amount') || 0);
    const originalAmount = Number(formData.get('originalAmount') || 0);
    const originalCurrency = String(formData.get('originalCurrency') ?? '').trim();
    const exchangeRate = Number(formData.get('exchangeRate') || 0);
    const paidById = String(formData.get('paidById') ?? actorUserId).trim() || actorUserId;
    const splitScope = String(formData.get('splitScope') ?? 'all');
    const splitUserIds = formData.getAll('splitUserIds').map(String).filter(Boolean);
    return { title, amount, originalAmount, originalCurrency, exchangeRate, paidById, splitScope, splitUserIds };
  }

  async function updateExpense(expenseId: string, formData: FormData) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    const payload = expensePayloadFromForm(formData);
    if (!payload.title || payload.amount <= 0) return setMessage('Název nákladu a částka jsou povinné.');
    if (payload.splitScope === 'selected' && payload.splitUserIds.length === 0) return setMessage('Vyber aspoň jednoho účastníka splitu.');
    try {
      await apiFetch<Expense>(`/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paidById: payload.paidById,
          title: payload.title,
          amount: payload.amount,
          currency: selectedTrip.currency,
          originalAmount: payload.originalAmount > 0 ? payload.originalAmount : null,
          originalCurrency: payload.originalCurrency || null,
          exchangeRate: payload.exchangeRate > 0 ? payload.exchangeRate : null,
          splitType: 'EQUAL',
          splitAllTripMembers: payload.splitScope === 'all',
          splitUserIds: payload.splitScope === 'selected' ? payload.splitUserIds : undefined,
        }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Náklad se nepodařilo upravit.');
    }
  }

  async function deleteExpense(expenseId: string) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }, accessToken);
      setSelectedExpenseId('');
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Náklad se nepodařilo smazat.');
    }
  }

  async function updateSettlementStatus(settlement: { fromUserId: string; toUserId: string; amount: number; currency: string }, status: 'OPEN' | 'PAID' | 'CONFIRMED' | 'CANCELLED') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch(`/settlements/trip/${encodeURIComponent(selectedTrip.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ...settlement, status }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Stav platby se nepodařilo uložit.');
    }
  }

  async function searchStays(formData?: FormData, centerOverride?: { latitude: number; longitude: number }) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    setSearchingStay(true);
    const destination = String(formData?.get('stayDestination') ?? selectedTrip.destination ?? selectedTrip.name).trim();
    const center = centerOverride ?? data.places[0];
    const { data: result, error } = await api.POST('/accommodations/search', {
      body: {
        tripId: selectedTrip.id,
        destination,
        checkin: String(formData?.get('checkin') ?? selectedTrip.startsAt?.slice(0, 10) ?? '') || undefined,
        checkout: String(formData?.get('checkout') ?? selectedTrip.endsAt?.slice(0, 10) ?? '') || undefined,
        adults: Number(formData?.get('adults') || selectedTrip.members?.length || 2),
        rooms: 1,
        currency: selectedTrip.currency || 'EUR',
        latitude: center?.latitude,
        longitude: center?.longitude,
        radiusKm: 15,
        limit: 18,
      },
    });
    setSearchingStay(false);
    if (error) return setMessage('Vyhledání ubytování selhalo.');
    const next = ((result as { results?: Accommodation[] } | undefined)?.results ?? []);
    setAccommodations(next);
    setSelectedAccommodationId(next[0]?.externalId ?? '');
  }

  async function saveAccommodation(stay: Accommodation) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.POST('/accommodations/save', {
      body: {
        tripId: selectedTrip.id,
        externalId: stay.externalId,
        name: stay.name,
        latitude: stay.latitude,
        longitude: stay.longitude,
        priceTotal: stay.priceTotal,
        currency: stay.currency,
        rating: stay.rating,
        reviewScore: stay.reviewScore,
        reviewCount: stay.reviewCount,
        sourceUrl: stay.sourceUrl,
        deepLinkUrl: stay.deepLinkUrl,
        provider: stay.provider,
      },
    });
    if (error) return setMessage('Ubytování se nepodařilo uložit.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  function toApiDateTime(value: string, endOfDay = false) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
    }
    return new Date(value).toISOString();
  }

  async function addAvailability(tripMemberId: string, formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const startsAt = String(formData.get('startsAtDate') ?? formData.get('startsAt') ?? '').trim();
    const endsAt = String(formData.get('endsAtDate') ?? formData.get('endsAt') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    if (!startsAt || !endsAt) return setMessage('Vyplň začátek i konec dostupnosti.');
    const { error } = await api.POST('/members/{tripMemberId}/availability', {
      params: { path: { tripMemberId } },
      body: { startsAt: toApiDateTime(startsAt), endsAt: toApiDateTime(endsAt, true), note: note || undefined },
    });
    if (error) return setMessage('Dostupnost se nepodařilo uložit.');
    setMessage(null);
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function updateAvailability(availabilityId: string, formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const startsAt = String(formData.get('startsAtDate') ?? formData.get('startsAt') ?? '').trim();
    const endsAt = String(formData.get('endsAtDate') ?? formData.get('endsAt') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    if (!startsAt || !endsAt) return setMessage('Vyplň začátek i konec dostupnosti.');
    const { error } = await api.PATCH('/members/availability/{availabilityId}', {
      params: { path: { availabilityId } },
      body: { startsAt: toApiDateTime(startsAt), endsAt: toApiDateTime(endsAt, true), note: note || null },
    });
    if (error) return setMessage('Dostupnost se nepodařilo upravit.');
    setMessage(null);
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function updateTripMemberRole(memberId: string, role: 'ADMIN' | 'MEMBER' | 'GUEST') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch(`/trips/${encodeURIComponent(selectedTrip.id)}/members/${encodeURIComponent(memberId)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }, accessToken);
      const nextTrips = await loadTrips(accessToken);
      const nextTrip = nextTrips.find((trip) => trip.id === selectedTrip.id) ?? selectedTrip;
      await loadTripDetail(nextTrip, actorUserId, accessToken, { force: true });
    } catch {
      setMessage('Roli člena se nepodařilo změnit.');
    }
  }

  async function updateMemberPlanning(memberId: string, input: { budgetPreference?: 'BUDGET' | 'NORMAL' | 'PREMIUM'; budgetAmount?: number | null }) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch(`/members/${encodeURIComponent(memberId)}/planning`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }, accessToken);
      const nextTrips = await loadTrips(accessToken);
      const nextTrip = nextTrips.find((trip) => trip.id === selectedTrip.id) ?? selectedTrip;
      await loadTripDetail(nextTrip, actorUserId, accessToken, { force: true });
    } catch {
      setMessage('Budget profil se nepodařilo uložit.');
    }
  }

  async function syncItineraryDays() {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch(`/itinerary/trip/${encodeURIComponent(selectedTrip.id)}/sync-days`, {
        method: 'POST',
        body: JSON.stringify({}),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Dny itineráře se nepodařilo synchronizovat.');
    }
  }

  async function updateItineraryDay(dayId: string, body: { title?: string | null; basePlaceId?: string | null; intensity?: 'CALM' | 'NORMAL' | 'INTENSE'; rainPlan?: string | null; bufferMinutes?: number; locked?: boolean }) {
    if (!actorUserId) return setMessage('Nejdřív se přihlaš.');
    const { error } = await api.PATCH('/itinerary/days/{dayId}', {
      params: { path: { dayId } },
      body,
    });
    if (error) return setMessage('Den itineráře se nepodařilo upravit.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function createPoll(input: { question: string; options: string[]; multiChoice?: boolean; contextDayId?: string; contextPlaceId?: string }) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch('/polls', {
        method: 'POST',
        body: JSON.stringify({
          tripId: selectedTrip.id,
          question: input.question,
          multiChoice: input.multiChoice ?? false,
          contextDayId: input.contextDayId,
          contextPlaceId: input.contextPlaceId,
          options: input.options.filter(Boolean).map((title) => ({ title })),
        }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Anketu se nepodařilo vytvořit.');
    }
  }

  async function votePollOption(optionId: string) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/polls/options/${encodeURIComponent(optionId)}/vote`, {
        method: 'POST',
        body: JSON.stringify({}),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Hlas v anketě se nepodařilo uložit.');
    }
  }

  async function unvotePollOption(optionId: string) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/polls/options/${encodeURIComponent(optionId)}/vote`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Hlas v anketě se nepodařilo odebrat.');
    }
  }

  async function updatePoll(pollId: string, input: { question?: string; status?: 'OPEN' | 'CLOSED'; multiChoice?: boolean; closesAt?: string | null }) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/polls/${encodeURIComponent(pollId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Anketu se nepodařilo upravit.');
    }
  }

  async function deletePoll(pollId: string) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/polls/${encodeURIComponent(pollId)}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Anketu se nepodařilo smazat.');
    }
  }

  async function createChecklistItem(input: { title: string; note?: string | null; scope?: 'PERSONAL' | 'SHARED' | 'EVERYONE'; dueAt?: string | null; assignedUserIds?: string[] }) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch('/checklist', {
        method: 'POST',
        body: JSON.stringify({ tripId: selectedTrip.id, ...input, note: input.note ?? undefined, dueAt: input.dueAt ?? undefined }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Úkol se nepodařilo vytvořit.');
    }
  }

  async function updateChecklistItem(itemId: string, input: { title?: string; note?: string | null; scope?: 'PERSONAL' | 'SHARED' | 'EVERYONE'; dueAt?: string | null; assignedUserIds?: string[] }) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/checklist/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Úkol se nepodařilo upravit.');
    }
  }

  async function deleteChecklistItem(itemId: string) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/checklist/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Úkol se nepodařilo smazat.');
    }
  }

  async function completeChecklistItem(itemId: string, completed: boolean) {
    if (!actorUserId || !accessToken) return setMessage('Nejdřív se přihlaš.');
    try {
      await apiFetch(`/checklist/${encodeURIComponent(itemId)}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Checklist se nepodařilo uložit.');
    }
  }

  async function searchLocations(query: string) {
    if (!accessToken) return [] as LocationResult[];
    const result = await apiFetch<{ results: LocationResult[] }>(`/locations/search?q=${encodeURIComponent(query)}&limit=6`, {}, accessToken);
    return result.results;
  }

  async function discoverPlaces(input: { latitude: number; longitude: number; category: DiscoveryPlace['category']; radiusMeters?: number }) {
    if (!accessToken) return setMessage('Nejdřív se přihlaš.');
    setDiscovering(true);
    try {
      const result = await apiFetch<{ results: DiscoveryPlace[] }>(
        `/locations/discover?latitude=${encodeURIComponent(input.latitude)}&longitude=${encodeURIComponent(input.longitude)}&category=${encodeURIComponent(input.category)}&radiusMeters=${input.radiusMeters ?? 2500}&limit=25`,
        {},
        accessToken,
      );
      setDiscoveries(result.results);
      setMessage(result.results.length ? null : 'V okolí jsem nic nenašel.');
    } catch {
      setMessage('Objevování okolí selhalo.');
    } finally {
      setDiscovering(false);
    }
  }

  async function discoverNearbyCurrentLocation(category: DiscoveryPlace['category'] = 'SIGHTS') {
    if (!navigator.geolocation) return setMessage('Prohlížeč neumí sdílet polohu.');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void discoverPlaces({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          category,
          radiusMeters: 1800,
        });
      },
      () => setMessage('Polohu se nepodařilo zjistit.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function shareLiveLocation() {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    if (!navigator.geolocation) return setMessage('Prohlížeč neumí sdílet polohu.');
    if (liveLocationWatchRef.current !== null) return setMessage('Poloha už se sdílí.');
    setSharingLiveLocation(true);
    liveLocationWatchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await apiFetch(`/locations/live/trip/${encodeURIComponent(selectedTrip.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters: Math.round(position.coords.accuracy || 0),
              sharedMinutes: 240,
            }),
          }, accessToken);
          await loadTripDetail(undefined, undefined, undefined, { force: true });
          setMessage(null);
        } catch {
          setMessage('Polohu se nepodařilo sdílet.');
        }
      },
      () => {
        setSharingLiveLocation(false);
        if (liveLocationWatchRef.current !== null) {
          navigator.geolocation.clearWatch(liveLocationWatchRef.current);
          liveLocationWatchRef.current = null;
        }
        setMessage('Polohu se nepodařilo zjistit.');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
    );
  }

  async function stopSharingLiveLocation() {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    try {
      await apiFetch(`/locations/live/trip/${encodeURIComponent(selectedTrip.id)}`, { method: 'DELETE' }, accessToken);
      if (liveLocationWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(liveLocationWatchRef.current);
        liveLocationWatchRef.current = null;
      }
      setSharingLiveLocation(false);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setMessage('Sdílení polohy se nepodařilo vypnout.');
    }
  }

  async function generateTripInsights() {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber trip a uživatele.');
    if (generatingInsights) return;
    setGeneratingInsights(true);
    try {
      const result = await apiFetch<TripAiInsights>(`/ai/trip/${encodeURIComponent(selectedTrip.id)}/insights`, {
        method: 'POST',
      }, accessToken);
      setData((current) => ({ ...current, aiInsights: result }));
      setMessage(null);
    } catch {
      setMessage('AI plánovač se nepodařilo spustit. Zkontroluj OPENAI_API_KEY.');
    } finally {
      setGeneratingInsights(false);
    }
  }

  async function saveDiscoveryPlace(discovery: DiscoveryPlace) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const type: PlaceType = discovery.category === 'FOOD'
      ? 'FOOD'
      : discovery.category === 'ACTIVITY'
        ? 'ACTIVITY'
        : discovery.category === 'TRANSPORT'
          ? 'TRANSPORT'
          : 'PLACE';
    const weatherSuitability = discovery.category === 'FOOD' ? 'MIXED' : 'OUTDOOR';
    const { data: created, error } = await api.POST('/places', {
      body: {
        tripId: selectedTrip.id,
        type,
        name: discovery.name,
        latitude: discovery.latitude,
        longitude: discovery.longitude,
        description: discovery.type,
        sourceUrl: discovery.sourceUrl,
        weatherSuitability,
      },
    });
    if (error) return setMessage('Místo se nepodařilo uložit.');
    setDiscoveries((current) => current.filter((item) => item.externalId !== discovery.externalId));
    await loadTripDetail(undefined, undefined, undefined, { force: true });
    setSelectedPlaceId((created as Place).id);
    return created as Place;
  }

  async function deleteAvailability(availabilityId: string) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.DELETE('/members/availability/{availabilityId}', {
      params: { path: { availabilityId } },
      body: {},
    });
    if (error) return setMessage('Dostupnost se nepodařilo smazat.');
    setMessage(null);
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function optimizeRoute() {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const placeIds = data.places.slice(0, 8).map((place) => place.id);
    if (placeIds.length < 2) return setMessage('Pro optimalizaci trasy přidej aspoň dvě místa.');
    const { error } = await api.POST('/routes/optimize', {
      body: {
        tripId: selectedTrip.id,
        name: 'Návrh nejlepší trasy',
        mode: 'DRIVE',
        startsAt: selectedTrip.startsAt ?? undefined,
        endsAt: selectedTrip.endsAt ?? undefined,
        placeIds,
        participantUserIds: (selectedTrip.members ?? []).map((member) => member.userId),
      },
    });
    if (error) return setMessage('Trasu se nepodařilo optimalizovat.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  return {
    state: { trips, joinedTrips, availableTrips, selectedTrip, selectedTripId, viewerEmail, viewerName, actorUserId, actorMember, activeTab, data, selectedPlace, selectedPlaceId, selectedExpense, selectedExpenseId, accommodations, selectedAccommodation, selectedAccommodationId, discoveries, discovering, loading, searchingStay, sharingLiveLocation, generatingInsights, message },
    actions: { setSelectedTripId, setActorUserId, setActiveTab: setRoutedTab, tripHref, setSelectedPlaceId, setSelectedExpenseId, setSelectedAccommodationId, loadTrips, signIn, signOut, openTrip, joinTrip, joinTripByInviteCode, createTrip, updateTrip, deleteTrip, addPlace, updatePlace, deletePlace, addPlaceToItinerary, voteForPlace, updateAccommodationStatus, voteForPlaceOnDay, commentOnPlace, reorderStops, updateItineraryStop, updateStopAttendance, deleteItineraryStop, addExpense, updateExpense, deleteExpense, updateSettlementStatus, searchStays, saveAccommodation, addAvailability, updateAvailability, deleteAvailability, updateTripMemberRole, updateMemberPlanning, syncItineraryDays, updateItineraryDay, createPoll, updatePoll, deletePoll, votePollOption, unvotePollOption, createChecklistItem, updateChecklistItem, deleteChecklistItem, completeChecklistItem, searchLocations, discoverPlaces, discoverNearbyCurrentLocation, shareLiveLocation, stopSharingLiveLocation, generateTripInsights, saveDiscoveryPlace, optimizeRoute },
  };
}

export type TripPlannerController = ReturnType<typeof useTripPlanner>;
