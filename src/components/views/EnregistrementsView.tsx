import { useState } from 'react';
import { Bookmark, Search, Building2, ArrowRight, Calendar, Star } from 'lucide-react';
import type { NeighborhoodAnalysis } from '../../types';

interface EnregistrementsViewProps {
  analyses: NeighborhoodAnalysis[];
  onSelectAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onToggleFavorite: (id: string) => void;
}

export const EnregistrementsView: React.FC<EnregistrementsViewProps> = ({
  analyses,
  onSelectAnalysis,
  onToggleFavorite,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const filtered = analyses.filter((item) => {
    const matchesSearch =
      item.neighborhoodName.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.city.toLowerCase().includes(filterQuery.toLowerCase()) ||
      item.address.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesFav = onlyFavorites ? item.isFavorite : true;
    return matchesSearch && matchesFav;
  });

  return (
    <div className="enregistrements-container">
      <div className="enreg-header">
        <h1 className="enreg-title">Historique & Favoris</h1>
        <p className="enreg-subtitle">
          Retrouvez toutes vos analyses de biens et régénérez vos rapports clients
        </p>
      </div>

      {/* Filter and search bar */}
      <div className="enreg-toolbar">
        <div className="search-filter-box">
          <Search size={16} className="s-icon" />
          <input
            type="text"
            placeholder="Rechercher par adresse ou quartier..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>

        <button
          className={`filter-btn ${onlyFavorites ? 'active' : ''}`}
          onClick={() => setOnlyFavorites(!onlyFavorites)}
        >
          <Star size={15} fill={onlyFavorites ? 'currentColor' : 'none'} />
          <span>Favoris uniquement ({analyses.filter((a) => a.isFavorite).length})</span>
        </button>
      </div>

      {/* Grid of cards */}
      <div className="enreg-grid">
        {filtered.map((item) => (
          <div key={item.id} className="enreg-card cyt-card">
            <div className="card-top">
              <div className="title-area">
                <Building2 size={18} className="b-icon" />
                <div>
                  <h3 className="card-name">{item.neighborhoodName}</h3>
                  <span className="card-address">{item.address}, {item.city}</span>
                </div>
              </div>
              <button
                className={`fav-btn ${item.isFavorite ? 'favorited' : ''}`}
                onClick={() => onToggleFavorite(item.id)}
              >
                <Bookmark size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="card-indicators-row">
              <div className="score-box">
                <span className="score-val">{item.globalScore.toFixed(1)}</span>
                <span className="score-label">Score global</span>
              </div>
              <div className="categories-mini-pills">
                {item.categories.slice(0, 3).map((c) => (
                  <span key={c.category} className="mini-pill">
                    {c.label.split(' ')[0]}: <b>{c.score.toFixed(1)}</b>
                  </span>
                ))}
              </div>
            </div>

            <div className="card-bottom">
              <span className="date-tag">
                <Calendar size={12} />
                {new Date(item.createdAt).toLocaleDateString('fr-FR')}
              </span>
              <button className="btn-outline" onClick={() => onSelectAnalysis(item)}>
                <span>Voir le rapport</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .enregistrements-container {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding-bottom: 40px;
        }

        .enreg-header {
          text-align: center;
        }

        .enreg-title {
          font-size: 2rem;
          color: #173830;
          font-weight: 800;
        }

        .enreg-subtitle {
          font-size: 0.92rem;
          color: var(--color-text-muted);
          margin-top: 4px;
        }

        .enreg-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .search-filter-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 8px 16px;
          flex: 1;
          max-width: 420px;
        }

        .search-filter-box input {
          border: none;
          background: transparent;
          width: 100%;
          font-size: 0.88rem;
          color: var(--color-text-main);
        }

        .s-icon {
          color: var(--color-text-muted);
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: #ffffff;
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--color-text-muted);
          transition: var(--transition-default);
        }

        .filter-btn.active {
          background: #9cbca4;
          color: #143027;
          border-color: #9cbca4;
        }

        .enreg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 18px;
        }

        .enreg-card {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #ffffff;
        }

        .card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .title-area {
          display: flex;
          gap: 10px;
        }

        .b-icon {
          color: #173830;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .card-name {
          font-size: 1rem;
          font-weight: 800;
          color: #173830;
        }

        .card-address {
          font-size: 0.78rem;
          color: var(--color-text-muted);
        }

        .fav-btn {
          color: #9cb1a5;
        }
        .fav-btn.favorited {
          color: #1b4b3e;
        }

        .card-indicators-row {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #f7faf7;
          padding: 10px 14px;
          border-radius: var(--radius-xs);
        }

        .score-box {
          display: flex;
          flex-direction: column;
        }

        .score-val {
          font-size: 1.4rem;
          font-weight: 800;
          color: #173830;
          line-height: 1;
        }

        .score-label {
          font-size: 0.65rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          font-weight: 700;
        }

        .categories-mini-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .mini-pill {
          font-size: 0.72rem;
          background: #ffffff;
          border: 1px solid var(--color-border);
          padding: 3px 8px;
          border-radius: 4px;
          color: #3b5047;
        }

        .card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 4px;
        }

        .date-tag {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>
    </div>
  );
};
