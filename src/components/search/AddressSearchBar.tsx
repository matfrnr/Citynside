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
  initialValue = '3 rue Galilée, 38000 Grenoble',
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
        .search-bar-container {
          position: relative;
          width: 100%;
          max-width: 660px;
          margin: 0 auto;
        }

        .search-pill-wrapper {
          display: flex;
          align-items: center;
          background: #1c362f;
          border-radius: var(--radius-full);
          padding: 6px 8px 6px 20px;
          box-shadow: 0 10px 30px rgba(18, 44, 37, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: var(--transition-fast);
          min-height: 54px;
        }

        .search-pill-wrapper:focus-within {
          box-shadow: 0 12px 34px rgba(18, 44, 37, 0.28);
          border-color: #9cbca4;
        }

        .search-input-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex: 1;
        }

        .search-icon {
          color: #9cbca4;
          flex-shrink: 0;
        }

        .search-input {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 0.98rem;
          font-weight: 500;
          width: 100%;
          padding-right: 6px;
        }

        .search-input::placeholder {
          color: #7b948a;
          font-weight: 400;
        }

        .clear-btn {
          color: #7b948a;
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

        .btn-analyser {
          display: flex;
          align-items: center;
          gap: 8px;
          background-color: #9cbca4;
          color: #0f2720;
          font-weight: 700;
          font-size: 0.96rem;
          padding: 10px 22px;
          border-radius: var(--radius-full);
          transition: var(--transition-fast);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .btn-analyser:hover:not(:disabled) {
          background-color: #add0b6;
          transform: translateY(-1px);
        }

        .btn-analyser:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Autocomplete */
        .autocomplete-dropdown {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          background: #ffffff;
          border-radius: var(--radius-md);
          box-shadow: 0 16px 40px rgba(18, 44, 37, 0.14);
          border: 1px solid #e0eae0;
          overflow: hidden;
          z-index: 1000;
          animation: dropDown 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        @keyframes dropDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .dropdown-header {
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #7b948a;
          padding: 12px 18px 8px;
          background: #f8faf8;
          border-bottom: 1px solid #edf3ec;
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
          padding: 14px 18px;
          cursor: pointer;
          border-bottom: 1px solid #f2f6f1;
          transition: background 0.12s ease;
        }

        .suggestion-item:last-child {
          border-bottom: none;
        }

        .suggestion-item:hover {
          background-color: #f1f7f0;
        }

        .item-pin-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #ebf3eb;
          color: #173830;
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
          font-weight: 700;
          font-size: 0.95rem;
          color: #122c25;
        }

        .item-subtitle {
          font-size: 0.8rem;
          color: #6a7f76;
        }
      `}</style>
    </div>
  );
};
