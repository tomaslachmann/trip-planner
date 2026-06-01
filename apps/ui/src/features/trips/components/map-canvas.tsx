'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LatLngExpression, LayerGroup, Map as LeafletMap } from 'leaflet';
import { categoryKey } from '../lib/format';
import type { Accommodation, DiscoveryPlace, LiveLocation, Place, RoutePlan } from '../types';

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

function allPoints(places: Place[], accommodations: Accommodation[], showStays?: boolean) {
  const points: Point[] = showStays ? accommodations : places;
  return points.filter(validPoint);
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
        <span class="mk mk-${cls}"></span>
        <span class="pin-label">${escapeHtml(place.name)}</span>
      </div>
    `,
    iconSize: [150, 58],
    iconAnchor: [75, 50],
  });
}

function stayIcon(leaflet: LeafletModule, stay: Accommodation, selected: boolean) {
  const price = stay.priceDisplay ?? `${stay.priceTotal ?? '-'} ${stay.currency ?? ''}`;
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-stay-pin ${selected ? 'sel' : ''}">
        <span class="stay-marker"></span>
        <span class="pill">${escapeHtml(price.trim())}</span>
      </div>
    `,
    iconSize: [118, 58],
    iconAnchor: [59, 50],
  });
}

function discoveryIcon(leaflet: LeafletModule, discovery: DiscoveryPlace) {
  const cls = discovery.category === 'FOOD' ? 'food' : discovery.category === 'ACTIVITY' ? 'act' : discovery.category === 'TRANSPORT' ? 'trans' : 'see';
  return leaflet.divIcon({
    className: '',
    html: `
      <div class="leaflet-trip-pin discovery">
        <span class="mk mk-${cls}"></span>
        <span class="pin-label">${escapeHtml(discovery.name)}</span>
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
  liveLocations = [],
  routes,
  selectedPlaceId,
  selectedAccommodationId,
  onPlaceSelect,
  onAccommodationSelect,
  onDiscoverySelect,
  onViewportChange,
  showStays,
  children,
}: {
  places: Place[];
  accommodations: Accommodation[];
  discoveries?: DiscoveryPlace[];
  liveLocations?: LiveLocation[];
  routes: RoutePlan[];
  selectedPlaceId?: string;
  selectedAccommodationId?: string;
  onPlaceSelect: (placeId: string) => void;
  onAccommodationSelect: (accommodationId: string) => void;
  onDiscoverySelect?: (discovery: DiscoveryPlace) => void;
  onViewportChange?: (center: { latitude: number; longitude: number; zoom: number }) => void;
  showStays?: boolean;
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletModule | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const fittedInitialDataRef = useRef(false);
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
        const center = map.getCenter();
        if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
        onViewportChange?.({ latitude: center.lat, longitude: center.lng, zoom: map.getZoom() });
      };

      const initialPoints = allPoints(places, accommodations, showStays);
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
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !leaflet || !map || !layer) return;

    layer.clearLayers();

    for (const route of routes) {
      for (const leg of route.legs ?? []) {
        if (!leg.encodedPolyline) continue;
        const line = decodePolyline(leg.encodedPolyline);
        if (line.length < 2) continue;
        leaflet.polyline(line, {
          color: '#18181b',
          weight: 4,
          opacity: 0.72,
          dashArray: route.locked ? undefined : '7 7',
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
      liveLocations.filter(validPoint).forEach((location) => {
        leaflet.marker([location.latitude, location.longitude], { icon: liveLocationIcon(leaflet, location) }).addTo(layer);
      });
    }

    const points = allPoints(places, accommodations, showStays);
    if (!fittedInitialDataRef.current && points.length > 0) {
      fitMap(map, leaflet, points);
      fittedInitialDataRef.current = true;
    }
  }, [accommodations, discoveries, liveLocations, onAccommodationSelect, onDiscoverySelect, onPlaceSelect, places, ready, routes, selectedAccommodationId, selectedPlaceId, showStays]);

  function zoomBy(delta: number) {
    const map = mapRef.current;
    if (!map) return;
    map.setZoom(Math.max(2, Math.min(19, map.getZoom() + delta)));
  }

  function resetView() {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    fitMap(map, leaflet, allPoints(places, accommodations, showStays));
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
  }, [ready, places, accommodations, showStays]);

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
