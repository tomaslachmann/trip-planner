'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, clearAccessToken, createTripPlannerClient, getSessionUser, readAccessToken, signInRequest, signOutRequest, writeAccessToken } from '@/lib/api';
import type { Accommodation, ActivityEvent, ChecklistItem, DiscoveryPlace, Expense, ItineraryDay, LiveLocation, LocationResult, Place, PlaceType, Poll, RouteCapabilities, TabKey, Trip, TripAiInsights, TripAiPlanDraft, TripAiSuggestions, TripData, TripWeather } from '../types';

const emptyData: TripData = { places: [], itinerary: [], expenses: [], routes: [], routeCapabilities: null, settlements: [], polls: [], checklist: [], activity: [], liveLocations: [], weather: null, aiInsights: null, aiSuggestions: null, aiPlanDraft: null };
const routeTabs: TabKey[] = ['map', 'plan', 'places', 'stay', 'costs', 'settle', 'members', 'more', 'checklist', 'polls', 'itinerary', 'settings'];

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

function normalizeExpenseCurrency(value?: string | null) {
  return value === 'EUR' ? 'EUR' : 'CZK';
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Receipt file could not be read'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Receipt file could not be read')));
    reader.readAsDataURL(file);
  });
}

type PlannerRoute = {
  routeTripId?: string;
  routeView?: TabKey;
  redirectAfterSignIn?: boolean;
};

type AiMapFocus = { latitude: number; longitude: number; radiusMeters?: number; label?: string };

async function optionalFetch<T>(label: string, request: Promise<T>, errors: string[]) {
  try {
    return await request;
  } catch {
    errors.push(label);
    return null;
  }
}

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
  const [accommodationSearchDone, setAccommodationSearchDone] = useState(false);
  const [discoveries, setDiscoveries] = useState<DiscoveryPlace[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchingStay, setSearchingStay] = useState(false);
  const [sharingLiveLocation, setSharingLiveLocation] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
  const [generatingPlanDraft, setGeneratingPlanDraft] = useState(false);
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

  function patchPlace(placeId: string, patch: Partial<Place>) {
    setData((current) => ({
      ...current,
      places: current.places.map((place) => place.id === placeId ? { ...place, ...patch } : place),
    }));
  }

  function patchPlaceVote(placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') {
    if (!actorUserId) return;
    setData((current) => ({
      ...current,
      places: current.places.map((place) => {
        if (place.id !== placeId) return place;
        const votes = place.votes ?? [];
        const existing = votes.findIndex((vote) => vote.userId === actorUserId);
        const nextVote = { userId: actorUserId, value };
        return {
          ...place,
          votes: existing >= 0
            ? votes.map((vote, index) => index === existing ? { ...vote, value } : vote)
            : [...votes, nextVote],
        };
      }),
    }));
  }

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
      const optionalErrors: string[] = [];
      const [tripDetail, places, itinerary, expenses, routes, settlements, routeCapabilities, polls, checklist, activity, liveLocations, weather] = await Promise.all([
        client.GET('/trips/{id}', { params: { path: { id: trip.id } } }),
        client.GET('/places/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/itinerary/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/expenses/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/routes/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        client.GET('/settlements/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
        optionalFetch('možnosti tras', apiFetch<RouteCapabilities>('/routes/capabilities', {}, token), optionalErrors),
        optionalFetch('hlasování', apiFetch<Poll[]>(`/polls/trip/${encodeURIComponent(trip.id)}`, {}, token), optionalErrors),
        optionalFetch('seznam úkolů', apiFetch<ChecklistItem[]>(`/checklist/trip/${encodeURIComponent(trip.id)}`, {}, token), optionalErrors),
        optionalFetch('aktivita', apiFetch<ActivityEvent[]>(`/activity/trip/${encodeURIComponent(trip.id)}`, {}, token), optionalErrors),
        optionalFetch('sdílená poloha', apiFetch<LiveLocation[]>(`/locations/live/trip/${encodeURIComponent(trip.id)}`, {}, token), optionalErrors),
        optionalFetch('počasí', apiFetch<TripWeather>(`/weather/trip/${encodeURIComponent(trip.id)}`, {}, token), optionalErrors),
      ]);
      if (tripDetail.error || places.error || itinerary.error || expenses.error || routes.error || settlements.error) {
        setMessage('Nepodařilo se načíst hlavní data výletu.');
        return;
      }
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
        routeCapabilities,
        settlements: (settlements.data as TripData['settlements'] | undefined) ?? [],
        polls: polls ? uniqueById(polls) : current.polls,
        checklist: checklist ? uniqueById(checklist) : current.checklist,
        activity: activity ? uniqueById(activity) : current.activity,
        liveLocations: liveLocations ? uniqueById(liveLocations) : current.liveLocations,
        weather: weather ?? current.weather,
        aiInsights: current.aiInsights ?? null,
      }));
      if (optionalErrors.length > 0) setMessage(`Část dat se nepodařilo načíst: ${optionalErrors.join(', ')}.`);
      else setMessage(null);
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
    if (!trip) return setMessage('Výlet z URL neexistuje.');
    const member = trip.members?.find((item) => item.userId === actorUserId);
    if (!member) {
      setActorUserId('');
      return setMessage('K tomuhle výletu nemáš přístup. Připoj se nebo změň účet.');
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
    if (!member) return setMessage('Nejdřív se k tomuhle výletu připoj.');
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
    if (error) return setMessage('Nepodařilo se připojit k výletu.');
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
    if (error) return setMessage('Nepodařilo se připojit k výletu.');
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const { error } = await api.PATCH('/trips/{id}', {
      params: { path: { id: selectedTrip.id } },
      body: { ...data, currency: data.currency ? normalizeExpenseCurrency(data.currency) : undefined },
    });
    if (error) return setMessage('Výlet se nepodařilo aktualizovat.');
    const nextTrips = await loadTrips(accessToken);
    const nextTrip = nextTrips.find((trip) => trip.id === selectedTrip.id) ?? selectedTrip;
    await loadTripDetail(nextTrip, actorUserId, accessToken, { force: true });
  }

  async function deleteTrip() {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const { error } = await api.DELETE('/trips/{id}', {
      params: { path: { id: selectedTrip.id } },
      body: {},
    });
    if (error) return setMessage('Výlet se nepodařilo smazat.');
    setSelectedTripId('');
    setData(emptyData);
    await loadTrips(accessToken);
    router.push('/trips', { scroll: false });
  }

  async function createTrip(formData: FormData) {
    if (!accessToken || !viewerEmail) return setMessage('Nejdřív se přihlaš.');
    const name = String(formData.get('name') ?? '').trim();
    const destination = String(formData.get('destination') ?? '').trim();
    const currency = normalizeExpenseCurrency(String(formData.get('currency') ?? 'CZK').trim());
    const ownerName = viewerName || viewerEmail.split('@')[0] || 'Cestovatel';
    if (!name) return setMessage('Název výletu je povinný.');
    const { data: created, error } = await api.POST('/trips', {
      body: { name, destination: destination || undefined, currency, owner: { name: ownerName, email: viewerEmail } },
    });
    if (error) return setMessage('Výlet se nepodařilo vytvořit.');
    const trip = created as Trip;
    setSelectedTripId(trip.id);
    setData(emptyData);
    await loadTrips(accessToken);
    router.push(tripHref('map', trip.id), { scroll: false });
  }

  async function addPlace(formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const name = String(formData.get('placeName') ?? '').trim();
    const type = String(formData.get('placeType') ?? 'PLACE') as PlaceType;
    const description = String(formData.get('notes') ?? '').trim();
    const durationText = String(formData.get('durationMin') ?? formData.get('duration') ?? '').trim();
    const priceText = String(formData.get('estimatedCost') ?? formData.get('price') ?? '').trim();
    const sourceUrl = String(formData.get('sourceUrl') ?? '').trim();
    const imageUrl = String(formData.get('imageUrl') ?? '').trim();
    const locationLabel = String(formData.get('locationLabel') ?? '').trim();
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
        locationLabel: locationLabel || undefined,
        description: description || undefined,
        durationMin: durationMin && Number.isFinite(durationMin) ? durationMin : undefined,
        estimatedCost: estimatedCost !== undefined && Number.isFinite(estimatedCost) ? estimatedCost : undefined,
        sourceUrl: sourceUrl || undefined,
        imageUrl: imageUrl || undefined,
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
    const imageUrl = String(formData.get('imageUrl') ?? '').trim();
    const locationLabel = String(formData.get('locationLabel') ?? '').trim();
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
        locationLabel: locationLabel || null,
        durationMin: durationMin !== undefined && Number.isFinite(durationMin) ? durationMin : null,
        estimatedCost: estimatedCost !== undefined && Number.isFinite(estimatedCost) ? estimatedCost : null,
        sourceUrl: sourceUrl || null,
        imageUrl: imageUrl || null,
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
    if (!selectedTrip || !actorUserId) throw new Error('Chybí výlet nebo uživatel');
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    setRoutedTab('itinerary');
  }

  async function voteForPlace(placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const previousData = data;
    patchPlaceVote(placeId, value);
    const { error } = await api.POST('/places/{id}/votes', {
      params: { path: { id: placeId } },
      body: { value },
    });
    if (error) {
      setData(previousData);
      return setMessage('Hlas se nepodařilo uložit.');
    }
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function updateAccommodationStatus(placeId: string, status: 'SAVED' | 'SHORTLISTED' | 'SELECTED' | 'BOOKED' | 'REJECTED') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    const previousData = data;
    patchPlace(placeId, { accommodationStatus: status });
    try {
      await apiFetch<Place>(`/places/${encodeURIComponent(placeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ accommodationStatus: status }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setData(previousData);
      setMessage('Stav ubytování se nepodařilo uložit.');
    }
  }

  async function updatePlaceStatus(placeId: string, status: 'PROPOSED' | 'SHORTLISTED' | 'APPROVED' | 'REJECTED') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    const previousData = data;
    patchPlace(placeId, { status });
    try {
      await apiFetch<Place>(`/places/${encodeURIComponent(placeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, accessToken);
      await loadTripDetail(undefined, undefined, undefined, { force: true });
    } catch {
      setData(previousData);
      setMessage('Stav místa se nepodařilo uložit.');
    }
  }

  async function voteForPlaceOnDay(dayId: string, placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
	    const title = String(formData.get('expenseTitle') ?? '').trim();
	    const category = String(formData.get('category') ?? 'OTHER').trim() || 'OTHER';
	    const amount = Number(formData.get('amount') || 0);
    const currency = normalizeExpenseCurrency(String(formData.get('currency') ?? selectedTrip.currency).trim());
	    const originalAmount = Number(formData.get('originalAmount') || 0);
    const originalCurrency = normalizeExpenseCurrency(String(formData.get('originalCurrency') ?? (currency === 'CZK' ? 'EUR' : 'CZK')).trim());
	    const exchangeRate = Number(formData.get('exchangeRate') || 0);
	    const spentAtDate = String(formData.get('spentAtDate') ?? '').trim();
    let receiptUrl = String(formData.get('receiptUrl') ?? '').trim();
	    const paidById = String(formData.get('paidById') ?? actorUserId).trim() || actorUserId;
    const splitScope = String(formData.get('splitScope') ?? 'all');
    const splitUserIds = formData.getAll('splitUserIds').map(String).filter(Boolean);
    if (!title || amount <= 0) return setMessage('Název nákladu a částka jsou povinné.');
    if (splitScope === 'selected' && splitUserIds.length === 0) return setMessage('Vyber aspoň jednoho účastníka splitu.');
    try {
      receiptUrl = await uploadReceiptFromForm(formData, selectedTrip.id, receiptUrl);
    } catch {
      return setMessage('Účtenku se nepodařilo nahrát.');
    }
    const { error } = await api.POST('/expenses', {
      body: {
        tripId: selectedTrip.id,
	        paidById,
	        title,
	        category,
	        amount,
        currency,
        originalAmount: originalAmount > 0 ? originalAmount : undefined,
        originalCurrency: originalAmount > 0 ? originalCurrency : undefined,
	        exchangeRate: exchangeRate > 0 ? exchangeRate : undefined,
	        spentAt: spentAtDate ? toApiDateTime(spentAtDate) : undefined,
	        receiptUrl: receiptUrl || undefined,
	        splitType: 'EQUAL',
        splitAllTripMembers: splitScope === 'all',
        splitUserIds: splitScope === 'selected' ? splitUserIds : undefined,
      },
    });
    if (error) return setMessage('Náklad se nepodařilo přidat.');
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  function expensePayloadFromForm(formData: FormData) {
	    const title = String(formData.get('expenseTitle') ?? '').trim();
	    const category = String(formData.get('category') ?? 'OTHER').trim() || 'OTHER';
	    const amount = Number(formData.get('amount') || 0);
    const currency = normalizeExpenseCurrency(String(formData.get('currency') ?? selectedTrip?.currency).trim());
    const originalAmount = Number(formData.get('originalAmount') || 0);
    const originalCurrency = normalizeExpenseCurrency(String(formData.get('originalCurrency') ?? (currency === 'CZK' ? 'EUR' : 'CZK')).trim());
	    const exchangeRate = Number(formData.get('exchangeRate') || 0);
	    const spentAtDate = String(formData.get('spentAtDate') ?? '').trim();
	    const receiptUrl = String(formData.get('receiptUrl') ?? '').trim();
	    const paidById = String(formData.get('paidById') ?? actorUserId).trim() || actorUserId;
    const splitScope = String(formData.get('splitScope') ?? 'all');
    const splitUserIds = formData.getAll('splitUserIds').map(String).filter(Boolean);
	    return { title, category, amount, currency, originalAmount, originalCurrency, exchangeRate, spentAtDate, receiptUrl, paidById, splitScope, splitUserIds };
  }

  async function uploadReceiptFromForm(formData: FormData, tripId: string, fallbackUrl: string) {
    const receiptFile = formData.get('receiptFile');
    if (!(receiptFile instanceof File) || receiptFile.size === 0) return fallbackUrl;
    const uploaded = await apiFetch<{ url: string }>('/uploads/receipts', {
      method: 'POST',
      body: JSON.stringify({
        tripId,
        fileName: receiptFile.name,
        contentType: receiptFile.type || undefined,
        dataUrl: await readFileAsDataUrl(receiptFile),
      }),
    }, accessToken);
    return uploaded.url;
  }

  async function updateExpense(expenseId: string, formData: FormData) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    const payload = expensePayloadFromForm(formData);
    if (!payload.title || payload.amount <= 0) return setMessage('Název nákladu a částka jsou povinné.');
    if (payload.splitScope === 'selected' && payload.splitUserIds.length === 0) return setMessage('Vyber aspoň jednoho účastníka splitu.');
    let receiptUrl = payload.receiptUrl;
    try {
      receiptUrl = await uploadReceiptFromForm(formData, selectedTrip.id, receiptUrl);
    } catch {
      return setMessage('Účtenku se nepodařilo nahrát.');
    }
    try {
      await apiFetch<Expense>(`/expenses/${encodeURIComponent(expenseId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
	          paidById: payload.paidById,
	          title: payload.title,
	          category: payload.category,
	          amount: payload.amount,
          currency: payload.currency,
          originalAmount: payload.originalAmount > 0 ? payload.originalAmount : null,
	          originalCurrency: payload.originalAmount > 0 ? payload.originalCurrency : null,
	          exchangeRate: payload.exchangeRate > 0 ? payload.exchangeRate : null,
	          spentAt: payload.spentAtDate ? toApiDateTime(payload.spentAtDate) : null,
	          receiptUrl: receiptUrl || null,
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    setSearchingStay(true);
    const destination = String(formData?.get('stayDestination') ?? formData?.get('locationLabel') ?? selectedTrip.destination ?? selectedTrip.name).trim();
    const pickedLatitude = Number(formData?.get('latitude') || NaN);
    const pickedLongitude = Number(formData?.get('longitude') || NaN);
    const pickedCenter = Number.isFinite(pickedLatitude) && Number.isFinite(pickedLongitude)
      ? { latitude: pickedLatitude, longitude: pickedLongitude }
      : undefined;
    const center = centerOverride ?? pickedCenter ?? data.places[0];
    const minPrice = Number(formData?.get('minPrice') || NaN);
    const maxPrice = Number(formData?.get('maxPrice') || NaN);
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
        minPrice: Number.isFinite(minPrice) && minPrice >= 0 ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
        limit: 18,
      },
    });
    setSearchingStay(false);
    if (error) return setMessage('Vyhledání ubytování selhalo.');
    const next = ((result as { results?: Accommodation[] } | undefined)?.results ?? []);
    setAccommodations(next);
    setAccommodationSearchDone(true);
    setSelectedAccommodationId(next[0]?.externalId ?? '');
  }

  async function saveAccommodation(stay: Accommodation) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
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
        photoUrl: stay.photoUrl,
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    try {
      await apiFetch(`/members/${encodeURIComponent(memberId)}/planning`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }, accessToken);
      const nextTrips = await loadTrips(accessToken);
      const nextTrip = nextTrips.find((trip) => trip.id === selectedTrip.id) ?? selectedTrip;
      await loadTripDetail(nextTrip, actorUserId, accessToken, { force: true });
    } catch {
      setMessage('Rozpočtový profil se nepodařilo uložit.');
    }
  }

  async function syncItineraryDays() {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
      setMessage('Seznam úkolů se nepodařilo uložit.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
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
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    if (generatingInsights) return;
    setGeneratingInsights(true);
    try {
      const result = await apiFetch<TripAiInsights>(`/ai/trip/${encodeURIComponent(selectedTrip.id)}/insights`, {
        method: 'POST',
        body: JSON.stringify({}),
      }, accessToken);
      setData((current) => ({ ...current, aiInsights: result }));
      setMessage(null);
    } catch {
      setMessage('AI plánovač se nepodařilo spustit. Zkontroluj OPENAI_API_KEY.');
    } finally {
      setGeneratingInsights(false);
    }
  }

  async function generateTripSuggestions(focus?: AiMapFocus) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    if (generatingSuggestions) return;
    setGeneratingSuggestions(true);
    try {
      const result = await apiFetch<TripAiSuggestions>(`/ai/trip/${encodeURIComponent(selectedTrip.id)}/suggestions`, {
        method: 'POST',
        body: JSON.stringify(focus ? { focus } : {}),
      }, accessToken);
      setData((current) => ({ ...current, aiSuggestions: result }));
      setMessage(null);
    } catch {
      setMessage('AI návrhy míst se nepodařilo spustit.');
    } finally {
      setGeneratingSuggestions(false);
    }
  }

  async function generateTripPlanDraft(focus?: AiMapFocus) {
    if (!selectedTrip || !actorUserId || !accessToken) return setMessage('Nejdřív vyber výlet a uživatele.');
    if (generatingPlanDraft) return;
    setGeneratingPlanDraft(true);
    try {
      const result = await apiFetch<TripAiPlanDraft>(`/ai/trip/${encodeURIComponent(selectedTrip.id)}/plan-draft`, {
        method: 'POST',
        body: JSON.stringify(focus ? { focus } : {}),
      }, accessToken);
      setData((current) => ({ ...current, aiPlanDraft: result, aiSuggestions: current.aiSuggestions ?? { provider: result.provider, generatedAt: result.generatedAt, model: result.model, summary: 'Kandidáti z draftu plánu.', candidates: result.candidates } }));
      setMessage(null);
    } catch {
      setMessage('AI draft plánu se nepodařilo spustit.');
    } finally {
      setGeneratingPlanDraft(false);
    }
  }

  async function saveDiscoveryPlace(discovery: DiscoveryPlace) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const type: PlaceType = discovery.category === 'FOOD'
      ? 'FOOD'
      : discovery.category === 'ACTIVITY'
        ? 'ACTIVITY'
        : discovery.category === 'TRANSPORT'
          ? 'TRANSPORT'
          : discovery.category === 'OUTDOOR'
          ? 'DAY_TRIP'
            : 'PLACE';
    const weatherSuitability = discovery.category === 'FOOD' ? 'MIXED' : 'OUTDOOR';
    let locationLabel = discovery.name;
    if (accessToken) {
      try {
        const reverse = await apiFetch<LocationResult>(
          `/locations/reverse?latitude=${encodeURIComponent(discovery.latitude)}&longitude=${encodeURIComponent(discovery.longitude)}`,
          {},
          accessToken,
        );
        locationLabel = reverse.label || locationLabel;
      } catch {
        locationLabel = discovery.name;
      }
    }
    const { data: created, error } = await api.POST('/places', {
      body: {
        tripId: selectedTrip.id,
        type,
        name: discovery.name,
        latitude: discovery.latitude,
        longitude: discovery.longitude,
        locationLabel,
        description: discovery.description ?? discovery.type,
        sourceUrl: discovery.wikipediaUrl ?? discovery.sourceUrl,
        imageUrl: discovery.imageUrl,
        weatherSuitability,
      },
    });
    if (error) return setMessage('Místo se nepodařilo uložit.');
    const createdPlace = created as Place;
    const routePlaceIds = Array.from(new Set([...data.places.map((place) => place.id), createdPlace.id])).slice(0, 8);
    await createOptimizedRouteForPlaces(routePlaceIds, {
      messageOnError: 'Místo je uložené, ale trasu se nepodařilo přepočítat.',
    });
    setDiscoveries((current) => current.filter((item) => item.externalId !== discovery.externalId));
    await loadTripDetail(undefined, undefined, undefined, { force: true });
    setSelectedPlaceId(createdPlace.id);
    return createdPlace;
  }

  async function deleteAvailability(availabilityId: string) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const { error } = await api.DELETE('/members/availability/{availabilityId}', {
      params: { path: { availabilityId } },
      body: {},
    });
    if (error) return setMessage('Dostupnost se nepodařilo smazat.');
    setMessage(null);
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  async function createOptimizedRouteForPlaces(placeIds: string[], options: { startsAt?: string; endsAt?: string; messageOnError?: string } = {}) {
    if (!selectedTrip) return false;
    const uniquePlaceIds = Array.from(new Set(placeIds)).slice(0, 8);
    if (uniquePlaceIds.length < 2) return true;
    const { error } = await api.POST('/routes/optimize', {
      body: {
        tripId: selectedTrip.id,
        name: 'Návrh nejlepší trasy',
        mode: 'DRIVE',
        startsAt: options.startsAt,
        endsAt: options.endsAt,
        placeIds: uniquePlaceIds,
      },
    });
    if (error) {
      if (options.messageOnError) setMessage(options.messageOnError);
      return false;
    }
    return true;
  }

  async function optimizeRoute() {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber výlet a uživatele.');
    const plannedStops = data.itinerary
      .flatMap((day) => (day.stops ?? []).map((stop) => ({ day, stop })))
      .filter(({ stop }) => stop.placeId);
    const uniquePlannedPlaceIds = Array.from(new Set(plannedStops.map(({ stop }) => stop.placeId).filter((placeId): placeId is string => Boolean(placeId))));
    const placeIds = (uniquePlannedPlaceIds.length >= 2 ? uniquePlannedPlaceIds : data.places.map((place) => place.id)).slice(0, 8);
    if (placeIds.length < 2) return setMessage('Pro optimalizaci trasy přidej aspoň dvě místa.');
    const timedStops = plannedStops.filter(({ stop }) => placeIds.includes(stop.placeId ?? '') && stop.startsAt && stop.endsAt);
    const routeStartsAt = timedStops.length ? timedStops.map(({ stop }) => stop.startsAt as string).sort()[0] : undefined;
    const routeEndsAt = timedStops.length ? timedStops.map(({ stop }) => stop.endsAt as string).sort().at(-1) : undefined;
    const created = await createOptimizedRouteForPlaces(placeIds, {
      startsAt: routeStartsAt,
      endsAt: routeEndsAt,
      messageOnError: 'Trasu se nepodařilo optimalizovat.',
    });
    if (!created) return;
    await loadTripDetail(undefined, undefined, undefined, { force: true });
  }

  return {
    state: { trips, joinedTrips, availableTrips, selectedTrip, selectedTripId, viewerEmail, viewerName, actorUserId, actorMember, activeTab, data, selectedPlace, selectedPlaceId, selectedExpense, selectedExpenseId, accommodations, selectedAccommodation, selectedAccommodationId, accommodationSearchDone, discoveries, discovering, loading, searchingStay, sharingLiveLocation, generatingInsights, generatingSuggestions, generatingPlanDraft, message },
    actions: { setSelectedTripId, setActorUserId, setActiveTab: setRoutedTab, tripHref, setSelectedPlaceId, setSelectedExpenseId, setSelectedAccommodationId, loadTrips, signIn, signOut, openTrip, joinTrip, joinTripByInviteCode, createTrip, updateTrip, deleteTrip, addPlace, updatePlace, deletePlace, addPlaceToItinerary, voteForPlace, updatePlaceStatus, updateAccommodationStatus, voteForPlaceOnDay, commentOnPlace, reorderStops, updateItineraryStop, updateStopAttendance, deleteItineraryStop, addExpense, updateExpense, deleteExpense, updateSettlementStatus, searchStays, saveAccommodation, addAvailability, updateAvailability, deleteAvailability, updateTripMemberRole, updateMemberPlanning, syncItineraryDays, updateItineraryDay, createPoll, updatePoll, deletePoll, votePollOption, unvotePollOption, createChecklistItem, updateChecklistItem, deleteChecklistItem, completeChecklistItem, searchLocations, discoverPlaces, discoverNearbyCurrentLocation, shareLiveLocation, stopSharingLiveLocation, generateTripInsights, generateTripSuggestions, generateTripPlanDraft, saveDiscoveryPlace, optimizeRoute },
  };
}

export type TripPlannerController = ReturnType<typeof useTripPlanner>;
