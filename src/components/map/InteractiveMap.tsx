import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Eye, EyeOff, Maximize2, Minimize2, Navigation, X } from 'lucide-react';
import type { POI } from '../../types';
import type { DistanceUnit } from '../../services/userPreferences';
import { formatDistance } from '../../services/distanceFormat';
import { ANALYSIS_RADIUS_METERS } from '../../services/osmApi';

interface InteractiveMapProps {
  lat: number;
  lon: number;
  neighborhoodName?: string;
  pois: POI[];
  focusPoi?: POI | null;
  controlsVisibleByDefault?: boolean;
  reduceMotion?: boolean;
  distanceUnit?: DistanceUnit;
  selectedCategory: string | null;
  onSelectCategory?: (category: string | null) => void;
  onSelectLocation?: (lat: number, lon: number) => void;
  height?: string;
  zoom?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  lat,
  lon,
  neighborhoodName: _neighborhoodName,
  pois,
  focusPoi = null,
  controlsVisibleByDefault = true,
  reduceMotion = false,
  distanceUnit = 'meters',
  selectedCategory,
  onSelectCategory,
  onSelectLocation,
  height = '100%',
  zoom = 14,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const poiMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const boundaryLayerRef = useRef<L.Layer | null>(null);
  const mainPinMarkerRef = useRef<L.Marker | null>(null);
  const controlsBeforeFullscreenRef = useRef(false);

  // Mode explicite de repositionnement pour naviguer librement sans fausse manipulation
  const [isRepositionMode, setIsRepositionMode] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapControlsVisible, setMapControlsVisible] = useState(() =>
    typeof window === 'undefined' ? controlsVisibleByDefault : !window.matchMedia('(max-width: 767px)').matches && controlsVisibleByDefault,
  );
  const isRepositionModeRef = useRef(false);

  useEffect(() => {
    isRepositionModeRef.current = isRepositionMode;
  }, [isRepositionMode]);

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExpanded(false);
        setMapControlsVisible(controlsBeforeFullscreenRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.invalidateSize({ pan: false });
      map.setView([lat, lon], zoom, { animate: false });
    });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [isExpanded, lat, lon, zoom]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lon], zoom);

      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      const tileUrl = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
        : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

      L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: mapboxToken 
          ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Dedicated layer for POIs
      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;

      // Déplacement strictement sécurisé : uniquement si le mode repositionnement a été activé par le bouton
      map.on('click', (e) => {
        if (isRepositionModeRef.current && onSelectLocation) {
          setIsRepositionMode(false);
          onSelectLocation(e.latlng.lat, e.latlng.lng);
        }
      });

      mapInstanceRef.current = map;
    }

    const container = mapContainerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        mapInstanceRef.current?.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update center, main marker & neighborhood polygon when lat/lon changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([lat, lon], zoom, { animate: !reduceMotion });

    // 1. Remove previous main pin
    if (mainPinMarkerRef.current) {
      mainPinMarkerRef.current.remove();
    }

    // 2. Custom HTML pin icon matching Mockup 2: dark dot + "Emplacement sélectionné" pill tag
    const customMainPin = L.divIcon({
      className: 'cyt-custom-pin',
      html: `
        <div class="pin-anchor">
          <div class="pin-dot"></div>
          <div class="pin-badge">Emplacement sélectionné</div>
        </div>
      `,
      iconSize: [180, 50],
      iconAnchor: [90, 10],
    });

    const mainMarker = L.marker([lat, lon], { icon: customMainPin, zIndexOffset: 1000 }).addTo(map);
    mainPinMarkerRef.current = mainMarker;

    // Cercle du périmètre principal d'analyse ; certaines gares SNCF peuvent apparaître au-delà.
    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.remove();
    }

    const analysisCircle = L.circle([lat, lon], {
      radius: ANALYSIS_RADIUS_METERS,
      color: '#6aa382',
      weight: 2.5,
      opacity: 0.7,
      fillColor: '#8ea885',
      fillOpacity: 0.06,
      dashArray: '8, 6',
    }).addTo(map);

    boundaryLayerRef.current = analysisCircle;
  }, [lat, lon, zoom, reduceMotion]);

  // Update POI markers when POIs or category filter changes
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();
    poiMarkersRef.current.clear();

    const filteredPOIs = pois.filter((poi) =>
      poi.id === focusPoi?.id || poi.distanceMeters <= ANALYSIS_RADIUS_METERS ||
      (poi.category === 'transports' &&
        /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType) &&
        poi.distanceMeters <= 1200),
    ).filter((poi) => !selectedCategory || poi.category === selectedCategory);

    const categoryColors: Record<string, string> = {
      transports: '#1d4ed8',
      commerces: '#d97706',
      ecoles: '#7c3aed',
      sante: '#dc2626',
      espaces_verts: '#15803d',
      stationnement: '#475569',
      loisirs: '#be185d',
      services_publics: '#0e7490',
      tranquillite: '#0f766e',
    };

    // Couleur spécifique par sous-type (ex: pharmacies = vert croix distinctif)
    const getPoiColor = (poi: POI): string => {
      const transportType = poi.subType.toLowerCase();
      if (poi.category === 'transports' && (transportType.includes('gare') || transportType.includes('train'))) {
        return '#c026d3'; // Gares en fuchsia, distinctes des arrêts de bus
      }
      if (poi.category === 'sante' && poi.subType.toLowerCase().includes('pharmacie')) {
        return '#059669'; // Vert pharmacie (croix verte)
      }
      if (poi.category === 'sante' && /hôpital|hopital|clinique|chu/.test(poi.subType.toLowerCase())) {
        return '#991b1b'; // Rouge foncé réservé aux établissements hospitaliers
      }
      return categoryColors[poi.category] || '#059669';
    };

    // Helper SVG icons
    const getMiniSvgIcon = (category: string, subType: string) => {
      const sub = subType.toLowerCase();
      if (category === 'transports') {
        if (sub.includes('vélo')) {
          return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3"/><circle cx="5.5" cy="17.5" r="3"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
        }
        if (sub.includes('gare') || sub.includes('train') || sub.includes('tram') || sub.includes('métro')) {
          return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="5" y="4" rx="2"/><path d="M5 11h14"/><path d="M12 4v7"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="13" x="4" y="5" rx="2"/><path d="M8 5v5"/><path d="M16 5v5"/><path d="M4 12h16"/><path d="M7 18v2"/><path d="M17 18v2"/></svg>';
      }
      if (category === 'commerces') {
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
      }
      if (category === 'ecoles') {
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';
      }
      if (category === 'sante') {
        if (sub.includes('pharmacie')) {
          // Croix de pharmacie
          return '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none"><path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg>';
        }
        if (sub.includes('hôpital') || sub.includes('hopital') || sub.includes('clinique') || sub.includes('chu')) {
          return '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M2 21h20M9 21v-4h6v4M12 6v6M9 9h6"/></svg>';
        }
        // Autres soins (hôpital, médecin, clinique, dentiste)
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
      }
      if (category === 'espaces_verts') {
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19v3"/><path d="M12 2a5 5 0 0 0-5 5c0 .7.1 1.3.4 1.9A4 4 0 0 0 4 13a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4 4 4 0 0 0-3.4-4.1c.3-.6.4-1.2.4-1.9a5 5 0 0 0-5-5Z"/></svg>';
      }
      if (category === 'stationnement') {
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
      }
      if (category === 'loisirs') {
        return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>';
    };

    // Anti-collision pour les points superposés
    const seenPositions = new Map<string, number>();

    filteredPOIs.forEach((poi) => {
      const baseKey = `${poi.lat.toFixed(5)}_${poi.lon.toFixed(5)}`;
      const count = seenPositions.get(baseKey) || 0;
      seenPositions.set(baseKey, count + 1);

      // Décalage micro-spatial en spirale si plusieurs POIs ont la même coordonnée exacte
      let finalLat = poi.lat;
      let finalLon = poi.lon;
      if (count > 0) {
        const angle = count * 1.25;
        const radiusDeg = 0.00008 * Math.sqrt(count); // ~8 mètres
        finalLat += Math.sin(angle) * radiusDeg;
        finalLon += Math.cos(angle) * radiusDeg;
      }

      const color = getPoiColor(poi);
      const iconSvg = getMiniSvgIcon(poi.category, poi.subType);
      const isHospital = poi.category === 'sante' && /hôpital|hopital|clinique|chu/.test(poi.subType.toLowerCase());
      const poiIcon = L.divIcon({
        className: 'cyt-custom-poi-marker',
        html: `
          <div class="cyt-pin-pin${isHospital ? ' hospital-marker' : ''}" style="--pin-bg: ${color};" title="${poi.name}">
            <div class="cyt-pin-head">
              <span class="cyt-pin-svg">${iconSvg}</span>
            </div>
            <div class="cyt-pin-arrow"></div>
          </div>
        `,
        iconSize: [28, 34],
        iconAnchor: [14, 34],
        popupAnchor: [0, -32],
      });

      const isRailStation = poi.category === 'transports' && /gare ferroviaire|arrêt ferroviaire/i.test(poi.subType);
      const marker = L.marker([finalLat, finalLon], {
        icon: poiIcon,
        zIndexOffset: isRailStation ? 1200 : 0,
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
      });
      marker.bindPopup(`
        <div class="cyt-map-popup-card">
          <div class="popup-badge" style="background-color: ${color}18; color: ${color}; border: 1px solid ${color}40;">
            ${poi.subType}
          </div>
          <h4 class="popup-title">${poi.name}</h4>
          <div class="popup-meta">
            <span class="popup-distance">📍 <b>${formatDistance(poi.distanceMeters, distanceUnit)}</b></span>
          </div>
        </div>
      `);
      markersGroup.addLayer(marker);
      poiMarkersRef.current.set(poi.id, marker);
    });
  }, [pois, selectedCategory, focusPoi?.id, distanceUnit]);

  useEffect(() => {
    if (!focusPoi) return;
    const map = mapInstanceRef.current;
    const marker = poiMarkersRef.current.get(focusPoi.id);
    if (!map || !marker) return;
    const target = L.latLng(focusPoi.lat, focusPoi.lon);
    const zoomLevel = Math.max(map.getZoom(), 16);
    if (map.getCenter().distanceTo(target) < 5 && map.getZoom() >= zoomLevel) {
      marker.openPopup();
      return;
    }
    if (reduceMotion) {
      map.setView(target, zoomLevel, { animate: false });
      marker.openPopup();
      return;
    }
    map.once('moveend', () => marker.openPopup());
    map.flyTo(target, zoomLevel, { duration: 0.7 });
  }, [focusPoi, pois, selectedCategory, reduceMotion]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (reduceMotion) map.setView([lat, lon], zoom, { animate: false });
    else map.flyTo([lat, lon], zoom, { duration: 0.8 });
  };

  const handleToggleExpanded = () => {
    const nextExpanded = !isExpanded;
    if (nextExpanded) controlsBeforeFullscreenRef.current = mapControlsVisible;
    setIsExpanded(nextExpanded);
    setMapControlsVisible(nextExpanded ? false : controlsBeforeFullscreenRef.current);
  };

  return (
    <div
      className={`interactive-map-wrapper ${isRepositionMode ? 'reposition-mode-active' : ''} ${isExpanded ? 'is-expanded' : ''}`}
      style={{ height }}
    >
      <div ref={mapContainerRef} className="map-inner-container" />

      <div className="map-top-controls">
        <button
          className={`map-controls-toggle${mapControlsVisible ? '' : ' is-controls-hidden'}`}
          type="button"
          onClick={() => setMapControlsVisible((visible) => !visible)}
          aria-label={mapControlsVisible ? 'Masquer les commandes de la carte' : 'Afficher les commandes de la carte'}
          aria-pressed={mapControlsVisible}
          title={mapControlsVisible ? 'Masquer les commandes' : 'Afficher les commandes'}
        >
          {mapControlsVisible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
        {mapControlsVisible && (
          <>
            <button
              className="map-expand-btn"
              type="button"
              onClick={handleToggleExpanded}
              aria-label={isExpanded ? 'Réduire la carte' : 'Afficher la carte en plein écran'}
              title={isExpanded ? 'Réduire la carte (Échap)' : 'Afficher la carte en plein écran'}
            >
              {isExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              <span>{isExpanded ? 'Réduire' : 'Plein écran'}</span>
            </button>
            {!isRepositionMode && onSelectLocation && (
              <button
                className="map-reposition-trigger-btn"
                onClick={() => setIsRepositionMode(true)}
                title="Activer pour choisir un nouvel emplacement sur la carte"
              >
                <Crosshair size={14} />
                <span>Déplacer l'adresse</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Bannière active de repositionnement */}
      {isRepositionMode ? (
        <div className="map-reposition-banner">
          <div className="banner-content">
            <Crosshair size={16} className="spin-slow" />
            <span><b>Mode déplacement :</b> Cliquez sur la carte à l'endroit désiré</span>
          </div>
          <button
            className="banner-cancel-btn"
            onClick={() => setIsRepositionMode(false)}
          >
            <X size={14} />
            <span>Annuler</span>
          </button>
        </div>
      ) : null}

      {/* Badge indicateur de filtre actif pour transparence totale */}
      {mapControlsVisible && selectedCategory && (
        <div className="map-filter-active-pill">
          <span>Filtre carte : <b>{selectedCategory}</b> ({pois.filter(p => p.category === selectedCategory).length} affichés)</span>
          {onSelectCategory && (
            <button
              className="map-filter-reset-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCategory(null);
              }}
              title="Afficher tous les équipements"
            >
              ✕ Tout afficher
            </button>
          )}
        </div>
      )}

      {/* Floating Tactical Tablet Controls (+ / - / Recentrer) matching mockup 2 */}
      {mapControlsVisible && <div className="map-tablet-controls">
        <button
          className="map-zoom-btn"
          onClick={handleRecenter}
          title="Recentrer sur l'adresse sélectionnée"
          aria-label="Recentrer"
        >
          <Navigation size={18} />
        </button>
        <button className="map-zoom-btn map-zoom-step-btn" onClick={handleZoomIn} aria-label="Zoomer">
          +
        </button>
        <button className="map-zoom-btn map-zoom-step-btn" onClick={handleZoomOut} aria-label="Dézoomer">
          −
        </button>
      </div>}

      <style>{`
        .interactive-map-wrapper {
          position: relative;
          width: 100%;
          border-radius: 20px;
          overflow: hidden;
          background: #eef2ed;
          box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.05);
        }

        .map-inner-container {
          width: 100%;
          height: 100%;
        }

        .map-top-controls {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 1300;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .map-controls-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255,255,255,.75);
          border-radius: 11px;
          background: #fff;
          color: #173830;
          box-shadow: 0 4px 14px rgba(0,0,0,.2);
          cursor: pointer;
        }

        .map-controls-toggle:hover { background: #f1f6f0; }
        .map-controls-toggle.is-controls-hidden { background: #173830; color: #fff; border-color: #173830; }
        .map-controls-toggle.is-controls-hidden:hover { background: #255146; }

        .map-expand-btn {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 14px;
          border: 1px solid rgba(255,255,255,.75);
          border-radius: 11px;
          background: #fff;
          color: #173830;
          box-shadow: 0 4px 14px rgba(0,0,0,.2);
          font: inherit;
          font-size: .84rem;
          font-weight: 650;
          cursor: pointer;
        }

        .map-expand-btn:hover { background: #f1f6f0; }

        .interactive-map-wrapper.is-expanded {
          position: fixed;
          inset: 0;
          z-index: 10000;
          width: 100vw;
          height: 100vh !important;
          height: 100dvh !important;
          border-radius: 0;
          box-shadow: none;
        }

        .interactive-map-wrapper.is-expanded .map-top-controls { top: 20px; right: 20px; }

        .map-top-controls .map-reposition-trigger-btn {
          position: static;
          margin: 0;
          min-height: 42px;
        }

        @media (min-width: 768px) {
          .map-expand-btn { display: inline-flex; }
        }

        @media (min-width: 768px) and (max-width: 900px) {
          .map-top-controls .map-expand-btn span,
          .map-top-controls .map-reposition-trigger-btn span { display: none; }
          .map-top-controls .map-expand-btn,
          .map-top-controls .map-reposition-trigger-btn { width: 42px; padding: 0; justify-content: center; }
        }

        /* Custom Main Marker & Badge */
        .cyt-custom-pin .pin-anchor {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }

        .pin-dot {
          width: 20px;
          height: 20px;
          background: #173830;
          border: 3.5px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          animation: pulsePin 2.4s infinite ease-in-out;
        }

        .pin-badge {
          margin-top: 6px;
          background: #ffffff;
          color: #122c25;
          font-weight: 700;
          font-size: 0.76rem;
          padding: 5px 14px;
          border-radius: var(--radius-full);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          white-space: nowrap;
          border: 1px solid #dbe6d9;
          letter-spacing: -0.01em;
        }

        @keyframes pulsePin {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.12); }
        }

        /* Nouveau Marqueur POI haute précision avec mini-icônes */
        .cyt-custom-poi-marker {
          background: transparent;
          border: none;
        }

        .cyt-pin-pin {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.28));
        }

        .cyt-pin-pin:hover {
          transform: translateY(-4px) scale(1.18);
          z-index: 9999 !important;
        }

        .cyt-pin-head {
          width: 28px;
          height: 28px;
          background-color: var(--pin-bg);
          border-radius: 50%;
          border: 2px solid #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .hospital-marker .cyt-pin-head {
          width: 34px;
          height: 34px;
          border-width: 3px;
        }

        .cyt-pin-svg {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .cyt-pin-arrow {
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 6px solid var(--pin-bg);
          margin-top: -1.5px;
        }

        /* Popup personnalisée */
        .cyt-map-popup-card {
          font-family: var(--font-family-body, system-ui);
          padding: 4px;
          min-width: 170px;
        }

        .popup-badge {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 6px;
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .popup-title {
          font-size: 0.88rem;
          font-weight: 700;
          color: #122c25;
          margin: 0 0 6px 0;
          line-height: 1.25;
        }

        .popup-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.74rem;
          color: #5a7275;
          border-top: 1px solid #edf2ed;
          padding-top: 5px;
          gap: 6px;
        }

        /* Active filter pill floating on top-left */
        .map-filter-active-pill {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 500;
          background: rgba(21, 58, 61, 0.92);
          backdrop-filter: blur(8px);
          color: #ffffff;
          padding: 6px 12px;
          border-radius: var(--radius-full);
          font-size: 0.76rem;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.2);
          animation: fadeIn 0.2s ease-out;
        }

        .map-filter-reset-btn {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border: none;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 9999px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .map-filter-reset-btn:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        /* Reposition Mode Controls */
        .map-reposition-trigger-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 500;
          background: #ffffff;
          color: #153a3d;
          border: 1px solid #c8d8cb;
          padding: 7px 13px;
          border-radius: var(--radius-full);
          font-size: 0.78rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 14px rgba(21, 58, 61, 0.12);
          cursor: pointer;
          transition: all 0.18s ease;
        }

        .map-reposition-trigger-btn:hover {
          background: #eef6ed;
          border-color: #9dc599;
          transform: translateY(-1px);
        }

        .map-reposition-banner {
          position: absolute;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 500;
          background: #153a3d;
          color: #ffffff;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
          border: 1.5px solid #9dc599;
          animation: dropIn 0.2s ease-out;
        }

        .map-reposition-banner .banner-content {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .banner-cancel-btn {
          background: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          border: none;
          padding: 3px 9px;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
        }

        .banner-cancel-btn:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        @media (max-width: 600px) {
          .map-reposition-banner {
            top: 10px; left: 10px; right: 10px; width: auto; max-width: none;
            transform: none; justify-content: space-between; align-items: flex-start;
            gap: 8px; padding: 10px 11px; border-radius: 12px; font-size: .73rem;
            animation: dropInMobile .2s ease-out;
          }
          .map-reposition-banner .banner-content { min-width: 0; flex: 1; align-items: flex-start; gap: 7px; line-height: 1.35; }
          .map-reposition-banner .banner-content span { min-width: 0; }
          .banner-cancel-btn { flex: 0 0 auto; padding: 6px 9px; font-size: .68rem; }
        }

        @keyframes dropInMobile {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .interactive-map-wrapper.reposition-mode-active {
          box-shadow: inset 0 0 0 3px #9dc599;
        }

        .interactive-map-wrapper.reposition-mode-active .map-inner-container {
          cursor: crosshair !important;
        }

        @keyframes dropIn {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        /* Tablet Zoom Controls matching Mockup 2 */
        .map-tablet-controls {
          position: absolute;
          bottom: 24px;
          right: 20px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          z-index: 500;
        }

        .map-zoom-btn {
          width: 44px;
          height: 44px;
          background: #1a3931;
          color: #ffffff;
          border-radius: 10px;
          font-size: 1.4rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
          transition: var(--transition-fast);
        }

        .map-zoom-btn:hover {
          background: #255146;
          transform: scale(1.06);
        }

        .map-zoom-btn:active {
          transform: scale(0.96);
        }

        @media (hover: none) and (pointer: coarse) {
          .map-zoom-step-btn { display: none; }
        }
      `}</style>
    </div>
  );
};
