import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ArrowRight, X, Loader2 } from 'lucide-react';
import { searchAddress } from '../../services/banApi';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with initialValue if it changes externally
  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

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

  // Debounced search with BAN API
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchAddress(query);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsSearching(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item: AddressResult) => {
    setQuery(item.label);
    setIsOpen(false);
    onSelectAddress(item);
  };

  const handleTrigger = async () => {
    setIsOpen(false);
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
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
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTrigger();
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
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une adresse (ex: 3 rue Galilée, Grenoble)..."
          />
          {query.length > 0 && (
            <button className="clear-btn" onClick={() => setQuery('')} aria-label="Effacer">
              <X size={16} />
            </button>
          )}
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

      {/* Autocomplete Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          <div className="dropdown-header">Base Adresse Nationale (BAN)</div>
          <ul className="suggestions-list">
            {suggestions.map((item: AddressResult) => (
              <li
                key={item.id}
                className="suggestion-item"
                onClick={() => handleSelect(item)}
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

        .clear-btn {
          color: rgba(255, 255, 255, 0.5);
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.15s ease;
        }
        .clear-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.12);
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
      `}</style>
    </div>
  );
};
