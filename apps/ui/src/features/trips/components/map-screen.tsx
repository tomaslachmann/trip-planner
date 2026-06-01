import { ArrowUpDown, Banknote, BedDouble, ChevronRight, Clock, ExternalLink, LocateFixed, MapPin, MessageCircle, Radio, Search, Star, ThumbsDown, ThumbsUp, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipGroup } from '@/components/ui/chip-group';
import { DockedSheet, dockSnapHeights, type DockSnap } from '@/components/ui/docked-sheet';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { AvatarRow } from './avatar';
import { CategoryBadge } from './category';
import { AiInsightsPanel } from './ai-insights-panel';
import { MapCanvas } from './map-canvas';
import { PlaceCommentCard } from './place-comment-card';
import { PlaceScoreBadge } from './place-score-badge';
import { StatusActionButton } from './status-action-button';
import type { TripPlannerController } from '../hooks/use-trip-planner';
import { normalizePlaceStatus, placeStatusMeta } from '../lib/decision';
import type { DiscoveryPlace, Place, WikipediaPlaceSummary } from '../types';

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
};

const discoveryCategoryClasses: Record<DiscoveryPlace['category'], string> = {
  SIGHTS: 'see',
  FOOD: 'food',
  ACTIVITY: 'act',
  TRANSPORT: 'trans',
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
  food_court: 'Food court',
  park: 'Park',
  sports_centre: 'Sportoviště',
  swimming_pool: 'Bazén',
  playground: 'Hřiště',
  stadium: 'Stadion',
  bus_station: 'Autobusové nádraží',
  ferry_terminal: 'Přívoz',
  taxi: 'Taxi',
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
          <div className="receipt center" style={{ width: compact ? 72 : 112, height: compact ? 72 : 92, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }}>
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

function discoveryCategoryForContext(filter: string, selectedPlace?: Place): DiscoveryPlace['category'] {
  if (filter === 'FOOD') return 'FOOD';
  if (filter === 'ACTIVITY' || filter === 'DAY_TRIP') return 'ACTIVITY';
  if (selectedPlace?.type === 'FOOD') return 'FOOD';
  if (selectedPlace?.type === 'ACTIVITY' || selectedPlace?.type === 'DAY_TRIP') return 'ACTIVITY';
  return 'SIGHTS';
}

export function MapScreen({ planner, desktop = false }: { planner: TripPlannerController; desktop?: boolean }) {
  const { state, actions } = planner;
  const [filter, setFilter] = useState('ALL');
  const [snap, setSnap] = useState<DockSnap>('half');
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [mapSearch, setMapSearch] = useState('');
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryPlace | null>(null);
  const [discoveryDetails, setDiscoveryDetails] = useState<Record<string, WikipediaPlaceSummary | null>>({});
  const [loadingDiscoveryDetailId, setLoadingDiscoveryDetailId] = useState('');
  const [mapCenter, setMapCenter] = useState<{ latitude: number; longitude: number; zoom: number } | null>(null);
  const showStays = filter === 'ACCOMMODATION';
  const filteredPlaces = useMemo(() => {
    const query = mapSearch.trim().toLowerCase();
    return state.data.places.filter((place) => {
      const matchesFilter = filter === 'ALL' || place.type === filter || (filter === 'PLACE' && place.type === 'CUSTOM');
      const matchesQuery = !query || place.name.toLowerCase().includes(query) || (place.description ?? '').toLowerCase().includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [filter, mapSearch, state.data.places]);

  function selectPlace(placeId: string) {
    actions.setSelectedPlaceId(placeId);
    setSelectedDiscovery(null);
    setSnap('peek');
    setDetailOpen(false);
    setCommentText('');
  }

  function selectStay(stayId: string) {
    actions.setSelectedAccommodationId(stayId);
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
    actions.setSelectedPlaceId('');
    setSnap('half');
    void loadDiscoveryDetail(discovery);
  }

  function setMapFilter(next: string) {
    setFilter(next);
    setSnap('half');
    if (next === 'ACCOMMODATION' && state.accommodations.length === 0) void actions.searchStays();
  }

  function discoverAroundMap() {
    const center = state.selectedPlace ?? mapCenter ?? state.data.places[0];
    if (!center) {
      return;
    }
    void actions.discoverPlaces({
      latitude: center.latitude,
      longitude: center.longitude,
      category: activeDiscoveryCategory,
      radiusMeters: activeDiscoveryCategory === 'ACTIVITY' ? 1800 : 3000,
    });
  }

  const placeList = filteredPlaces.length ? filteredPlaces : state.data.places;
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
  const selectedDiscoveryDetail = selectedDiscovery ? discoveryDetails[selectedDiscovery.externalId] : undefined;
  const selectedDiscoveryLoading = selectedDiscovery ? loadingDiscoveryDetailId === selectedDiscovery.externalId : false;
  const selectedWeather = placeWeatherLabel(planner);
  const selectedStatus = normalizePlaceStatus(state.selectedPlace?.status);
  const selectedStatusMeta = placeStatusMeta[selectedStatus];
  const activeDiscoveryCategory = discoveryCategoryForContext(filter, state.selectedPlace);
  const discoverButtonLabel = state.selectedPlace ? 'Objevit u místa' : 'Objevit v mapě';
  const canChangeSelectedStatus = state.selectedPlace
    ? state.selectedPlace.createdById === state.actorUserId || state.actorMember?.role === 'OWNER' || state.actorMember?.role === 'ADMIN'
    : false;

  return (
    <div className={desktop ? 'desktop-map-host' : 'screen'}>
      <MapCanvas
        places={placeList}
        accommodations={state.accommodations}
        discoveries={showStays ? [] : state.discoveries}
        liveLocations={state.data.liveLocations}
        routes={state.data.routes}
        selectedPlaceId={state.selectedPlaceId}
        selectedAccommodationId={state.selectedAccommodationId}
        onPlaceSelect={selectPlace}
        onAccommodationSelect={selectStay}
        onDiscoverySelect={selectDiscovery}
        onViewportChange={setMapCenter}
        showStays={showStays}
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
                onChange={(event) => setMapSearch(event.target.value)}
                placeholder={`Hledat místa v destinaci ${state.selectedTrip?.destination ?? 'tomto tripu'}...`}
              />
            )}
            <AvatarRow names={(state.selectedTrip?.members ?? []).map((member) => member.user.name)} />
          </div>
          <ChipGroup value={filter} options={filters.map((item) => ({ value: item.key, label: item.label }))} onValueChange={setMapFilter} className="mt10" />
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

        {desktop && selectedDiscovery && (
          <div style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 20, width: 390, maxWidth: 'calc(100% - 32px)' }}>
            <DiscoveryDetailCard
              discovery={selectedDiscovery}
              summary={selectedDiscoveryDetail}
              loading={selectedDiscoveryLoading}
              onSave={() => void actions.saveDiscoveryPlace(selectedDiscovery).then(() => setSelectedDiscovery(null))}
              onClose={() => setSelectedDiscovery(null)}
            />
          </div>
        )}

        {!desktop && (
          <DockedSheet snap={snap} onSnapChange={setSnap}>
            {snap === 'peek' && (
              <div className={showStays ? 'p18' : 'p18 pressable'} style={{ paddingTop: 4 }} onClick={() => !showStays && state.selectedPlace && setDetailOpen(true)}>
                {showStays && state.selectedAccommodation ? (
                <>
                  <div className="row between mb10">
                    <span className="badge cat-stay"><BedDouble />{state.selectedAccommodation.type ?? state.selectedAccommodation.provider}</span>
                    <span className="badge">{state.selectedAccommodation.reviewScore ?? state.selectedAccommodation.rating ?? '-'} hodnocení</span>
                  </div>
                  <div className="row g12">
                    <div className="receipt" style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }} />
                    <div className="col flex1">
                      <span className="t-h2">{state.selectedAccommodation.name}</span>
                      <span className="muted t-sm mt4">{state.selectedAccommodation.priceDisplay ?? `${state.selectedAccommodation.priceTotal ?? '-'} ${state.selectedAccommodation.currency ?? ''}`}</span>
                    </div>
                  </div>
                  <div className="row g8 mt14">
                    <StatusActionButton className="flex1" active={selectedAccommodationVote === 'UP' || selectedAccommodationStatus === 'SHORTLISTED'} tone="amber" type="button" variant={selectedAccommodationPlace ? 'outline' : 'default'} onClick={() => {
                      if (selectedAccommodationPlace) {
                        void actions.voteForPlace(selectedAccommodationPlace.id, 'UP');
                        return;
                      }
                      void actions.saveAccommodation(state.selectedAccommodation!);
                    }}>{selectedAccommodationPlace ? 'Shortlist' : 'Uložit ubytování'}</StatusActionButton>
                    {selectedAccommodationPlace && (
                      <StatusActionButton active={selectedAccommodationStatus === 'SELECTED' || selectedAccommodationStatus === 'BOOKED'} tone="green" type="button" onClick={() => void actions.updateAccommodationStatus(selectedAccommodationPlace.id, 'SELECTED')}>Vybrat</StatusActionButton>
                    )}
                  </div>
                </>
              ) : selectedDiscovery ? (
                <DiscoveryDetailCard
                  compact
                  discovery={selectedDiscovery}
                  summary={selectedDiscoveryDetail}
                  loading={selectedDiscoveryLoading}
                  onSave={() => void actions.saveDiscoveryPlace(selectedDiscovery).then(() => setSelectedDiscovery(null))}
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
                      <span className="badge solid"><Star />{selectedVotes.must} must</span>
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
                        <div className="receipt" style={{ width: 54, height: 54, borderRadius: 12, border: '1px solid var(--border)', flex: '0 0 auto' }} />
                        <div className="col flex1" style={{ minWidth: 0 }}>
                          <span className="t-h3 ellipsis">{stay.name}</span>
                          <span className="muted t-xs mt4">{stay.type ?? stay.provider} · {stay.reviewScore ?? stay.rating ?? '-'} hodnocení</span>
                          <span className="t-h3 tnum mt4">{stay.priceDisplay ?? `${stay.priceTotal ?? '-'} ${stay.currency ?? ''}`}</span>
                        </div>
                      </button>
                    </div>
                  ))}
                  {state.accommodations.length === 0 && <Button className="mt14 w-full" type="button" onClick={() => void actions.searchStays()}>Najít ubytování</Button>}
                </div>
              </>
            )}
            {snap !== 'peek' && !showStays && (
              <>
                <div className="px18" style={{ flex: '0 0 auto' }}>
                  <div className="row between" style={{ padding: '2px 0 12px' }}>
                    <span className="t-h2">{placeList.length} míst</span>
                    <Button variant="ghost" size="sm" type="button" onClick={() => void actions.optimizeRoute()}><ArrowUpDown />Trasa</Button>
                  </div>
                </div>
                <div className="scroll px18" style={{ flex: 1, paddingBottom: 18 }}>
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
                  <AiInsightsPanel
                    compact
                    insights={state.data.aiInsights}
                    loading={state.generatingInsights}
                    onGenerate={() => void actions.generateTripInsights()}
                    onNavigate={actions.setActiveTab}
                  />
                  <Card className="p-[12px] shadow-[var(--sh-sm)] mb12">
                    <div className="row between mb8">
                      <span className="t-h3">Live poloha</span>
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
                          <div className="muted t-xs mb6">Meeting point podle aktuálních poloh</div>
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
                            <div className="row g10 mt4 muted t-xs">
                              <span><ThumbsUp /> {itemVotes.must + itemVotes.up}</span>
                              <span>{place.comments?.length ?? 0} komentářů</span>
                              <span>{place.durationMin ?? 90} min</span>
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
                <div className="receipt center" style={{ height: 150, borderRadius: 14, border: '1px solid var(--border)' }}>
                  <span className="row g6 t-xs mono muted"><MapPin />fotka místa</span>
                </div>
                <h2 className="t-title mt16">{state.selectedPlace.name}</h2>
                  <div className="row g10 mt8 muted t-sm wrap">
                    <span className="row g4"><Clock />{state.selectedPlace.durationMin ?? 90} min</span>
                    <span className="row g4"><Banknote />{state.selectedPlace.estimatedCost ?? 'Zdarma'}</span>
                    <span className="row g4"><MapPin />{state.selectedTrip?.destination ?? 'Destinace'}</span>
                    {selectedWeather && <span>{selectedWeather}</span>}
                  </div>
                {state.selectedPlace.sourceUrl && <p className="t-body mt14" style={{ color: '#3f3f46' }}>{state.selectedPlace.sourceUrl}</p>}
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
                    <StatusActionButton active={selectedStatus === 'SHORTLISTED'} tone="amber" size="sm" type="button" onClick={() => void actions.updatePlaceStatus(state.selectedPlace!.id, 'SHORTLISTED')}>Shortlist</StatusActionButton>
                    <StatusActionButton active={selectedStatus === 'APPROVED'} tone="green" size="sm" type="button" onClick={() => void actions.updatePlaceStatus(state.selectedPlace!.id, 'APPROVED')}>Schválit</StatusActionButton>
                    <StatusActionButton active={selectedStatus === 'REJECTED'} tone="red" size="sm" type="button" onClick={() => void actions.updatePlaceStatus(state.selectedPlace!.id, 'REJECTED')}>Zamítnout</StatusActionButton>
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
              <div className="row g8 p16" style={{ borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
                <Button className="flex1" type="button" onClick={() => {
                  if (hasCommentDraft) {
                    void actions.commentOnPlace(state.selectedPlace!.id, commentText).then(() => setCommentText(''));
                    return;
                  }
                  setDetailOpen(false);
                  void actions.addPlaceToItinerary(state.selectedPlace!.id);
                }}>{hasCommentDraft ? 'Přidat komentář' : 'Přidat do itineráře'}</Button>
                <Button variant="outline" size="icon" type="button" onClick={() => void actions.commentOnPlace(state.selectedPlace!.id, commentText).then(() => setCommentText(''))} disabled={!hasCommentDraft}><MessageCircle /></Button>
              </div>
            </div>
          </>
        )}
      </MapCanvas>
    </div>
  );
}
