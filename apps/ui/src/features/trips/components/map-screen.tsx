import { ArrowUpDown, Banknote, BedDouble, Bookmark, CalendarDays, Check, ChevronRight, Clock, ExternalLink, LocateFixed, MapPin, MessageCircle, Radio, Search, Star, ThumbsDown, ThumbsUp, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { DockedSheet, dockSnapHeights, type DockSnap } from '@/components/ui/docked-sheet';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { AvatarRow } from './avatar';
import { CategoryBadge } from './category';
import { AccommodationPhoto, AccommodationRatingBadge, accommodationPriceLabel, accommodationTypeLabel } from './accommodation-display';
import { AiInsightsPanel } from './ai-insights-panel';
import { AccommodationDetailPanel } from './accommodation-detail-panel';
import { MapCanvas } from './map-canvas';
import { PlaceCommentCard } from './place-comment-card';
import { PlaceDetailPanel } from './place-detail-panel';
import { PlaceImage } from './place-image';
import { PlaceRow } from './place-row';
import { PlaceScoreBadge } from './place-score-badge';
import { StatusActionButton } from './status-action-button';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { bookingDetailUrl } from '../lib/booking-links';
import { normalizePlaceStatus, placeStatusMeta } from '../lib/decision';
import { externalMapUrl } from '../lib/map-links';
import { canManageTrip } from '../lib/permissions';
import type { AiSuggestionCandidate, DiscoveryPlace, ItineraryDay, LocationResult, Place, WikipediaPlaceSummary } from '../types';

const filters = [
  { key: 'ALL', label: 'Vše' },
  { key: 'PLACE', label: 'Památky' },
  { key: 'FOOD', label: 'Jídlo' },
  { key: 'ACTIVITY', label: 'Aktivity' },
  { key: 'DAY_TRIP', label: 'Výlety' },
  { key: 'ACCOMMODATION', label: 'Ubytování' },
];

const discoveryCategoryLabels: Record<DiscoveryPlace['category'], string> = {
  SIGHTS: 'Památky',
  FOOD: 'Jídlo',
  ACTIVITY: 'Aktivity',
  TRANSPORT: 'Doprava',
  OUTDOOR: 'Hory a příroda',
};

const discoveryCategoryClasses: Record<DiscoveryPlace['category'], string> = {
  SIGHTS: 'see',
  FOOD: 'food',
  ACTIVITY: 'act',
  TRANSPORT: 'trans',
  OUTDOOR: 'day',
};

const discoveryTypeLabels: Record<string, string> = {
  attraction: 'Zajímavost',
  museum: 'Muzeum',
  gallery: 'Galerie',
  viewpoint: 'Vyhlídka',
  artwork: 'Umění',
  zoo: 'Zoo',
  theme_park: 'Zábavní park',
  restaurant: 'Restaurace',
  cafe: 'Kavárna',
  bar: 'Bar',
  pub: 'Hospoda',
  fast_food: 'Rychlé občerstvení',
  biergarten: 'Biergarten',
  food_court: 'Jídelní zóna',
  park: 'Park',
  sports_centre: 'Sportoviště',
  swimming_pool: 'Bazén',
  playground: 'Hřiště',
  stadium: 'Stadion',
  bus_station: 'Autobusové nádraží',
  ferry_terminal: 'Přívoz',
  taxi: 'Taxi',
  peak: 'Vrchol',
  saddle: 'Sedlo',
  cliff: 'Skála',
  ridge: 'Hřeben',
  valley: 'Údolí',
  cave_entrance: 'Jeskyně',
  waterfall: 'Vodopád',
  alpine_hut: 'Horská chata',
  wilderness_hut: 'Turistická útulna',
  picnic_site: 'Piknikové místo',
  camp_site: 'Kemp',
  nature_reserve: 'Přírodní rezervace',
};

function discoveryCategoryLabel(category: DiscoveryPlace['category']) {
  return discoveryCategoryLabels[category] ?? category;
}

function discoveryCategoryClass(category: DiscoveryPlace['category']) {
  return discoveryCategoryClasses[category] ?? 'see';
}

function discoveryTypeLabel(type?: string) {
  if (!type) return 'Objevené místo';
  return discoveryTypeLabels[type] ?? type.replaceAll('_', ' ');
}

function DiscoveryDetailCard({
  discovery,
  summary,
  loading,
  compact = false,
  onSave,
  onClose,
}: {
  discovery: DiscoveryPlace;
  summary?: WikipediaPlaceSummary | null;
  loading: boolean;
  compact?: boolean;
  onSave: () => void;
  onClose?: () => void;
}) {
  const imageUrl = summary?.imageUrl ?? discovery.imageUrl;
  const description = summary?.extract ?? discovery.description;
  const pageUrl = summary?.pageUrl ?? discovery.wikipediaUrl;
  const mapUrl = externalMapUrl(discovery);

  return (
    <Card className={compact ? 'p-[12px] shadow-[var(--sh-sm)]' : 'p-[14px] shadow-[var(--sh-md)]'}>
      <div className="row between mb10">
        <div className="row g6 wrap">
          <span className={`badge cat-${discoveryCategoryClass(discovery.category)}`}>{discoveryCategoryLabel(discovery.category)}</span>
          <span className="badge muted">{discoveryTypeLabel(discovery.type)}</span>
          {summary && <span className="badge muted">Wikipedie</span>}
        </div>
        {onClose && <Button size="icon" variant="ghost" type="button" onClick={onClose}><X /></Button>}
      </div>
      <div className="row g12" style={{ alignItems: 'flex-start' }}>
        {imageUrl ? (
          <img
            alt={discovery.name}
            src={imageUrl}
            style={{ width: compact ? 72 : 112, height: compact ? 72 : 92, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }}
          />
        ) : (
          <div className="receipt center h-full flex justify-center align-center" style={{ width: compact ? 72 : 112, height: compact ? 72 : 92, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }}>
            <MapPin className="faint" />
          </div>
        )}
        <div className="col flex1" style={{ minWidth: 0 }}>
          <span className={compact ? 't-h2' : 't-title'}>{discovery.name}</span>
          <span className="muted t-sm mt4">{summary?.description ?? discoveryTypeLabel(discovery.type)}</span>
          {loading ? (
            <span className="muted t-sm mt10">Dohledávám popis z Wikipedie...</span>
          ) : description ? (
            <p className="t-body mt10" style={{ color: '#3f3f46' }}>{description}</p>
          ) : (
            <p className="muted t-sm mt10">K tomuhle místu jsem na Wikipedii nenašel spolehlivý popis. Můžeš ho uložit z OpenStreetMap a doplnit poznámky ručně.</p>
          )}
        </div>
      </div>
      <div className="row g8 mt12 wrap">
        <Button size="sm" type="button" onClick={onSave}>Uložit místo</Button>
        {mapUrl && (
          <Button size="sm" variant="outline" type="button" asChild>
            <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
          </Button>
        )}
        {pageUrl && (
          <Button size="sm" variant="outline" type="button" asChild>
            <a href={pageUrl} target="_blank" rel="noreferrer"><ExternalLink />Wikipedie</a>
          </Button>
        )}
        {discovery.websiteUrl && (
          <Button size="sm" variant="outline" type="button" asChild>
            <a href={discovery.websiteUrl} target="_blank" rel="noreferrer"><ExternalLink />Web</a>
          </Button>
        )}
        {discovery.sourceUrl && (
          <Button size="sm" variant="ghost" type="button" asChild>
            <a href={discovery.sourceUrl} target="_blank" rel="noreferrer">OpenStreetMap</a>
          </Button>
        )}
      </div>
    </Card>
  );
}

function votes(place: Place) {
  const values = place.votes ?? [];
  return {
    must: values.filter((vote) => vote.value === 'MUST_HAVE').length,
    up: values.filter((vote) => vote.value === 'UP').length,
    maybe: values.filter((vote) => vote.value === 'MAYBE').length,
    down: values.filter((vote) => vote.value === 'DOWN').length,
  };
}

function averageLocation(locations: Array<{ latitude: number; longitude: number }>) {
  if (!locations.length) return null;
  return {
    latitude: locations.reduce((sum, item) => sum + item.latitude, 0) / locations.length,
    longitude: locations.reduce((sum, item) => sum + item.longitude, 0) / locations.length,
  };
}

function mapDayLabel(day: ItineraryDay, index: number) {
  const date = new Date(day.date);
  const dateLabel = Number.isNaN(date.getTime())
    ? `Den ${index + 1}`
    : date.toLocaleDateString('cs-CZ', { weekday: 'short', day: 'numeric', month: 'numeric' });
  const title = day.title?.trim();
  const normalizedTitle = title && (!/^den\s+\D/i.test(title) || /^den\s+\d+$/i.test(title)) ? title : `Den ${index + 1}`;
  return `${normalizedTitle} · ${dateLabel}`;
}

function itineraryDayPlaceIds(day: ItineraryDay) {
  const ids = new Set<string>();
  if (day.basePlaceId) ids.add(day.basePlaceId);
  for (const stop of day.stops ?? []) {
    if (stop.placeId) ids.add(stop.placeId);
    if (stop.place?.id) ids.add(stop.place.id);
  }
  return ids;
}

function placeWeatherLabel(planner: TripPlannerController) {
  const place = planner.state.selectedPlace;
  if (!place) return null;
  const forecast = (planner.state.data.weather?.days ?? []).find((item) => item.pointId === place.id);
  if (!forecast) return null;
  const temp = forecast.temperatureMax !== null && forecast.temperatureMin !== null && forecast.temperatureMax !== undefined && forecast.temperatureMin !== undefined
    ? `${Math.round(forecast.temperatureMin)}-${Math.round(forecast.temperatureMax)} °C`
    : 'Počasí';
  return `${temp} · déšť ${forecast.precipitationProbabilityMax ?? 0}%`;
}

function discoveryCategoryForContext(filter: string): DiscoveryPlace['category'] {
  if (filter === 'FOOD') return 'FOOD';
  if (filter === 'DAY_TRIP') return 'OUTDOOR';
  if (filter === 'ACTIVITY') return 'ACTIVITY';
  if (filter === 'TRANSPORT') return 'TRANSPORT';
  return 'SIGHTS';
}

function candidateCategory(candidate: AiSuggestionCandidate): DiscoveryPlace['category'] {
  if (candidate.type === 'FOOD') return 'FOOD';
  if (candidate.type === 'ACTIVITY') return 'ACTIVITY';
  if (candidate.type === 'TRANSPORT') return 'TRANSPORT';
  if (candidate.type === 'DAY_TRIP') return 'OUTDOOR';
  return 'SIGHTS';
}

function candidateTypeLabel(type: AiSuggestionCandidate['type']) {
  const labels: Record<AiSuggestionCandidate['type'], string> = {
    PLACE: 'Místo',
    FOOD: 'Jídlo',
    ACTIVITY: 'Aktivita',
    DAY_TRIP: 'Výlet',
    TRANSPORT: 'Doprava',
    CUSTOM: 'Vlastní',
  };
  return labels[type];
}

function candidateToDiscovery(candidate: AiSuggestionCandidate): DiscoveryPlace | null {
  const latitude = candidate.verification.latitude;
  const longitude = candidate.verification.longitude;
  if (latitude === null || longitude === null) return null;
  return {
    provider: 'overpass',
    externalId: candidate.verification.externalId ?? candidate.id,
    category: candidateCategory(candidate),
    name: candidate.name,
    latitude,
    longitude,
    type: candidate.type.toLowerCase(),
    description: candidate.verification.description ?? candidate.reason,
    websiteUrl: undefined,
    wikipediaTitle: candidate.verification.title ?? undefined,
    wikipediaUrl: candidate.verification.wikipediaUrl ?? undefined,
    imageUrl: candidate.verification.imageUrl ?? undefined,
    sourceUrl: candidate.verification.sourceUrl ?? undefined,
  };
}

function locationToDiscovery(location: LocationResult, category: DiscoveryPlace['category']): DiscoveryPlace {
  return {
    provider: 'overpass',
    externalId: location.externalId,
    category,
    name: location.label.split(',')[0]?.trim() || location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    type: location.type ?? 'search',
    description: location.label,
  };
}

function AiCandidateDetailCard({
  candidate,
  compact = false,
  onSave,
  onClose,
}: {
  candidate: AiSuggestionCandidate;
  compact?: boolean;
  onSave: () => void;
  onClose?: () => void;
}) {
  const hasPoint = candidate.verification.latitude !== null && candidate.verification.longitude !== null;
  const mapUrl = hasPoint
    ? `https://www.openstreetmap.org/?mlat=${candidate.verification.latitude}&mlon=${candidate.verification.longitude}#map=16/${candidate.verification.latitude}/${candidate.verification.longitude}`
    : null;
  const statusClass = candidate.verification.status === 'VERIFIED' ? 'green' : candidate.verification.status === 'PARTIAL' ? 'amber' : 'muted';
  const statusLabel = candidate.verification.status === 'VERIFIED' ? 'Ověřeno' : candidate.verification.status === 'PARTIAL' ? 'Částečně ověřeno' : 'Neověřeno';

  return (
    <Card className={compact ? 'p-[12px] shadow-[var(--sh-sm)]' : 'p-[14px] shadow-[var(--sh-md)]'}>
      <div className="row between mb10">
        <div className="row g6 wrap">
          <span className="badge muted">AI návrh</span>
          <span className={`badge ${statusClass}`}>{statusLabel}</span>
          <span className={`badge cat-${discoveryCategoryClass(candidateCategory(candidate))}`}>{candidateTypeLabel(candidate.type)}</span>
        </div>
        {onClose && <Button size="icon" variant="ghost" type="button" onClick={onClose}><X /></Button>}
      </div>
      <div className="row g12" style={{ alignItems: 'flex-start' }}>
        {candidate.verification.imageUrl ? (
          <img
            alt={candidate.name}
            src={candidate.verification.imageUrl}
            style={{ width: compact ? 72 : 112, height: compact ? 72 : 92, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }}
          />
        ) : (
          <div className="receipt center flex justify-center align-center" style={{ width: compact ? 72 : 112, height: compact ? 72 : 92, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }}>
            <MapPin className="faint" />
          </div>
        )}
        <div className="col flex1" style={{ minWidth: 0 }}>
          <span className={compact ? 't-h2' : 't-title'}>{candidate.name}</span>
          <span className="muted t-sm mt4">{candidate.reason}</span>
          <div className="row g6 mt8 wrap">
            <span className="badge muted">{candidate.weatherSuitability === 'OUTDOOR' ? 'Venku' : candidate.weatherSuitability === 'INDOOR' ? 'Uvnitř' : 'Mix počasí'}</span>
            {candidate.estimatedDurationMin !== null && <span className="badge muted"><Clock />{candidate.estimatedDurationMin} min</span>}
            <span className="badge muted">{Math.round(candidate.confidence * 100)} % jistota</span>
          </div>
          <span className="muted t-xs mt8">{candidate.verification.description ?? candidate.searchQuery}</span>
          {hasPoint && (
            <span className="muted t-xs mt4">{candidate.verification.provider ?? 'source'} · {candidate.verification.latitude?.toFixed(4)}, {candidate.verification.longitude?.toFixed(4)}</span>
          )}
        </div>
      </div>
      <div className="row g8 mt12 wrap">
        <Button size="sm" type="button" onClick={onSave} disabled={!hasPoint}>Přidat místo</Button>
        {mapUrl && (
          <Button size="sm" variant="outline" type="button" asChild>
            <a href={mapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
          </Button>
        )}
        {candidate.verification.wikipediaUrl && (
          <Button size="sm" variant="outline" type="button" asChild>
            <a href={candidate.verification.wikipediaUrl} target="_blank" rel="noreferrer"><ExternalLink />Wikipedie</a>
          </Button>
        )}
        {candidate.verification.sourceUrl && (
          <Button size="sm" variant="ghost" type="button" asChild>
            <a href={candidate.verification.sourceUrl} target="_blank" rel="noreferrer">OpenStreetMap</a>
          </Button>
        )}
      </div>
    </Card>
  );
}

export function MapScreen({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  const [filter, setFilter] = useState('ALL');
  const [snap, setSnap] = useState<DockSnap>('half');
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryPlace | null>(null);
  const [selectedAiCandidate, setSelectedAiCandidate] = useState<AiSuggestionCandidate | null>(null);
  const [discoveryDetails, setDiscoveryDetails] = useState<Record<string, WikipediaPlaceSummary | null>>({});
  const [loadingDiscoveryDetailId, setLoadingDiscoveryDetailId] = useState('');
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number; zoom: number } | null>(null);
  const [mapSearchResults, setMapSearchResults] = useState<LocationResult[]>([]);
  const [mapSearchLoading, setMapSearchLoading] = useState(false);
  const [mapSearchFocus, setMapSearchFocus] = useState<{ latitude: number; longitude: number; zoom?: number; key: string | number } | null>(null);
  const [mapSearchArea, setMapSearchArea] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [mapDayId, setMapDayId] = useState('all');
  const showStays = filter === 'ACCOMMODATION';
  const selectedMapDay = mapDayId === 'all' ? undefined : state.data.itinerary.find((day) => day.id === mapDayId);
  const dayScopedPlaces = useMemo(() => {
    if (!selectedMapDay) return state.data.places;
    const ids = itineraryDayPlaceIds(selectedMapDay);
    return state.data.places.filter((place) => ids.has(place.id));
  }, [selectedMapDay, state.data.places]);
  const dayFilterOptions = useMemo(() => [
    { value: 'all', label: 'Celý trip' },
    ...state.data.itinerary.map((day, index) => ({ value: day.id, label: mapDayLabel(day, index) })),
  ], [state.data.itinerary]);
  const filteredPlaces = useMemo(() => {
    return dayScopedPlaces.filter((place) => {
      const matchesFilter = filter === 'ALL' || place.type === filter || (filter === 'PLACE' && place.type === 'CUSTOM');
      return matchesFilter;
    });
  }, [dayScopedPlaces, filter]);
  const localMapSearchMatches = useMemo(() => {
    const query = mapSearch.trim().toLowerCase();
    if (showStays || query.length < 2) return [];
    return dayScopedPlaces
      .filter((place) => (
        place.name.toLowerCase().includes(query)
        || (place.description ?? '').toLowerCase().includes(query)
        || (place.locationLabel ?? '').toLowerCase().includes(query)
      ))
      .slice(0, 5);
  }, [dayScopedPlaces, mapSearch, showStays]);
  const aiMapCandidates = useMemo(() => {
    if (showStays) return [];
    return (state.data.aiPlanDraft?.candidates ?? state.data.aiSuggestions?.candidates ?? [])
      .filter((candidate) => candidate.verification.latitude !== null && candidate.verification.longitude !== null);
  }, [showStays, state.data.aiPlanDraft?.candidates, state.data.aiSuggestions?.candidates]);
  const visibleDiscoveries = useMemo(() => {
    if (showStays) return [];
    if (!selectedDiscovery) return state.discoveries;
    if (state.discoveries.some((item) => item.externalId === selectedDiscovery.externalId)) return state.discoveries;
    return [...state.discoveries, selectedDiscovery];
  }, [selectedDiscovery, showStays, state.discoveries]);
  const searchCenter = mapCenter ?? state.selectedPlace ?? dayScopedPlaces[0] ?? state.data.places[0];
  const showMapSearchResults = !showStays && mapSearch.trim().length >= 2;

  useEffect(() => {
    const query = mapSearch.trim();
    if (showStays || query.length < 2) {
      setMapSearchResults([]);
      setMapSearchLoading(false);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setMapSearchLoading(true);
      actions.searchLocations(query, {
        latitude: searchCenter?.latitude,
        longitude: searchCenter?.longitude,
        fallbackText: state.selectedTrip?.destination,
      })
        .then((items) => {
          if (!cancelled) setMapSearchResults(items);
        })
        .catch(() => {
          if (!cancelled) setMapSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setMapSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [mapSearch, searchCenter?.latitude, searchCenter?.longitude, showStays, state.selectedTrip?.destination]);

  function selectPlace(placeId: string) {
    actions.setSelectedPlaceId(placeId);
    actions.setSelectedAccommodationId('');
    setSelectedDiscovery(null);
    setSelectedAiCandidate(null);
    setSnap('peek');
    setDetailOpen(false);
    setCommentText('');
  }

  function selectStay(stayId: string) {
    actions.setSelectedAccommodationId(stayId);
    actions.setSelectedPlaceId('');
    setSelectedDiscovery(null);
    setSelectedAiCandidate(null);
    setSnap('peek');
  }

  async function loadDiscoveryDetail(discovery: DiscoveryPlace) {
    if (discoveryDetails[discovery.externalId] !== undefined || loadingDiscoveryDetailId === discovery.externalId) return;
    setLoadingDiscoveryDetailId(discovery.externalId);
    try {
      const result = await apiFetch<{ result: WikipediaPlaceSummary | null }>(
        `/locations/wikipedia-summary?name=${encodeURIComponent(discovery.wikipediaTitle ?? discovery.name)}&latitude=${encodeURIComponent(discovery.latitude)}&longitude=${encodeURIComponent(discovery.longitude)}&language=cs&radiusMeters=1400`,
      );
      setDiscoveryDetails((current) => ({ ...current, [discovery.externalId]: result.result }));
      if (result.result) {
        setSelectedDiscovery((current) => current?.externalId === discovery.externalId
          ? {
              ...current,
              description: result.result?.extract ?? current.description,
              imageUrl: result.result?.imageUrl ?? current.imageUrl,
              wikipediaTitle: result.result?.title ?? current.wikipediaTitle,
              wikipediaUrl: result.result?.pageUrl ?? current.wikipediaUrl,
            }
          : current);
      }
    } catch {
      setDiscoveryDetails((current) => ({ ...current, [discovery.externalId]: null }));
    } finally {
      setLoadingDiscoveryDetailId((current) => current === discovery.externalId ? '' : current);
    }
  }

  function selectDiscovery(discovery: DiscoveryPlace) {
    setSelectedDiscovery(discovery);
    setSelectedAiCandidate(null);
    actions.setSelectedPlaceId('');
    actions.setSelectedAccommodationId('');
    setSnap('half');
    void loadDiscoveryDetail(discovery);
  }

  function selectAiCandidate(candidate: AiSuggestionCandidate) {
    setSelectedAiCandidate(candidate);
    setSelectedDiscovery(null);
    actions.setSelectedPlaceId('');
    actions.setSelectedAccommodationId('');
    setSnap('half');
    setDetailOpen(false);
  }

  function focusMapLocation(point: { latitude: number; longitude: number }, zoom = 14) {
    const next = {
      latitude: point.latitude,
      longitude: point.longitude,
      zoom,
      key: `${Date.now()}:${point.latitude}:${point.longitude}:${zoom}`,
    };
    setMapSearchFocus(next);
    setMapCenter({ latitude: point.latitude, longitude: point.longitude, zoom });
  }

  function selectMapSearchPlace(place: Place) {
    setMapSearch(place.name);
    setMapSearchResults([]);
    setMapSearchArea(null);
    focusMapLocation(place, 15);
    selectPlace(place.id);
  }

  function selectMapSearchLocation(location: LocationResult) {
    const discovery = locationToDiscovery(location, activeDiscoveryCategory);
    setMapSearch(location.label);
    setMapSearchResults([]);
    setMapSearchArea({ latitude: location.latitude, longitude: location.longitude, label: location.label });
    focusMapLocation(location, 14);
    actions.setSelectedPlaceId('');
    actions.setSelectedAccommodationId('');
    setSelectedDiscovery(discovery);
    setSelectedAiCandidate(null);
    void loadDiscoveryDetail(discovery);
    setSnap('half');
    setDetailOpen(false);
  }

  function clearMapSearch() {
    setMapSearch('');
    setMapSearchResults([]);
    setMapSearchArea(null);
  }

  function saveAiCandidate(candidate: AiSuggestionCandidate) {
    const discovery = candidateToDiscovery(candidate);
    if (!discovery) return;
    void actions.saveDiscoveryPlace(discovery).then(() => setSelectedAiCandidate(null));
  }

  function clearAiMapDrafts() {
    setSelectedAiCandidate(null);
    actions.clearTripAiDrafts();
  }

  function setMapFilter(next: string) {
    setFilter(next);
    setSnap('half');
    if (next === 'ACCOMMODATION') {
      actions.setSelectedPlaceId('');
      if (state.accommodations.length === 0) void actions.searchStays();
      return;
    }
    actions.setSelectedAccommodationId('');
  }

  function discoverAroundMap() {
    const center = mapSearchArea ?? mapCenter ?? state.selectedPlace ?? dayScopedPlaces[0] ?? state.data.places[0];
    if (!center) {
      return;
    }
    void actions.discoverPlaces({
      latitude: center.latitude,
      longitude: center.longitude,
      category: activeDiscoveryCategory,
      radiusMeters: activeDiscoveryCategory === 'ACTIVITY' ? 1800 : activeDiscoveryCategory === 'OUTDOOR' ? 10000 : 3000,
    });
  }

  function aiMapFocus() {
    const center = mapSearchArea ?? mapCenter ?? state.selectedPlace ?? dayScopedPlaces[0] ?? state.data.places[0];
    if (!center) return undefined;
    const radiusMeters = mapCenter?.zoom
      ? Math.max(1800, Math.min(20000, Math.round(60000 / Math.max(1, mapCenter.zoom - 7))))
      : selectedMapDay
        ? 6000
        : 9000;
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMeters,
      label: mapSearchArea ? `Mapa: ${mapSearchArea.label}` : selectedMapDay ? `Mapa: ${selectedMapDay.title || selectedMapDay.date}` : 'Aktuální oblast mapy',
    };
  }

  const placeList = filteredPlaces;
  const selectedVotes = state.selectedPlace ? votes(state.selectedPlace) : null;
  const myVote = state.selectedPlace?.votes?.find((vote) => vote.userId === state.actorUserId)?.value;
  const hasCommentDraft = commentText.trim().length > 0;
  const selectedPlaceVoters = new Set((state.selectedPlace?.votes ?? []).map((vote) => vote.userId));
  const selectedPlaceMissingVoters = (state.selectedTrip?.members ?? []).filter((member) => !selectedPlaceVoters.has(member.userId));
  const selectedAccommodationPlace = state.selectedAccommodation
    ? state.data.places.find((place) => place.type === 'ACCOMMODATION' && place.accommodationExternalId === state.selectedAccommodation?.externalId)
    : undefined;
  const selectedAccommodationVote = selectedAccommodationPlace?.votes?.find((vote) => vote.userId === state.actorUserId)?.value;
  const selectedAccommodationStatus = String(selectedAccommodationPlace?.accommodationStatus ?? '').toUpperCase();
  const selectedAccommodationMapUrl = externalMapUrl(state.selectedAccommodation);
  const selectedAccommodationBookingUrl = state.selectedAccommodation ? bookingDetailUrl(state.selectedAccommodation, state.selectedTrip) : undefined;
  const selectedPlaceMapUrl = externalMapUrl(state.selectedPlace);
  const selectedDiscoveryDetail = selectedDiscovery ? discoveryDetails[selectedDiscovery.externalId] : undefined;
  const selectedDiscoveryLoading = selectedDiscovery ? loadingDiscoveryDetailId === selectedDiscovery.externalId : false;
  const selectedWeather = placeWeatherLabel(planner);
  const selectedStatus = normalizePlaceStatus(state.selectedPlace?.status);
  const selectedStatusMeta = placeStatusMeta[selectedStatus];
  const activeDiscoveryCategory = discoveryCategoryForContext(filter);
  const discoverButtonLabel = selectedMapDay ? 'Objevit u dne' : 'Objevit v mapě';
  const canManagePlanning = canManageTrip(state.actorMember?.role);
  const canChangeSelectedStatus = state.selectedPlace ? canManagePlanning : false;
  const desktopAside = showStays ? (
    state.selectedAccommodation ? (
      <AccommodationDetailPanel planner={planner} />
    ) : (
      <div className="scroll px18" style={{ flex: 1, paddingTop: 14, paddingBottom: 18 }}>
        <div className="row between mb10">
          <span className="t-h2">Ubytování v mapě</span>
          <span className="badge muted">{state.accommodations.length}</span>
        </div>
        <Button className="w-full mb12" type="button" onClick={() => void actions.searchStays(undefined, mapCenter ?? undefined)} disabled={state.searchingStay}>
          <ArrowUpDown />{state.searchingStay ? 'Hledám' : 'Hledat v této oblasti'}
        </Button>
        <div className="col">
          {state.accommodations.length === 0 && (
            <Card className="p-[14px]">
              <div className="center muted t-sm">Vyber oblast na mapě a spusť hledání ubytování.</div>
            </Card>
          )}
          {state.accommodations.map((stay, index) => (
            <div key={stay.externalId}>
              {index > 0 && <hr className="sep" />}
              <button className="map-list-row" type="button" onClick={() => selectStay(stay.externalId)}>
                <AccommodationPhoto stay={stay} />
                <div className="col flex1" style={{ minWidth: 0 }}>
                  <span className="t-h3 ellipsis">{stay.name}</span>
                  <span className="muted t-xs mt4 row g6 wrap">
                    {accommodationTypeLabel(stay)}
                    <span className="dotsep" />
                    <AccommodationRatingBadge compact reviewScore={stay.reviewScore} rating={stay.rating} reviewCount={stay.reviewCount} />
                  </span>
                  <span className="t-h3 tnum mt4">{accommodationPriceLabel(stay)}</span>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  ) : selectedDiscovery ? (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 14, paddingBottom: 18 }}>
      <DiscoveryDetailCard
        discovery={selectedDiscovery}
        summary={selectedDiscoveryDetail}
        loading={selectedDiscoveryLoading}
        onSave={() => void actions.saveDiscoveryPlace(selectedDiscovery).then(() => setSelectedDiscovery(null))}
        onClose={() => setSelectedDiscovery(null)}
      />
    </div>
  ) : selectedAiCandidate ? (
    <div className="scroll px18" style={{ flex: 1, paddingTop: 14, paddingBottom: 18 }}>
      <AiCandidateDetailCard
        candidate={selectedAiCandidate}
        onSave={() => saveAiCandidate(selectedAiCandidate)}
        onClose={() => setSelectedAiCandidate(null)}
      />
    </div>
  ) : state.selectedPlace ? (
    <PlaceDetailPanel planner={planner} compact />
  ) : (
    <div className="desktop-map-side-scroll p14">
      <Card className="p-[12px] shadow-[var(--sh-sm)]">
        <div className="row between mb8">
          <span className="t-h3">AI návrhy</span>
          <div className="row g6">
            <span className="badge muted">{aiMapCandidates.length}</span>
            {(state.data.aiSuggestions || state.data.aiPlanDraft) && (
              <Button size="icon" variant="ghost" type="button" title="Skrýt AI návrhy" onClick={clearAiMapDrafts}><X /></Button>
            )}
          </div>
        </div>
        {aiMapCandidates.length > 0 ? (
          <div className="col">
            {aiMapCandidates.slice(0, 5).map((candidate, index) => (
              <div key={candidate.id}>
                {index > 0 && <hr className="sep" />}
                <button
                  className="row pressable w-full text-left"
                  type="button"
                  style={{ padding: '9px 0' }}
                  onClick={() => selectAiCandidate(candidate)}
                >
                  <div className="col flex1" style={{ minWidth: 0 }}>
                    <span className="t-sm semib ellipsis">{candidate.name}</span>
                    <span className="muted t-xs mt2">{candidateTypeLabel(candidate.type)} · {candidate.verification.status === 'VERIFIED' ? 'ověřeno' : 'částečně ověřeno'}</span>
                  </div>
                  <span className="badge muted">Detail</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="muted t-sm mt4">Zatím tu nejsou AI návrhy s ověřenou pozicí na mapě.</p>
            <div className="row g8 mt10 wrap">
              <Button size="sm" type="button" onClick={() => void actions.generateTripSuggestions(aiMapFocus())} disabled={state.generatingSuggestions}>
                <Search />{state.generatingSuggestions ? 'Hledám' : 'Navrhnout místa'}
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={() => void actions.generateTripPlanDraft(aiMapFocus())} disabled={state.generatingPlanDraft}>
                <CalendarDays />{state.generatingPlanDraft ? 'Skládám' : 'Navrhnout plán'}
              </Button>
            </div>
          </>
        )}
      </Card>
      <Card className="p-[12px] shadow-[var(--sh-sm)]">
        <div className="row between mb10">
          <span className="t-h3">{selectedMapDay ? 'Místa v dni' : 'Místa na mapě'}</span>
          <span className="badge muted">{placeList.length}</span>
        </div>
        <div className="col g10">
          {placeList.length === 0 && (
            <div className="center muted t-sm" style={{ padding: '12px 0' }}>
              Žádná místa neodpovídají filtru.
            </div>
          )}
          {placeList.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              selected={state.selectedPlaceId === place.id}
              onSelect={() => selectPlace(place.id)}
              onAdd={canManagePlanning ? () => void actions.addPlaceToItinerary(place.id) : undefined}
              onMore={() => {
                actions.setSelectedPlaceId(place.id);
                setDetailOpen(true);
              }}
            />
          ))}
        </div>
      </Card>
    </div>
  );

  return (
    <div className={desktop ? 'desk-body' : 'screen'}>
      <div className={desktop ? 'desktop-map-host' : 'map-mobile-host'}>
        <MapCanvas
        places={placeList}
        accommodations={state.accommodations}
        discoveries={visibleDiscoveries}
        aiCandidates={aiMapCandidates}
        liveLocations={state.data.liveLocations}
        routes={state.data.routes}
        selectedPlaceId={state.selectedPlaceId}
        selectedAccommodationId={state.selectedAccommodationId}
        selectedAiCandidateId={selectedAiCandidate?.id}
        onPlaceSelect={selectPlace}
        onAccommodationSelect={selectStay}
        onDiscoverySelect={selectDiscovery}
        onAiCandidateSelect={selectAiCandidate}
        onViewportChange={setMapCenter}
        showStays={showStays}
        fitKey={showStays ? `stays:${filter}` : `places:${mapDayId}:${filter}:ai:${aiMapCandidates.map((candidate) => candidate.id).join(',')}`}
        focusLocation={mapSearchFocus}
      >
        <div className="float-top">
          <div className="searchbar">
            {showStays ? <BedDouble /> : <Search />}
            {showStays ? (
              <span className="muted flex1" style={{ fontSize: 15 }}>Ubytování v aktuální oblasti</span>
            ) : (
              <input
                aria-label="Hledat místa na mapě"
                className="flex1"
                style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', minWidth: 0 }}
                value={mapSearch}
                onChange={(event) => {
                  setMapSearch(event.target.value);
                  setMapSearchArea(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    if (localMapSearchMatches[0]) {
                      selectMapSearchPlace(localMapSearchMatches[0]);
                    } else if (mapSearchResults[0]) {
                      selectMapSearchLocation(mapSearchResults[0]);
                    }
                  }
                  if (event.key === 'Escape') {
                    clearMapSearch();
                  }
                }}
                placeholder={selectedMapDay ? 'Hledat místa v tomhle dni...' : `Hledat místa v destinaci ${state.selectedTrip?.destination ?? 'tomto výletu'}...`}
              />
            )}
            {!showStays && mapSearch && (
              <Button size="icon" variant="ghost" type="button" className="searchbar-clear" aria-label="Vymazat hledání" onClick={clearMapSearch}>
                <X />
              </Button>
            )}
            <AvatarRow names={(state.selectedTrip?.members ?? []).map((member) => member.user.name)} />
          </div>
          {showMapSearchResults && (
            <Card className="map-search-results">
              {localMapSearchMatches.length > 0 && (
                <>
                  <div className="map-search-section-label">Uložená místa</div>
                  {localMapSearchMatches.map((place) => (
                    <button key={place.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectMapSearchPlace(place)}>
                      <MapPin />
                      <span className="col flex1" style={{ minWidth: 0 }}>
                        <span className="t-sm semib ellipsis">{place.name}</span>
                        <span className="muted t-xs ellipsis">{place.locationLabel ?? placeStatusMeta[normalizePlaceStatus(place.status)].label}</span>
                      </span>
                    </button>
                  ))}
                </>
              )}
              {(mapSearchResults.length > 0 || mapSearchLoading) && (
                <>
                  <div className="map-search-section-label">Lokace</div>
                  {mapSearchResults.map((location) => (
                    <button key={location.externalId} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => selectMapSearchLocation(location)}>
                      <Search />
                      <span className="col flex1" style={{ minWidth: 0 }}>
                        <span className="t-sm semib ellipsis">{location.label}</span>
                        <span className="muted t-xs">{location.type ?? location.countryCode ?? 'Mapa'}</span>
                      </span>
                    </button>
                  ))}
                  {mapSearchLoading && <div className="map-search-loading">Hledám lokace...</div>}
                </>
              )}
              {!mapSearchLoading && localMapSearchMatches.length === 0 && mapSearchResults.length === 0 && (
                <div className="map-search-loading">Nic nenalezeno.</div>
              )}
            </Card>
          )}
          <ChipGroup value={filter} options={filters.map((item) => ({ value: item.key, label: item.label }))} onValueChange={setMapFilter} className="map-filter-chips mt10" />
          {mapSearchArea && !showStays && (
            <div className="row g8 mt10 wrap">
              <span className="badge muted"><MapPin />{mapSearchArea.label}</span>
              <Button size="sm" variant="ghost" type="button" onClick={clearMapSearch}>Zrušit oblast</Button>
            </div>
          )}
          {!showStays && dayFilterOptions.length > 1 && (
            <div className="row g8 mt10 wrap">
              <Select
                value={mapDayId}
                onValueChange={(value) => {
                  setMapDayId(value);
                  setSnap('half');
                }}
              >
                <SelectTrigger className="badge-select" style={{ height: 28, width: 'auto', maxWidth: '100%' }}>
                  <CalendarDays />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!showStays && (
            <div className="row g8 mt10 wrap">
              <span className={`badge cat-${discoveryCategoryClass(activeDiscoveryCategory)}`}>{discoveryCategoryLabel(activeDiscoveryCategory)}</span>
              <Button size="sm" variant="outline" type="button" onClick={discoverAroundMap} disabled={state.discovering}>
                <Search size={14} />{state.discovering ? 'Hledám' : discoverButtonLabel}
              </Button>
              <Button size="sm" variant="outline" type="button" onClick={() => void actions.discoverNearbyCurrentLocation(activeDiscoveryCategory)}>
                <LocateFixed size={14} />Kolem mě
              </Button>
            </div>
          )}
        </div>

        {showStays && <Button className="search-area" type="button" onClick={() => void actions.searchStays(undefined, mapCenter ?? undefined)}><ArrowUpDown />Hledat v této oblasti</Button>}

        <Button
          className="fab"
          size="icon"
          variant="outline"
          style={{ bottom: desktop ? 24 : `calc(${dockSnapHeights[snap] * 100}% + 16px)` }}
          type="button"
          title="Najít polohu"
          onClick={() => window.dispatchEvent(new CustomEvent('trip-map-locate'))}
        >
          <LocateFixed />
        </Button>

        {!desktop && (
          <DockedSheet snap={snap} onSnapChange={setSnap}>
            {snap === 'peek' && (
              <div className={showStays ? 'p18' : 'p18 pressable'} style={{ paddingTop: 4 }} onClick={() => !showStays && state.selectedPlace && setDetailOpen(true)}>
                {showStays && state.selectedAccommodation ? (
                <>
                  <div className="row between mb10">
                    <span className="badge cat-stay"><BedDouble />{accommodationTypeLabel(state.selectedAccommodation)}</span>
                    <AccommodationRatingBadge
                      reviewScore={state.selectedAccommodation.reviewScore}
                      rating={state.selectedAccommodation.rating}
                      reviewCount={state.selectedAccommodation.reviewCount}
                    />
                  </div>
                  <div className="row g12">
                    <AccommodationPhoto stay={state.selectedAccommodation} size={64} />
                    <div className="col flex1">
                      <span className="t-h2">{state.selectedAccommodation.name}</span>
                      <span className="muted t-sm mt4">{accommodationPriceLabel(state.selectedAccommodation)}</span>
                    </div>
                  </div>
                  <div className="row g8 mt14">
                    <StatusActionButton className="flex1" active={selectedAccommodationVote === 'UP' || selectedAccommodationStatus === 'SHORTLISTED'} tone="amber" type="button" variant={selectedAccommodationPlace ? 'outline' : 'default'} onClick={() => {
                      if (selectedAccommodationPlace) {
                        void actions.voteForPlace(selectedAccommodationPlace.id, 'UP');
                        return;
                      }
                      void actions.saveAccommodation(state.selectedAccommodation!);
                    }}><Bookmark />{selectedAccommodationPlace ? 'Užší výběr' : 'Uložit ubytování'}</StatusActionButton>
                    {selectedAccommodationPlace && canManagePlanning && (
                      <StatusActionButton active={selectedAccommodationStatus === 'SELECTED' || selectedAccommodationStatus === 'BOOKED'} tone="green" type="button" onClick={() => void actions.updateAccommodationStatus(selectedAccommodationPlace.id, 'SELECTED')}><Check />Vybrat</StatusActionButton>
                    )}
                  </div>
                  {(selectedAccommodationMapUrl || selectedAccommodationBookingUrl) && (
                    <div className="row g8 mt8 wrap">
                      {selectedAccommodationMapUrl && (
                        <Button asChild size="sm" variant="outline">
                          <a href={selectedAccommodationMapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
                        </Button>
                      )}
                      {selectedAccommodationBookingUrl && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={selectedAccommodationBookingUrl} target="_blank" rel="noreferrer"><ExternalLink />Booking</a>
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : selectedAiCandidate ? (
                <AiCandidateDetailCard
                  compact
                  candidate={selectedAiCandidate}
                  onSave={() => saveAiCandidate(selectedAiCandidate)}
                  onClose={() => setSelectedAiCandidate(null)}
                />
              ) : selectedDiscovery ? (
                <DiscoveryDetailCard
                  compact
                  discovery={selectedDiscovery}
                  summary={selectedDiscoveryDetail}
                  loading={selectedDiscoveryLoading}
                  onSave={() => void actions.saveDiscoveryPlace(selectedDiscovery).then(() => setSelectedDiscovery(null))}
                  onClose={() => setSelectedDiscovery(null)}
                />
              ) : state.selectedPlace ? (
                <>
                  <div className="row between mb8">
                    <CategoryBadge type={state.selectedPlace.type} />
                    <div className="row g6 wrap" style={{ justifyContent: 'flex-end' }}>
                      <span className={`badge ${selectedStatusMeta.cls}`}>{selectedStatusMeta.label}</span>
                      <PlaceScoreBadge place={state.selectedPlace} />
                      <span className="badge muted">{state.selectedPlace.votes?.length ?? 0} hlasů</span>
                    </div>
                  </div>
                  <div className="row between">
                    <div className="col">
                      <span className="t-h2">{state.selectedPlace.name}</span>
                      <span className="muted t-sm mt4">{state.selectedPlace.durationMin ?? 90} min · {state.selectedPlace.estimatedCost ?? 'Zdarma'}</span>
                    </div>
                    <ChevronRight className="faint" />
                  </div>
                  {selectedVotes && (
                    <div className="row g8 mt14">
                      <span className="badge solid"><Star />{selectedVotes.must} nutné</span>
                      <span className="badge"><ThumbsUp />{selectedVotes.up} pro</span>
                      <span className="badge muted">{selectedVotes.maybe} možná</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="center muted t-sm">Klepni na pin nebo přidej místa v plánu.</div>
              )}
              </div>
            )}
            {snap !== 'peek' && showStays && (
              <>
                <div className="px18" style={{ flex: '0 0 auto' }}>
                  <div className="row between" style={{ padding: '2px 0 6px' }}>
                    <span className="t-h2">{state.accommodations.length} ubytování v okolí</span>
                    <Button variant="ghost" size="sm" type="button" onClick={() => void actions.searchStays()}><ArrowUpDown />Obnovit</Button>
                  </div>
                  <span className="muted t-xs">Výsledky z napojeného vyhledávání ubytování.</span>
                </div>
                <div className="scroll px18" style={{ flex: 1, paddingTop: 6, paddingBottom: 18 }}>
                  {state.accommodations.map((stay, index) => (
                    <div key={stay.externalId}>
                      {index > 0 && <hr className="sep" />}
                      <button className="map-list-row" type="button" onClick={() => selectStay(stay.externalId)}>
                        <AccommodationPhoto stay={stay} />
                        <div className="col flex1" style={{ minWidth: 0 }}>
                          <span className="t-h3 ellipsis">{stay.name}</span>
                          <span className="muted t-xs mt4 row g6 wrap">
                            {accommodationTypeLabel(stay)}
                            <span className="dotsep" />
                            <AccommodationRatingBadge compact reviewScore={stay.reviewScore} rating={stay.rating} reviewCount={stay.reviewCount} />
                          </span>
                          <span className="t-h3 tnum mt4">{accommodationPriceLabel(stay)}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                  {state.accommodations.length === 0 && (
                    <Card className="p-[14px]">
                      <div className="col g10 center text-center">
                        <Search size={18} color="var(--muted)" />
                        <div>
                          <div className="t-h3">{state.accommodationSearchDone ? 'Nic jsem nenašel.' : 'Najít ubytování v okolí'}</div>
                          <div className="muted t-sm mt4">{state.accommodationSearchDone ? 'Zkus změnit oblast nebo cenové filtry na stránce ubytování.' : 'Spustí hledání podle aktuálního výletu.'}</div>
                        </div>
                        <Button className="w-full" type="button" onClick={() => void actions.searchStays()}>{state.accommodationSearchDone ? 'Zkusit znovu' : 'Najít ubytování'}</Button>
                      </div>
                    </Card>
                  )}
                </div>
              </>
            )}
            {snap !== 'peek' && !showStays && (
              <>
                <div className="px18" style={{ flex: '0 0 auto' }}>
                  <div className="row between" style={{ padding: '2px 0 12px' }}>
                    <span className="t-h2">{selectedMapDay ? `${placeList.length} míst v dni` : `${placeList.length} míst`}</span>
                    {canManagePlanning && <Button variant="ghost" size="sm" type="button" onClick={() => void actions.optimizeRoute()}><ArrowUpDown />Trasa</Button>}
                  </div>
                </div>
                <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
                  {selectedMapDay && dayScopedPlaces.length === 0 && (
                    <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
                      <span className="t-h3">Den nemá místo na mapě</span>
                      <p className="muted t-sm mt6">Přidej místo dne přes našeptávač nebo do dne vlož zastávku.</p>
                    </Card>
                  )}
                  {selectedDiscovery && (
                    <div className="mb12">
                      <DiscoveryDetailCard
                        discovery={selectedDiscovery}
                        summary={selectedDiscoveryDetail}
                        loading={selectedDiscoveryLoading}
                        onSave={() => void actions.saveDiscoveryPlace(selectedDiscovery).then(() => setSelectedDiscovery(null))}
                        onClose={() => setSelectedDiscovery(null)}
                      />
                    </div>
                  )}
                  {selectedAiCandidate && (
                    <div className="mb12">
                      <AiCandidateDetailCard
                        candidate={selectedAiCandidate}
                        onSave={() => saveAiCandidate(selectedAiCandidate)}
                        onClose={() => setSelectedAiCandidate(null)}
                      />
                    </div>
                  )}
                  <AiInsightsPanel
                    compact
                    insights={state.data.aiInsights}
                    suggestions={state.data.aiSuggestions}
                    planDraft={state.data.aiPlanDraft}
                    loading={state.generatingInsights}
                    loadingSuggestions={state.generatingSuggestions}
                    loadingPlanDraft={state.generatingPlanDraft}
                    compactDetails={false}
                    onGenerate={() => void actions.generateTripInsights()}
                    onGenerateSuggestions={() => void actions.generateTripSuggestions(aiMapFocus())}
                    onGeneratePlanDraft={() => void actions.generateTripPlanDraft(aiMapFocus())}
                    onNavigate={actions.setActiveTab}
                    onDismiss={clearAiMapDrafts}
                  />
                  <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
                    <div className="row between mb8">
                      <span className="t-h3">Sdílená poloha</span>
                      <span className="badge muted"><Users />{state.data.liveLocations.length}</span>
                    </div>
                    <div className="row g8 wrap">
                      <Button size="sm" variant="outline" type="button" onClick={() => void actions.shareLiveLocation()} disabled={state.sharingLiveLocation}><Radio />{state.sharingLiveLocation ? 'Sdílí se' : 'Sdílet polohu'}</Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => void actions.stopSharingLiveLocation()}>Vypnout</Button>
                    </div>
                    {state.data.liveLocations.length >= 2 && (() => {
                      const center = averageLocation(state.data.liveLocations);
                      return center ? (
                        <div className="mt10">
                          <div className="muted t-xs mb6">Místo setkání podle aktuálních poloh</div>
                          <Button size="sm" type="button" onClick={() => void actions.discoverPlaces({ ...center, category: 'FOOD', radiusMeters: 1200 })}>
                            <MapPin />Najít místo mezi námi
                          </Button>
                        </div>
                      ) : null;
                    })()}
                    {state.data.liveLocations.length > 0 && (
                      <div className="col mt10">
                        {state.data.liveLocations.slice(0, 4).map((location) => (
                          <div className="row between" key={location.id} style={{ padding: '4px 0' }}>
                            <span className="t-xs">{location.user?.name ?? 'Člen'}</span>
                            <span className="muted t-xs">{new Date(location.updatedAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                  {state.discoveries.length > 0 && (
                    <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
                      <div className="row between mb8">
                        <span className="t-h3">Objeveno v okolí</span>
                        <span className="badge muted">{state.discoveries.length}</span>
                      </div>
                      <div className="col">
                        {state.discoveries.slice(0, 8).map((discovery, index) => (
                          <div key={discovery.externalId}>
                            {index > 0 && <hr className="sep" />}
                            <button
                              className="row pressable w-full text-left"
                              type="button"
                              style={{ padding: '10px 0' }}
                              onClick={() => selectDiscovery(discovery)}
                            >
                              <div className="col flex1" style={{ minWidth: 0 }}>
                                <span className="t-sm semib ellipsis">{discovery.name}</span>
                                <span className="muted t-xs mt2">{discoveryTypeLabel(discovery.type)} · {discoveryCategoryLabel(discovery.category)}</span>
                              </div>
                              <span className="badge muted">Detail</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                  {aiMapCandidates.length > 0 && (
                    <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
                      <div className="row between mb8">
                        <span className="t-h3">AI návrhy na mapě</span>
                        <span className="badge muted">{aiMapCandidates.length}</span>
                      </div>
                      <div className="col">
                        {aiMapCandidates.slice(0, 8).map((candidate, index) => (
                          <div key={candidate.id}>
                            {index > 0 && <hr className="sep" />}
                            <button
                              className="row pressable w-full text-left"
                              type="button"
                              style={{ padding: '10px 0' }}
                              onClick={() => selectAiCandidate(candidate)}
                            >
                              <div className="col flex1" style={{ minWidth: 0 }}>
                                <span className="t-sm semib ellipsis">{candidate.name}</span>
                                <span className="muted t-xs mt2">{candidateTypeLabel(candidate.type)} · {candidate.verification.status === 'VERIFIED' ? 'ověřeno' : 'částečně ověřeno'}</span>
                              </div>
                              <span className="badge muted">Detail</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                  {placeList.map((place, index) => {
                    const itemVotes = votes(place);
                    return (
                      <div key={place.id}>
                        {index > 0 && <hr className="sep" />}
                        <button className="map-list-row" type="button" onClick={() => {
                          selectPlace(place.id);
                          setDetailOpen(true);
                        }}>
                          <div className="col flex1" style={{ minWidth: 0 }}>
                            <div className="row between g8">
                              <span className="t-h3 ellipsis">{place.name}</span>
                              <CategoryBadge type={place.type} />
                            </div>
                            <div className="row g10 mt4 muted t-xs wrap">
                              <span className="row g4"><ThumbsUp size={13} />{itemVotes.must + itemVotes.up}</span>
                              <span className="row g4"><MessageCircle size={13} />{place.comments?.length ?? 0}</span>
                              <span className="row g4"><Clock size={13} />{place.durationMin ?? 90} min</span>
                              <span className="medi" style={{ color: 'var(--fg)' }}>{place.estimatedCost ?? 'Zdarma'}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </DockedSheet>
        )}
        {!desktop && detailOpen && state.selectedPlace && (
          <>
            <div className="scrim" onClick={() => setDetailOpen(false)} />
            <div className="sheet" style={{ height: '92%' }}>
              <div className="sheet-head" style={{ paddingBottom: 6 }}>
                <div className="row g8">
                  <CategoryBadge type={state.selectedPlace.type} />
                  <span className={`badge ${selectedStatusMeta.cls}`}>{selectedStatusMeta.label}</span>
                  <PlaceScoreBadge place={state.selectedPlace} />
                  <span className="badge muted">{state.selectedPlace.votes?.length ?? 0} hlasů</span>
                </div>
                <Button size="icon" variant="ghost" type="button" onClick={() => setDetailOpen(false)}><X /></Button>
              </div>
              <div className="scroll px18" style={{ flex: 1 }}>
                <PlaceImage place={state.selectedPlace} height={150} />
                <h2 className="t-title mt16">{state.selectedPlace.name}</h2>
                  <div className="row g10 mt8 muted t-sm wrap">
                    <span className="row g4"><Clock />{state.selectedPlace.durationMin ?? 90} min</span>
                    <span className="row g4"><Banknote />{state.selectedPlace.estimatedCost ?? 'Zdarma'}</span>
                    <span className="row g4"><MapPin />{state.selectedPlace.locationLabel ?? state.selectedTrip?.destination ?? 'Destinace'}</span>
                    {selectedWeather && <span>{selectedWeather}</span>}
                  </div>
                {(selectedPlaceMapUrl || state.selectedPlace.sourceUrl) && (
                  <div className="row g8 mt14 wrap">
                    {selectedPlaceMapUrl && (
                      <Button asChild variant="outline" size="sm">
                        <a href={selectedPlaceMapUrl} target="_blank" rel="noreferrer"><MapPin />Mapa</a>
                      </Button>
                    )}
                    {state.selectedPlace.sourceUrl && (
                      <Button asChild variant="ghost" size="sm">
                        <a href={state.selectedPlace.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink />Zdroj</a>
                      </Button>
                    )}
                  </div>
                )}
                <hr className="sep mt20" />
                <div className="row between mt16 mb10">
                  <span className="t-h3">Hlasování skupiny</span>
                  <span className="muted t-xs">{selectedPlaceVoters.size}/{state.selectedTrip?.members?.length ?? '?'} hlasovalo</span>
                </div>
                {selectedPlaceMissingVoters.length > 0 && (
                  <div className="badge muted mb10" style={{ maxWidth: '100%', justifyContent: 'flex-start' }}>
                    Čeká: {selectedPlaceMissingVoters.map((member) => member.user.name).join(', ')}
                  </div>
                )}
                {selectedVotes && (
                  <div className="votes">
                    <button className={`votebtn ${myVote === 'MUST_HAVE' ? 'on must' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'MUST_HAVE')}><span className="vn tnum">{selectedVotes.must}</span><span className="row g4"><Star />Nutné</span></button>
                    <button className={`votebtn ${myVote === 'UP' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'UP')}><span className="vn tnum">{selectedVotes.up}</span><span className="row g4"><ThumbsUp />Pro</span></button>
                    <button className={`votebtn ${myVote === 'MAYBE' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'MAYBE')}><span className="vn tnum">{selectedVotes.maybe}</span><span>Možná</span></button>
                    <button className={`votebtn ${myVote === 'DOWN' ? 'on' : ''}`} type="button" onClick={() => void actions.voteForPlace(state.selectedPlace!.id, 'DOWN')}><span className="vn tnum">{selectedVotes.down}</span><span className="row g4"><ThumbsDown />Ne</span></button>
                  </div>
                )}
                {canChangeSelectedStatus && (
                  <div className="row g8 mt12 wrap">
                    <StatusActionButton active={selectedStatus === 'SHORTLISTED'} tone="amber" size="sm" type="button" onClick={() => void actions.updatePlaceStatus(state.selectedPlace!.id, 'SHORTLISTED')}><Bookmark />Užší výběr</StatusActionButton>
                    <StatusActionButton active={selectedStatus === 'APPROVED'} tone="green" size="sm" type="button" onClick={() => void actions.updatePlaceStatus(state.selectedPlace!.id, 'APPROVED')}><Check />Schválit</StatusActionButton>
                    <StatusActionButton active={selectedStatus === 'REJECTED'} tone="red" size="sm" type="button" onClick={() => void actions.updatePlaceStatus(state.selectedPlace!.id, 'REJECTED')}><X />Zamítnout</StatusActionButton>
                  </div>
                )}
                <hr className="sep mt20" />
                <div className="row between mt16 mb12"><span className="t-h3">Komentáře</span><span className="badge muted">{state.selectedPlace.comments?.length ?? 0}</span></div>
                <div className="col g12">
                  {(state.selectedPlace.comments ?? []).map((comment) => (
                    <PlaceCommentCard comment={comment} key={comment.id ?? `${comment.userId}-${comment.body}`} />
                  ))}
                </div>
                <div className="relative mt8" style={{ marginBottom: 18 }}>
                  <MessageCircle className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 bg-muted border-transparent" placeholder="Přidat komentář..." value={commentText} onChange={(event) => setCommentText(event.target.value)} />
                </div>
              </div>
              {(hasCommentDraft || canManagePlanning) && (
                <div className="row g8 p16" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
                  <Button className="flex1" type="button" onClick={() => {
                    if (hasCommentDraft) {
                      void actions.commentOnPlace(state.selectedPlace!.id, commentText).then(() => setCommentText(''));
                      return;
                    }
                    setDetailOpen(false);
                    void actions.addPlaceToItinerary(state.selectedPlace!.id);
                  }}>{hasCommentDraft ? 'Přidat komentář' : 'Přidat do itineráře'}</Button>
                  {canManagePlanning && (
                    <Button variant="outline" size="icon" type="button" onClick={() => void actions.commentOnPlace(state.selectedPlace!.id, commentText).then(() => setCommentText(''))} disabled={!hasCommentDraft}><MessageCircle /></Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </MapCanvas>
      </div>
      {desktop && <aside className="desk-panel">{desktopAside}</aside>}
    </div>
  );
}
