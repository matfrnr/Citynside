import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { POI } from '../../types';

interface InteractiveMapProps {
  lat: number;
  lon: number;
  neighborhoodName?: string;
  pois: POI[];
  selectedCategory: string | null;
  onSelectLocation?: (lat: number, lon: number) => void;
  height?: string;
  zoom?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  lat,
  lon,
  neighborhoodName: _neighborhoodName,
  pois,
  selectedCategory,
  onSelectLocation,
  height = '100%',
  zoom = 15,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.Polygon | null>(null);
  const mainPinMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lon], zoom);

      // CartoDB Voyager : cartographie propre, claire, moderne
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Dedicated layer for POIs
      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;

      // Handle map clicks
      if (onSelectLocation) {
        map.on('click', (e) => {
          onSelectLocation(e.latlng.lat, e.latlng.lng);
        });
      }

      mapInstanceRef.current = map;
    }

    return () => {
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

    map.setView([lat, lon], zoom, { animate: true });

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

    // 3. Neighborhood polygon boundary matching Mockup 2
    if (boundaryLayerRef.current) {
      boundaryLayerRef.current.remove();
    }

    const dLat = 0.0042;
    const dLon = 0.0052;
    const polygonCoords: L.LatLngExpression[] = [
      [lat + dLat * 0.95, lon - dLon * 0.55],
      [lat + dLat * 1.05, lon + dLon * 0.45],
      [lat - dLat * 0.35, lon + dLon * 0.85],
      [lat - dLat * 1.05, lon + dLon * 0.35],
      [lat - dLat * 0.75, lon - dLon * 0.65],
    ];

    const poly = L.polygon(polygonCoords, {
      color: '#6aa382',
      weight: 3.5,
      opacity: 0.95,
      fillColor: '#8ea885',
      fillOpacity: 0.09,
    }).addTo(map);

    boundaryLayerRef.current = poly;
  }, [lat, lon, zoom]);

  // Update POI markers when POIs or category filter changes
  useEffect(() => {
    const markersGroup = markersLayerRef.current;
    if (!markersGroup) return;

    markersGroup.clearLayers();

    const filteredPOIs = selectedCategory
      ? pois.filter((p) => p.category === selectedCategory)
      : pois;

    const categoryColors: Record<string, string> = {
      transports: '#2563eb',
      commerces: '#d97706',
      ecoles: '#7c3aed',
      sante: '#dc2626',
      espaces_verts: '#16a34a',
      stationnement: '#475569',
    };

    filteredPOIs.forEach((poi) => {
      const color = categoryColors[poi.category] || '#059669';

      const poiIcon = L.divIcon({
        className: 'cyt-poi-icon',
        html: `
          <div class="poi-bubble" style="background-color: ${color};" title="${poi.name}">
            <div class="poi-center"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([poi.lat, poi.lon], { icon: poiIcon });
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 4px;">
          <strong style="color: #122c25; font-size: 13px;">${poi.name}</strong><br/>
          <span style="font-size: 11px; color: #647a70;">${poi.subType} — <b>${poi.distanceMeters}m</b></span>
        </div>
      `);
      markersGroup.addLayer(marker);
    });
  }, [pois, selectedCategory]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  return (
    <div className="interactive-map-wrapper" style={{ height }}>
      <div ref={mapContainerRef} className="map-inner-container" />

      {/* Floating Tactical Tablet Controls (+ / -) matching mockup 2 */}
      <div className="map-tablet-controls">
        <button className="map-zoom-btn" onClick={handleZoomIn} aria-label="Zoomer">
          +
        </button>
        <button className="map-zoom-btn" onClick={handleZoomOut} aria-label="Dézoomer">
          −
        </button>
      </div>

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

        /* POI Markers */
        .poi-bubble {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .poi-bubble:hover {
          transform: scale(1.4);
        }

        .poi-center {
          width: 5px;
          height: 5px;
          background: white;
          border-radius: 50%;
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
      `}</style>
    </div>
  );
};
