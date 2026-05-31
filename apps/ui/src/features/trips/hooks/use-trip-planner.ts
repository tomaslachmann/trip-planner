'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAccessToken, createTripPlannerClient, getSessionUser, readAccessToken, signInRequest, signOutRequest, writeAccessToken } from '@/lib/api';
import type { Accommodation, ItineraryDay, Place, TabKey, Trip, TripData } from '../types';

const emptyData: TripData = { places: [], itinerary: [], expenses: [], routes: [], settlements: [] };
const routeTabs: TabKey[] = ['map', 'plan', 'stay', 'costs', 'settle', 'members', 'more'];

type PlannerRoute = {
  routeTripId?: string;
  routeView?: TabKey;
};

export function useTripPlanner({ routeTripId, routeView }: PlannerRoute = {}) {
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
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchingStay, setSearchingStay] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedTrip = useMemo(() => trips.find((trip) => trip.id === selectedTripId), [selectedTripId, trips]);
  const joinedTrips = trips;
  const selectedPlace = useMemo(() => data.places.find((place) => place.id === selectedPlaceId) ?? data.places[0], [data.places, selectedPlaceId]);
  const selectedAccommodation = useMemo(() => accommodations.find((stay) => stay.externalId === selectedAccommodationId) ?? accommodations[0], [accommodations, selectedAccommodationId]);
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
      return;
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
      return;
    }
    const nextTrips = (joined.data as Trip[] | undefined) ?? [];
    setTrips(nextTrips);
    setAvailableTrips((available.data as Trip[] | undefined) ?? []);
    setLoading(false);
  }

  async function loadTripDetail(trip = selectedTrip, actor = actorUserId, token = accessToken) {
    if (!trip || !actor || !token) return;
    const client = createTripPlannerClient(token);
    const [tripDetail, places, itinerary, expenses, routes, settlements] = await Promise.all([
      client.GET('/trips/{id}', { params: { path: { id: trip.id } } }),
      client.GET('/places/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
      client.GET('/itinerary/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
      client.GET('/expenses/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
      client.GET('/routes/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
      client.GET('/settlements/trip/{tripId}', { params: { path: { tripId: trip.id } } }),
    ]);
    if (tripDetail.data) {
      const detailedTrip = tripDetail.data as Trip;
      setTrips((current) => current.map((item) => item.id === detailedTrip.id ? detailedTrip : item));
    }
    setData({
      places: (places.data as Place[] | undefined) ?? [],
      itinerary: (itinerary.data as ItineraryDay[] | undefined) ?? [],
      expenses: (expenses.data as TripData['expenses'] | undefined) ?? [],
      routes: (routes.data as TripData['routes'] | undefined) ?? [],
      settlements: (settlements.data as TripData['settlements'] | undefined) ?? [],
    });
    setSelectedPlaceId((current) => current || ((places.data as Place[] | undefined) ?? [])[0]?.id || '');
  }

  useEffect(() => {
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
  }, [selectedTripId, actorUserId, accessToken]);

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
      if (!routeTripId) router.push('/trips', { scroll: false });
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
    setAccommodations([]);
    setSelectedAccommodationId('');
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
    await loadTripDetail(trip, member.userId, accessToken);
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
    if ((member as { userId?: string } | undefined)?.userId) await loadTripDetail(trip, (member as { userId: string }).userId, accessToken);
  }

  async function createTrip(formData: FormData) {
    if (!accessToken || !viewerEmail) return setMessage('Nejdřív se přihlaš.');
    const name = String(formData.get('name') ?? '').trim();
    const destination = String(formData.get('destination') ?? '').trim();
    const ownerName = viewerName || viewerEmail.split('@')[0] || 'Cestovatel';
    if (!name) return setMessage('Název tripu je povinný.');
    const { data: created, error } = await api.POST('/trips', {
      body: { name, destination: destination || undefined, currency: 'EUR', owner: { name: ownerName, email: viewerEmail } },
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
    const type = String(formData.get('placeType') ?? 'PLACE') as 'PLACE';
    const latitude = Number(formData.get('latitude') || 41.4036);
    const longitude = Number(formData.get('longitude') || 2.1744);
    if (!name) return setMessage('Název místa je povinný.');
    const { error } = await api.POST('/places', {
      body: { tripId: selectedTrip.id, createdById: actorUserId, type, name, latitude, longitude },
    });
    if (error) return setMessage('Místo se nepodařilo přidat.');
    await loadTripDetail();
  }

  async function createDefaultItineraryDay() {
    if (!selectedTrip || !actorUserId) throw new Error('Chybí trip nebo uživatel');
    const { data: day, error } = await api.POST('/itinerary/days', {
      body: { tripId: selectedTrip.id, actorUserId, date: selectedTrip.startsAt ?? new Date().toISOString(), title: 'Den 1' },
    });
    if (error) throw new Error('Nepodařilo se vytvořit den itineráře');
    return day as ItineraryDay;
  }

  async function addPlaceToItinerary(placeId: string, dayId?: string) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const day = dayId ? data.itinerary.find((item) => item.id === dayId) : data.itinerary[0] ?? await createDefaultItineraryDay();
    if (!day) return setMessage('Nejdřív vytvoř den itineráře.');
    const { error } = await api.POST('/itinerary/days/{dayId}/stops', {
      params: { path: { dayId: day.id } },
      body: { actorUserId, placeId, order: day.stops?.length ?? 0 },
    });
    if (error) return setMessage('Místo se nepodařilo přidat do itineráře.');
    await loadTripDetail();
    setRoutedTab('plan');
  }

  async function voteForPlace(placeId: string, value: 'UP' | 'DOWN' | 'MAYBE' | 'MUST_HAVE') {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.POST('/places/{id}/votes', {
      params: { path: { id: placeId } },
      body: { actorUserId, userId: actorUserId, value },
    });
    if (error) return setMessage('Hlas se nepodařilo uložit.');
    await loadTripDetail();
  }

  async function commentOnPlace(placeId: string, body: string) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const text = body.trim();
    if (!text) return setMessage('Komentář nesmí být prázdný.');
    const { error } = await api.POST('/places/{id}/comments', {
      params: { path: { id: placeId } },
      body: { actorUserId, userId: actorUserId, body: text },
    });
    if (error) return setMessage('Komentář se nepodařilo uložit.');
    await loadTripDetail();
  }

  async function reorderStops(dayId: string, stopIds: string[]) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.PATCH('/itinerary/days/{dayId}/stops/reorder', {
      params: { path: { dayId } },
      body: { actorUserId, stopIds },
    });
    if (error) return setMessage('Pořadí itineráře se nepodařilo uložit.');
    await loadTripDetail();
  }

  async function addExpense(formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const title = String(formData.get('expenseTitle') ?? '').trim();
    const amount = Number(formData.get('amount') || 0);
    const splitScope = String(formData.get('splitScope') ?? 'all');
    const splitUserIds = formData.getAll('splitUserIds').map(String).filter(Boolean);
    if (!title || amount <= 0) return setMessage('Název nákladu a částka jsou povinné.');
    const { error } = await api.POST('/expenses', {
      body: {
        tripId: selectedTrip.id,
        paidById: actorUserId,
        title,
        amount,
        currency: selectedTrip.currency,
        splitType: 'EQUAL',
        splitAllTripMembers: splitScope === 'all',
        splitUserIds: splitScope === 'selected' ? splitUserIds : undefined,
      },
    });
    if (error) return setMessage('Náklad se nepodařilo přidat.');
    await loadTripDetail();
  }

  async function searchStays(formData?: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    setSearchingStay(true);
    const destination = String(formData?.get('stayDestination') ?? selectedTrip.destination ?? selectedTrip.name).trim();
    const center = data.places[0];
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
    setRoutedTab('map');
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
    await loadTripDetail();
  }

  function toApiDateTime(value: string) {
    return new Date(value).toISOString();
  }

  async function addAvailability(tripMemberId: string, formData: FormData) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const startsAt = String(formData.get('startsAt') ?? '').trim();
    const endsAt = String(formData.get('endsAt') ?? '').trim();
    const note = String(formData.get('note') ?? '').trim();
    if (!startsAt || !endsAt) return setMessage('Vyplň začátek i konec dostupnosti.');
    const { error } = await api.POST('/members/{tripMemberId}/availability', {
      params: { path: { tripMemberId } },
      body: { actorUserId, startsAt: toApiDateTime(startsAt), endsAt: toApiDateTime(endsAt), note: note || undefined },
    });
    if (error) return setMessage('Dostupnost se nepodařilo uložit.');
    setMessage(null);
    await loadTripDetail();
  }

  async function deleteAvailability(availabilityId: string) {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const { error } = await api.DELETE('/members/availability/{availabilityId}', {
      params: { path: { availabilityId } },
      body: { actorUserId },
    });
    if (error) return setMessage('Dostupnost se nepodařilo smazat.');
    setMessage(null);
    await loadTripDetail();
  }

  async function optimizeRoute() {
    if (!selectedTrip || !actorUserId) return setMessage('Nejdřív vyber trip a uživatele.');
    const placeIds = data.places.slice(0, 8).map((place) => place.id);
    if (placeIds.length < 2) return setMessage('Pro optimalizaci trasy přidej aspoň dvě místa.');
    const { error } = await api.POST('/routes/optimize', {
      body: { tripId: selectedTrip.id, name: 'Návrh nejlepší trasy', mode: 'DRIVE', placeIds },
    });
    if (error) return setMessage('Trasu se nepodařilo optimalizovat.');
    await loadTripDetail();
  }

  return {
    state: { trips, joinedTrips, availableTrips, selectedTrip, selectedTripId, viewerEmail, viewerName, actorUserId, actorMember, activeTab, data, selectedPlace, selectedPlaceId, accommodations, selectedAccommodation, selectedAccommodationId, loading, searchingStay, message },
    actions: { setSelectedTripId, setActorUserId, setActiveTab: setRoutedTab, tripHref, setSelectedPlaceId, setSelectedAccommodationId, loadTrips, signIn, signOut, openTrip, joinTrip, createTrip, addPlace, addPlaceToItinerary, voteForPlace, commentOnPlace, reorderStops, addExpense, searchStays, saveAccommodation, addAvailability, deleteAvailability, optimizeRoute },
  };
}

export type TripPlannerController = ReturnType<typeof useTripPlanner>;
