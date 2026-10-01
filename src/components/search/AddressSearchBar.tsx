import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ArrowRight, X, Loader2, LocateFixed, AlertCircle, CheckCircle2 } from 'lucide-react';
import { searchAddress, reverseGeocode, getApproximateLocationByIp } from '../../services/banApi';
import type { AddressResult } from '../../types';

interface AddressSearchBarProps {
  initialValue?: string;
  onSelectAddress: (result: AddressResult) => void;
  onTriggerAnalysis?: () => void;
  isLoading?: boolean;
}

export const AddressSearchBar: React.FC<AddressSearchBarProps> = ({
  initialValue = '',
  onSelectAddress,
  onTriggerAnalysis,
  isLoading = false,
}) => {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Auto-effacement du message de feedback après 6 secondes
  useEffect(() => {
    if (geoFeedback) {
      const timer = setTimeout(() => setGeoFeedback(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [geoFeedback]);

  // Sync with initialValue when analysis changes: DO NOT SEARCH, keep dropdown closed
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setQuery(initialValue);
    setSuggestions([]);
    setIsOpen(false);
  }, [initialValue]);

  // Fermer immédiatement et annuler toute recherche dès que l'analyse démarre
  useEffect(() => {
    if (isLoading) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setIsOpen(false);
      setSuggestions([]);
    }
  }, [isLoading]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Handle outside clicks to close autocomplete
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Recherche BAN déclenchée EXCLUSIVEMENT par la saisie manuelle de l'utilisateur
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setActiveSuggestion(0);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAddress(val);
      setIsSearching(false);
      setSuggestions(results);
      setActiveSuggestion(0);
      setIsOpen(true);
    }, 220);
  };

  const handleSelect = (item: AddressResult) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setQuery(item.label);
    setSuggestions([]);
    setIsOpen(false);
    onSelectAddress(item);
  };

  /**
   * Géolocalisation résiliente :
   * 1. Tentative haute précision (timeout 10s au lieu de 5s pour éviter l'échec au premier clic sur PC/Windows)
   * 2. En cas de timeout/indisponibilité GPS, bascule automatique et instantanée en précision standard (Wi-Fi/réseau)
   * 3. Si le navigateur ou Windows bloque, fallback automatique par localisation IP
   */
  const handleGeolocation = async () => {
    if (isGeolocating || isLoading) return;

    setGeoFeedback(null);
    setIsGeolocating(true);

    const getPosition = (opts: PositionOptions): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('GEOLOCATION_UNSUPPORTED'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, opts);
      });
    };

    let coords: { latitude: number; longitude: number } | null = null;
    let isApproximate = false;

    try {
      // 1ère tentative : Haute précision avec timeout étendu (10s) et cache toléré (2 min)
      try {
        const pos = await getPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch (err: any) {
        // Code 3 = TIMEOUT, Code 2 = POSITION_UNAVAILABLE
        // Si la haute précision échoue, tenter immédiatement sans attendre en précision standard
        if (err?.code === 3 || err?.code === 2) {
          console.warn('Haute précision indisponible/délai dépassé, tentative précision standard...');
          const pos = await getPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
          coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      console.warn('Géolocalisation navigateur indisponible, essai fallback IP réseau...', err);
      // Tentative de localisation IP
      const ipLoc = await getApproximateLocationByIp();
      if (ipLoc) {
        coords = { latitude: ipLoc.lat, longitude: ipLoc.lon };
        isApproximate = true;
      } else {
        if (err?.code === 1) {
          setGeoFeedback({
            type: 'error',
            text: "Localisation refusée : autorisez l'accès dans votre navigateur (cadenas 🔒 en haut à gauche)."
          });
        } else {
          setGeoFeedback({
            type: 'error',
            text: 'Impossible de récupérer votre position. Veuillez taper votre adresse directement.'
          });
        }
        setIsGeolocating(false);
        return;
      }
    }

    if (!coords) {
      setIsGeolocating(false);
      return;
    }

    try {
      const result = await reverseGeocode(coords.latitude, coords.longitude);
      if (result) {
        handleSelect(result);
        if (isApproximate) {
          setGeoFeedback({
            type: 'info',
            text: `Position approximative réseau (${result.city || 'secteur'}). Précisez l'adresse si besoin.`
          });
        }
      } else {
        // Si l'adresse exacte n'est pas identifiée par la BAN, créer une position exploitable
        const fallbackResult: AddressResult = {
          id: `${coords.latitude}_${coords.longitude}`,
          label: `Position détectée (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
          name: 'Position détectée',
          postcode: '',
          citycode: '',
          city: '',
          context: 'France',
          type: 'locality',
          coordinates: [coords.longitude, coords.latitude],
          lon: coords.longitude,
          lat: coords.latitude,
        };
        handleSelect(fallbackResult);
      }
    } catch (error) {
      console.error('Erreur lors du géocodage inverse:', error);
      setGeoFeedback({
        type: 'error',
        text: "Erreur lors de la récupération de l'adresse pour cette position."
      });
    } finally {
      setIsGeolocating(false);
    }
  };

  const handleTrigger = async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsOpen(false);
    setSuggestions([]);

    if (suggestions.length > 0) {
      handleSelect(suggestions[activeSuggestion] || suggestions[0]);
    } else if (query.trim().length >= 3) {
      setIsSearching(true);
      const results = await searchAddress(query);
      setIsSearching(false);
      if (results.length > 0) {
        handleSelect(results[0]);
      } else if (onTriggerAnalysis) {
        onTriggerAnalysis();
      }
    } else if (onTriggerAnalysis) {
      onTriggerAnalysis();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setIsOpen(true);
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setActiveSuggestion((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && isOpen && suggestions[activeSuggestion]) {
      e.preventDefault();
      handleSelect(suggestions[activeSuggestion]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleTrigger();
    } else if (e.key === 'Escape') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setIsOpen(false);
    }
  };

  return (
    <div className="search-bar-container" ref={containerRef}>
      <div className="search-pill-wrapper">
        <div className="search-input-left">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            className="search-input"
            value={query}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls="address-suggestions"
            aria-activedescendant={isOpen && suggestions[activeSuggestion] ? `address-option-${activeSuggestion}` : undefined}
            onChange={handleInputChange}
            onFocus={() => {
              // Ne réaffiche que si l'utilisateur a déjà des suggestions et tape activement
              if (!isLoading && suggestions.length > 0 && query.trim().length >= 3) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une adresse (ex: 3 rue Galilée, Grenoble)..."
          />
          {query.length > 0 && (
            <button
              className="icon-btn"
              onClick={() => {
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                setQuery('');
                setSuggestions([]);
                setIsOpen(false);
                setActiveSuggestion(0);
              }}
              aria-label="Effacer"
              type="button"
            >
              <X size={16} />
            </button>
          )}
          <button
            className="icon-btn"
            onClick={handleGeolocation}
            disabled={isGeolocating || isLoading || isSearching}
            aria-label="Me géolocaliser"
            title="Me géolocaliser"
            type="button"
          >
            {isGeolocating ? <Loader2 size={16} className="spin-icon" /> : <LocateFixed size={16} />}
          </button>
        </div>

        <button
          className="btn-analyser"
          onClick={handleTrigger}
          disabled={isLoading || isSearching}
        >
          {isLoading || isSearching ? (
            <>
              <Loader2 size={16} className="spin-icon" />
              <span>Analyse...</span>
            </>
          ) : (
            <>
              <span>Analyser</span>
              <ArrowRight size={17} strokeWidth={2.4} />
            </>
          )}
        </button>
      </div>

      {/* Message de statut / retour géolocalisation non intrusif */}
      {geoFeedback && (
        <div className={`geo-feedback-banner ${geoFeedback.type}`}>
          <div className="geo-feedback-content">
            {geoFeedback.type === 'error' ? (
              <AlertCircle size={15} className="geo-icon" />
            ) : (
              <CheckCircle2 size={15} className="geo-icon" />
            )}
            <span className="geo-text">{geoFeedback.text}</span>
          </div>
          <button
            type="button"
            className="geo-close-btn"
            onClick={() => setGeoFeedback(null)}
            aria-label="Fermer"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Autocomplete Dropdown */}
      {!isLoading && isOpen && query.trim().length >= 3 && (
        <div className="autocomplete-dropdown">
          <div className="dropdown-header">{isSearching ? 'Recherche d’adresse…' : 'Adresses correspondantes'}</div>
          {isSearching ? <p className="search-empty-state">Recherche dans la Base Adresse Nationale…</p> : suggestions.length === 0 ? <p className="search-empty-state">Aucune adresse trouvée. Essayez avec un numéro, une rue ou une autre commune.</p> : null}
          <ul className="suggestions-list" id="address-suggestions" role="listbox">
            {suggestions.map((item: AddressResult, index) => (
              <li
                key={item.id}
                id={`address-option-${index}`}
                role="option"
                aria-selected={index === activeSuggestion}
                className={`suggestion-item ${index === activeSuggestion ? 'active' : ''}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveSuggestion(index)}
              >
                <div className="item-pin-wrap">
                  <MapPin size={16} />
                </div>
                <div className="item-content">
                  <span className="item-title">{item.name}</span>
                  <span className="item-subtitle">
                    {item.postcode} {item.city} • {item.context}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        /* SearchBar — Charte Citynside V1 */
        .search-bar-container {
          position: relative;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
        }

        /* Fond #153a3d (couleur principale charte V1) */
        .search-pill-wrapper {
          display: flex;
          align-items: center;
          background: var(--color-primary);
          border-radius: var(--radius-full);
          padding: 6px 6px 6px 22px;
          box-shadow: 0 10px 32px rgba(21, 58, 61, 0.25);
          border: 1px solid rgba(157, 197, 153, 0.18);
          transition: var(--transition-fast);
          min-height: 56px;
        }

        .search-pill-wrapper:focus-within {
          box-shadow: 0 12px 36px rgba(21, 58, 61, 0.32);
          border-color: rgba(157, 197, 153, 0.45);
        }

        .search-input-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
        }

        /* Icône loupe en vert de la charte */
        .search-icon {
          color: var(--color-green);
          flex-shrink: 0;
        }

        .search-input {
          font-family: var(--font-family-body);
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 0.97rem;
          font-weight: 400;
          width: 100%;
          padding-right: 6px;
        }

        .search-input::placeholder {
          color: rgba(255, 255, 255, 0.45);
          font-weight: 400;
        }

        .icon-btn {
          color: rgba(255, 255, 255, 0.5);
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.15s ease, color 0.15s ease;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .icon-btn:hover:not(:disabled) {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.12);
        }
        .icon-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Bouton Analyser — Jaune #f1e850 (accent fort charte V1) */
        .btn-analyser {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: var(--color-yellow);
          color: var(--color-text-on-yellow);
          font-family: var(--font-family-body);
          font-weight: 700;
          font-size: 0.95rem;
          padding: 11px 22px;
          border-radius: var(--radius-full);
          transition: var(--transition-smooth);
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 3px 12px rgba(241, 232, 80, 0.35);
        }

        .btn-analyser:hover:not(:disabled) {
          background-color: var(--color-yellow-hover);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(241, 232, 80, 0.48);
        }

        .btn-analyser:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-analyser:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Dropdown autocomplete */
        .autocomplete-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: #ffffff;
          border-radius: var(--radius-md);
          box-shadow: 0 16px 40px rgba(21, 58, 61, 0.16);
          border: 1px solid var(--color-border);
          overflow: hidden;
          z-index: 1000;
          animation: dropDown 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        @keyframes dropDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          font-family: var(--font-family-body);
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-subtle);
          padding: 12px 18px 8px;
          background: var(--color-bg-app);
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .suggestions-list {
          list-style: none;
          max-height: 280px;
          overflow-y: auto;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 13px 18px;
          cursor: pointer;
          border-bottom: 1px solid var(--color-border-subtle);
          transition: background 0.12s ease;
        }

        .suggestion-item:last-child {
          border-bottom: none;
        }

        .suggestion-item:hover {
          background-color: var(--color-green-subtle);
        }

        .suggestion-item.active { background-color: var(--color-green-subtle); }
        .search-empty-state { padding: 14px 18px; color: var(--color-text-muted); font-size: .82rem; line-height: 1.45; }

        /* Icône pin en vert de la charte */
        .item-pin-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .item-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-title {
          font-family: var(--font-family-body);
          font-weight: 600;
          font-size: 0.93rem;
          color: var(--color-primary);
        }

        .item-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-muted);
        }

        /* Bannière de statut géolocalisation */
        .geo-feedback-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 0.84rem;
          font-family: var(--font-family-body);
          animation: slideDownFade 0.25s ease-out;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
        }

        .geo-feedback-banner.error {
          background: rgba(230, 57, 70, 0.12);
          border: 1px solid rgba(230, 57, 70, 0.3);
          color: #c92a2a;
        }

        .geo-feedback-banner.info,
        .geo-feedback-banner.success {
          background: rgba(42, 157, 143, 0.14);
          border: 1px solid rgba(42, 157, 143, 0.3);
          color: #1b635c;
        }

        .geo-feedback-content {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .geo-icon {
          flex-shrink: 0;
        }

        .geo-text {
          line-height: 1.35;
        }

        .geo-close-btn {
          background: none;
          border: none;
          cursor: pointer;
          opacity: 0.65;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3px;
          border-radius: 4px;
          transition: opacity 0.15s ease;
          color: inherit;
        }

        .geo-close-btn:hover {
          opacity: 1;
        }

        @keyframes slideDownFade {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
