'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LatLngExpression, LayerGroup, Map as LeafletMap } from 'leaflet';
import { categoryKey } from '../lib/format';
import type { Accommodation, AiSuggestionCandidate, DiscoveryPlace, LiveLocation, Place, RoutePlan } from '../types';
import { accommodationPriceLabel } from './accommodation-display';

type LeafletModule = typeof import('leaflet');
type Point = { latitude: number; longitude: number };

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function decodePolyline(polyline: string): LatLngExpression[] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates: LatLngExpression[] = [];

  while (index < polyline.length) {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = polyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    latitude += (result & 1) ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = polyline.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    longitude += (result & 1) ? ~(result >> 1) : result >> 1;

    coordinates.push([latitude / 1e5, longitude / 1e5]);
  }

  return coordinates;
}

function validPoint<T extends Point>(point: T): point is T {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude);
}

function candidatePoint(candidate: AiSuggestionCandidate): Point | null {
  const latitude = candidate.verification.latitude;
  const longitude = candidate.verification.longitude;
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function candidateTypeKey(type?: string) {
  if (type === 'FOOD') return 'food';
  if (type === 'ACTIVITY') return 'act';
  if (type === 'DAY_TRIP') return 'day';
  if (type === 'TRANSPORT') return 'trans';
  return 'see';
}

function allPoints(places: Place[], accommodations: Accommodation[], aiCandidates: AiSuggestionCandidate[], showStays?: boolean) {
  const candidatePoints = aiCandidates.map(candidatePoint).filter((point): point is Point => Boolean(point));
  const points: Point[] = showStays ? accommodations : [...places, ...candidatePoints];
  return points.filter(validPoint);
}

function visibleRouteLegs(route: RoutePlan, visiblePlaceIds: Set<string>) {
  return (route.legs ?? []).filter((leg) => {
    if (!leg.fromPlaceId || !leg.toPlaceId) return false;
    return visiblePlaceIds.has(leg.fromPlaceId) && visiblePlaceIds.has(leg.toPlaceId);
  });
}

const markerGlyphs: Record<string, string> = {
  see: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21h16"/><path d="M5 10h14"/><path d="M12 3l8 5H4l8-5Z"/><path d="M7 10v8"/><path d="M12 10v8"/><path d="M17 10v8"/></svg>',
  food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8"/><path d="M10 3v8"/><path d="M7 7h3"/><path d="M8.5 11v10"/><path d="M17 3v18"/><path d="M14 3c0 5 1 8 3 8"/></svg>',
  act: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 5v14"/><path d="M5 12h14"/><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>',
  day: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 19 7-12 4 7 2-3 5 8H3Z"/><path d="M10 7 8 19"/><path d="M14 14 12 19"/></svg>',
  stay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11V5"/><path d="M4 17v2"/><path d="M20 17v2"/><path d="M4 13h16v4H4Z"/><path d="M8 11h12v2"/><path d="M8 11V8h5a3 3 0 0 1 3 3"/></svg>',
  trans: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19v2"/><path d="M18 19v2"/><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14"/><path d="M8 15h.01"/><path d="M16 15h.01"/></svg>',
};

function markerGlyph(cls: string) {
  return markerGlyphs[cls] ?? markerGlyphs.see;
}

function fitMap(map: LeafletMap, leaflet: LeafletModule, points: Point[]) {
  if (points.length === 0) {
    map.setView([49.8175, 15.473], 6);
    return;
  }
  const bounds = leaflet.latLngBounds(points.map((point) => [point.latitude, point.longitude] as LatLngExpression));
  map.fitBounds(bounds.pad(0.28), { animate: false, maxZoom: 15 });
}

function placeIcon(leaflet: LeafletModule, place: Place, selected: boolean) {
  const cls = categoryKey(place.type);
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-trip-pin ${selected ? 'sel' : ''}">
        <span class="mk mk-${cls}">${markerGlyph(cls)}</span>
        <span class="pin-label">${escapeHtml(place.name)}</span>
      </div>
    `,
    iconSize: [150, 58],
    iconAnchor: [75, 50],
  });
}

function stayIcon(leaflet: LeafletModule, stay: Accommodation, selected: boolean) {
  const price = accommodationPriceLabel(stay);
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-stay-pin ${selected ? 'sel' : ''}">
        <span class="stay-marker">${markerGlyph('stay')}</span>
        <span class="pill">${escapeHtml(price.trim())}</span>
      </div>
    `,
    iconSize: [118, 58],
    iconAnchor: [59, 50],
  });
}

function discoveryIcon(leaflet: LeafletModule, discovery: DiscoveryPlace) {
  const cls = discovery.category === 'FOOD'
    ? 'food'
    : discovery.category === 'ACTIVITY'
      ? 'act'
      : discovery.category === 'TRANSPORT'
        ? 'trans'
        : discovery.category === 'OUTDOOR'
          ? 'day'
          : 'see';
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-trip-pin discovery">
        <span class="mk mk-${cls}">${markerGlyph(cls)}</span>
        <span class="pin-label">${escapeHtml(discovery.name)}</span>
      </div>
    `,
    iconSize: [150, 58],
    iconAnchor: [75, 50],
  });
}

function aiCandidateIcon(leaflet: LeafletModule, candidate: AiSuggestionCandidate, selected: boolean) {
  const cls = candidateTypeKey(candidate.type);
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-trip-pin ai ${selected ? 'sel' : ''}">
        <span class="mk mk-${cls}">${markerGlyph(cls)}</span>
        <span class="pin-label">AI · ${escapeHtml(candidate.name)}</span>
      </div>
    `,
    iconSize: [150, 58],
    iconAnchor: [75, 50],
  });
}

function liveLocationIcon(leaflet: LeafletModule, location: LiveLocation) {
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-live-pin">
        <span class="live-dot"></span>
        <span class="pin-label">${escapeHtml(location.user?.name ?? 'Člen')}</span>
      </div>
    `,
    iconSize: [120, 52],
    iconAnchor: [60, 42],
  });
}

export function MapCanvas({
  places,
  accommodations,
  discoveries = [],
  aiCandidates = [],
  liveLocations = [],
  routes,
  selectedPlaceId,
  selectedAccommodationId,
  selectedAiCandidateId,
  onPlaceSelect,
  onAccommodationSelect,
  onDiscoverySelect,
  onAiCandidateSelect,
  onViewportChange,
  showStays,
  fitKey,
  focusLocation,
  children,
}: {
  places: Place[];
  accommodations: Accommodation[];
  discoveries?: DiscoveryPlace[];
  aiCandidates?: AiSuggestionCandidate[];
  liveLocations?: LiveLocation[];
  routes: RoutePlan[];
  selectedPlaceId?: string;
  selectedAccommodationId?: string;
  selectedAiCandidateId?: string;
  onPlaceSelect: (placeId: string) => void;
  onAccommodationSelect: (accommodationId: string) => void;
  onDiscoverySelect?: (discovery: DiscoveryPlace) => void;
  onAiCandidateSelect?: (candidate: AiSuggestionCandidate) => void;
  onViewportChange?: (center: { latitude: number; longitude: number; zoom: number }) => void;
  showStays?: boolean;
  fitKey?: string;
  focusLocation?: { latitude: number; longitude: number; zoom?: number; key: string | number } | null;
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const fittedInitialDataRef = useRef(false);
  const lastFitKeyRef = useRef<string | undefined>(undefined);
  const lastFocusKeyRef = useRef<string | number | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const leaflet = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      leafletRef.current = leaflet;
      const map = leaflet.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        preferCanvas: true,
      });
      leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);
      layerRef.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;

      const emitViewportChange = () => {
        if (mapRef.current !== map) return;
        let center;
        try {
          center = map.getCenter();
        } catch {
          return;
        }
        if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
        onViewportChange?.({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() });
      };

      const initialPoints = allPoints(places, accommodations, aiCandidates, showStays);
      fitMap(map, leaflet, initialPoints);
      emitViewportChange();
      map.on('moveend zoomend', emitViewportChange);
      fittedInitialDataRef.current = initialPoints.length > 0;
      setReady(true);
    }

    void initMap();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      layerRef.current = null;
      fittedInitialDataRef.current = false;
      lastFitKeyRef.current = undefined;
      lastFocusKeyRef.current = undefined;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !leaflet || !map || !layer) return;

    layer.clearLayers();

    const visiblePlaceIds = new Set(places.map((place) => place.id));
    const activeRoute = showStays ? undefined : routes[0];
    if (activeRoute) {
      for (const leg of visibleRouteLegs(activeRoute, visiblePlaceIds)) {
        if (!leg.encodedPolyline) continue;
        const line = decodePolyline(leg.encodedPolyline);
        if (line.length < 2) continue;
        leaflet.polyline(line, {
          color: '#18181b',
          weight: 4,
          opacity: 0.72,
          dashArray: activeRoute.locked ? undefined : '7 7',
        }).addTo(layer);
      }
    }

    if (showStays) {
      accommodations.filter(validPoint).forEach((stay) => {
        leaflet.marker([stay.latitude, stay.longitude], { icon: stayIcon(leaflet, stay, selectedAccommodationId === stay.externalId) })
          .on('click', () => onAccommodationSelect(stay.externalId))
          .addTo(layer);
      });
    } else {
      places.filter(validPoint).forEach((place) => {
        leaflet.marker([place.latitude, place.longitude], { icon: placeIcon(leaflet, place, selectedPlaceId === place.id) })
          .on('click', () => onPlaceSelect(place.id))
          .addTo(layer);
      });
      discoveries.filter(validPoint).forEach((discovery) => {
        leaflet.marker([discovery.latitude, discovery.longitude], { icon: discoveryIcon(leaflet, discovery) })
          .on('click', () => onDiscoverySelect?.(discovery))
          .addTo(layer);
      });
      aiCandidates.forEach((candidate) => {
        const point = candidatePoint(candidate);
        if (!point) return;
        leaflet.marker([point.latitude, point.longitude], { icon: aiCandidateIcon(leaflet, candidate, selectedAiCandidateId === candidate.id) })
          .on('click', () => onAiCandidateSelect?.(candidate))
          .addTo(layer);
      });
      liveLocations.filter(validPoint).forEach((location) => {
        leaflet.marker([location.latitude, location.longitude], { icon: liveLocationIcon(leaflet, location) }).addTo(layer);
      });
    }

    const points = allPoints(places, accommodations, aiCandidates, showStays);
    if (!fittedInitialDataRef.current && points.length > 0) {
      fitMap(map, leaflet, points);
      fittedInitialDataRef.current = true;
    }
  }, [accommodations, aiCandidates, discoveries, liveLocations, onAccommodationSelect, onAiCandidateSelect, onDiscoverySelect, onPlaceSelect, places, ready, routes, selectedAccommodationId, selectedAiCandidateId, selectedPlaceId, showStays]);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!ready || !leaflet || !map || !fitKey || lastFitKeyRef.current === fitKey) return;
    fitMap(map, leaflet, allPoints(places, accommodations, aiCandidates, showStays));
    fittedInitialDataRef.current = true;
    lastFitKeyRef.current = fitKey;
  }, [accommodations, aiCandidates, fitKey, places, ready, showStays]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focusLocation || lastFocusKeyRef.current === focusLocation.key) return;
    map.setView(
      [focusLocation.latitude, focusLocation.longitude],
      Math.max(2, Math.min(19, focusLocation.zoom ?? Math.max(map.getZoom(), 14))),
      { animate: true },
    );
    lastFocusKeyRef.current = focusLocation.key;
  }, [focusLocation, ready]);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(Math.max(2, Math.min(19, map.getZoom() + delta)));
  }

  function resetView() {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    fitMap(map, leaflet, allPoints(places, accommodations, aiCandidates, showStays));
  }

  useEffect(() => {
    if (!ready) return;
    function handleLocate() {
      const map = mapRef.current;
      if (!map || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          map.setView([position.coords.latitude, position.coords.longitude], Math.max(map.getZoom(), 14), { animate: true });
        },
        () => resetView(),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
    window.addEventListener('trip-map-locate', handleLocate);
    return () => window.removeEventListener('trip-map-locate', handleLocate);
  }, [ready, places, accommodations, aiCandidates, showStays]);

  return (
    <div className="map real-map">
      <div ref={containerRef} className="leaflet-map" />

      <div className="map-control" aria-label="Ovládání mapy">
        <button type="button" onClick={() => zoomBy(1)} title="Přiblížit">+</button>
        <button type="button" onClick={() => zoomBy(-1)} title="Oddálit">-</button>
        <button type="button" onClick={resetView} title="Vycentrovat">⌖</button>
      </div>

      {children}
    </div>
  );
}
