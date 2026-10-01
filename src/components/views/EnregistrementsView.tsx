import { useEffect, useState } from 'react';
import { Search, Building2, ArrowRight, Calendar, Star, Trash2, Pencil, History } from 'lucide-react';
import type { NeighborhoodAnalysis } from '../../types';

const ITEMS_PER_PAGE = 6;

interface EnregistrementsViewProps {
  analyses: NeighborhoodAnalysis[];
  activeTab: 'history' | 'favorites';
  onSelectAnalysis: (analysis: NeighborhoodAnalysis) => void;
  onToggleFavorite: (id: string) => void;
  onDeleteAnalysis: (id: string) => void;
  onRenameAnalysis: (id: string, newName: string) => void;
}

export const EnregistrementsView: React.FC<EnregistrementsViewProps> = ({
  analyses,
  activeTab,
  onSelectAnalysis,
  onToggleFavorite,
  onDeleteAnalysis,
  onRenameAnalysis,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [minimumScore, setMinimumScore] = useState('all');
  const [sortOrder, setSortOrder] = useState('recent');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  const sourceAnalyses = activeTab === 'favorites'
    ? analyses.filter((item) => item.isFavorite)
    : [...analyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
  const cities = [...new Set(sourceAnalyses.map((item) => item.city.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const filtered = sourceAnalyses.filter((item) => {
    const query = filterQuery.trim().toLocaleLowerCase('fr');
    const matchesSearch =
      (item.neighborhoodName || '').toLocaleLowerCase('fr').includes(query) ||
      item.city.toLocaleLowerCase('fr').includes(query) ||
      item.address.toLocaleLowerCase('fr').includes(query);
    const matchesCity = selectedCity === 'all' || item.city === selectedCity;
    const matchesScore = minimumScore === 'all' || item.globalScore >= Number(minimumScore);
    return matchesSearch && matchesCity && matchesScore;
  }).sort((a, b) => {
    if (sortOrder === 'score-desc') return b.globalScore - a.globalScore;
    if (sortOrder === 'score-asc') return a.globalScore - b.globalScore;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  useEffect(() => setVisibleCount(ITEMS_PER_PAGE), [filterQuery, activeTab, selectedCity, minimumScore, sortOrder]);

  const displayed = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onDeleteAnalysis(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleOpenRename = (item: NeighborhoodAnalysis) => {
    setRenameId(item.id);
    setRenameName(item.neighborhoodName || item.address);
  };

  const handleConfirmRename = () => {
    if (renameId && renameName.trim()) {
      onRenameAnalysis(renameId, renameName.trim());
      setRenameId(null);
    }
  };

  return (
    <div className="enregistrements-container">
      <div className="enreg-header">
        <h1 className="enreg-title">{activeTab === 'history' ? 'Historique' : 'Favoris'}</h1>
        <p className="enreg-subtitle">
          {activeTab === 'history' ? 'Vos 20 recherches les plus récentes, enregistrées automatiquement.' : 'Les analyses que vous avez marquées d’une étoile.'}
        </p>
      </div>

      {/* Filter and search bar */}
      <div className="enreg-toolbar">
        <div className="search-filter-box toolbar-search">
          <Search size={16} className="s-icon" />
          <input
            type="text"
            placeholder="Rechercher par adresse ou nom..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>

        <select className="enreg-select toolbar-city" value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} aria-label="Filtrer par ville">
          <option value="all">Toutes les villes</option>
          {cities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>
        <select className="enreg-select toolbar-score" value={minimumScore} onChange={(e) => setMinimumScore(e.target.value)} aria-label="Filtrer par score minimum">
          <option value="all">Tous les scores</option>
          <option value="5">5/10 et plus</option>
          <option value="7">7/10 et plus</option>
          <option value="8">8/10 et plus</option>
        </select>
        <select className="enreg-select toolbar-sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Trier les analyses">
          <option value="recent">Plus récentes</option>
          <option value="score-desc">Meilleures notes</option>
          <option value="score-asc">Notes les plus basses</option>
        </select>
      </div>

      {/* Counter */}
      <p className="enreg-count">
        {filtered.length} analyse{filtered.length > 1 ? 's' : ''} trouvée{filtered.length > 1 ? 's' : ''}
      </p>

      {/* Grid of cards or Empty state */}
      {displayed.length === 0 ? (
        <div className="enreg-empty">
          {activeTab === 'history' ? <History size={40} strokeWidth={1.4} className="enreg-empty-icon" /> : <Star size={40} strokeWidth={1.4} className="enreg-empty-icon" />}
          <h3>{activeTab === 'favorites' ? "Aucun favori enregistré" : "Aucune recherche récente"}</h3>
          <p>
            {activeTab === 'favorites'
              ? "Ajoutez une analyse à vos favoris en cliquant sur l'icône étoile."
              : filterQuery
                ? "Aucune analyse ne correspond à votre recherche."
                : "Vos analyses sauvegardées apparaîtront ici pour que vous puissiez les consulter depuis n’importe quel appareil."}
          </p>
        </div>
      ) : (
        <div className="enreg-grid">
          {displayed.map((item) => {
            const displayName = item.neighborhoodName || item.address;
            return (
              <div key={item.id} className="enreg-card cyt-card">
                <div className="card-top">
                  <div className="title-area">
                    <Building2 size={18} className="b-icon" />
                    <div>
                      <h3 className="card-name">{displayName}</h3>
                      <span className="card-address">{item.address}, {item.city}</span>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button
                      className="rename-btn"
                      onClick={() => handleOpenRename(item)}
                      title="Renommer"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`fav-btn ${item.isFavorite ? 'favorited' : ''}`}
                      onClick={() => onToggleFavorite(item.id)}
                      title={item.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    >
                      <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => setDeleteConfirmId(item.id)}
                      title="Supprimer cette analyse"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
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
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="enreg-load-more">
          <button
            className="btn-load-more"
            onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
          >
            Voir plus ({filtered.length - visibleCount} restante{filtered.length - visibleCount > 1 ? 's' : ''})
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="delete-modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <Trash2 size={28} className="delete-modal-icon" />
            <h3>Supprimer cette analyse ?</h3>
            <p>Cette action est irréversible. L'analyse sera définitivement supprimée de votre historique.</p>
            <div className="delete-modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirmId(null)}>
                Annuler
              </button>
              <button className="btn-confirm-delete" onClick={handleConfirmDelete}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameId && (
        <div className="delete-modal-overlay" onClick={() => setRenameId(null)}>
          <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
            <Pencil size={28} className="rename-modal-icon" />
            <h3>Renommer l'analyse</h3>
            <div className="rename-field">
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Nom de l'analyse..."
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
              />
            </div>
            <div className="delete-modal-actions">
              <button className="btn-cancel" onClick={() => setRenameId(null)}>
                Annuler
              </button>
              <button className="btn-confirm-save" onClick={handleConfirmRename}>
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* EnregistrementsView — Charte Citynside V1 */
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
          color: var(--color-primary);
          font-weight: 700;
        }

        .enreg-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.9rem;
          color: var(--color-text-muted);
          margin-top: 4px;
          font-weight: 400;
        }

        .enreg-toolbar {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          align-items: center;
          gap: 12px 14px;
        }

        .toolbar-search, .toolbar-favorites, .toolbar-city { grid-column: span 2; width: 100%; min-width: 0; }
        .toolbar-score, .toolbar-sort { grid-column: span 3; width: 100%; min-width: 0; }

        /* Barre de recherche en fond blanc */
        .search-filter-box {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #ffffff;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 9px 18px;
          max-width: none;
          transition: border-color 0.15s ease;
        }

        .search-filter-box:focus-within {
          border-color: var(--color-green);
        }

        .search-filter-box input {
          border: none;
          background: transparent;
          width: 100%;
          font-family: var(--font-family-body);
          font-size: 0.87rem;
          color: var(--color-text-main);
        }

        .s-icon {
          color: var(--color-text-subtle);
        }

        /* Bouton filtre Favoris */
        .filter-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: #ffffff;
          font-family: var(--font-family-body);
          font-size: 0.84rem;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: var(--transition-fast);
        }

        /* Filtre actif en vert #9dc599 */
        .filter-btn.active {
          background: var(--color-green);
          color: var(--color-primary-dark);
          border-color: var(--color-green);
          font-weight: 700;
        }

        .enreg-select { min-height: 40px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: #fff; color: var(--color-primary); font: inherit; font-size: .82rem; }

        @media (max-width: 800px) {
          .enreg-toolbar { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .toolbar-search, .toolbar-favorites { grid-column: span 2; }
          .toolbar-city, .toolbar-score { grid-column: span 1; }
          .toolbar-sort { grid-column: span 2; }
        }

        .enreg-count {
          font-family: var(--font-family-body);
          font-size: 0.82rem;
          color: var(--color-text-subtle);
          margin: -8px 0 0 4px;
        }

        .enreg-empty {
          text-align: center;
          padding: 56px 24px;
          background: #ffffff;
          border: 1px dashed var(--color-border);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: var(--color-text-muted);
        }
        .enreg-empty-icon {
          color: var(--color-border-active);
          margin-bottom: 2px;
        }
        .enreg-empty h3 {
          font-family: var(--font-family-heading);
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--color-primary);
          margin: 0;
        }
        .enreg-empty p {
          max-width: 440px;
          font-size: 0.88rem;
          line-height: 1.5;
          margin: 0;
          color: var(--color-text-muted);
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
          min-width: 0;
          flex: 1;
        }

        .b-icon {
          color: var(--color-primary);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .card-name {
          font-family: var(--font-family-heading);
          font-size: 1rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .card-address {
          font-family: var(--font-family-body);
          font-size: 0.76rem;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .fav-btn {
          color: var(--color-border-active);
          transition: color 0.15s ease;
          padding: 4px;
          border-radius: 6px;
        }
        .fav-btn.favorited {
          color: var(--color-primary);
        }
        .fav-btn:hover {
          color: var(--color-primary-light);
        }

        .delete-btn {
          color: var(--color-text-subtle);
          padding: 4px;
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .delete-btn:hover {
          color: #dc3545;
          background: rgba(220, 53, 69, 0.08);
        }

        /* Zone score en fond vert très clair */
        .card-indicators-row {
          display: flex;
          align-items: center;
          gap: 14px;
          background: var(--color-green-subtle);
          padding: 10px 14px;
          border-radius: var(--radius-xs);
          border: 1px solid var(--color-border-subtle);
        }

        .score-box {
          display: flex;
          flex-direction: column;
        }

        .score-val {
          font-family: var(--font-family-heading);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--color-primary);
          line-height: 1;
        }

        .score-label {
          font-family: var(--font-family-body);
          font-size: 0.62rem;
          color: var(--color-text-subtle);
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.04em;
        }

        .categories-mini-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .mini-pill {
          font-family: var(--font-family-body);
          font-size: 0.70rem;
          background: #ffffff;
          border: 1px solid var(--color-border);
          padding: 3px 8px;
          border-radius: 4px;
          color: var(--color-text-muted);
        }

        .card-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 4px;
        }

        .date-tag {
          font-family: var(--font-family-body);
          font-size: 0.70rem;
          color: var(--color-text-subtle);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Bouton Voir plus */
        .enreg-load-more {
          display: flex;
          justify-content: center;
          padding-top: 4px;
        }

        .btn-load-more {
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--color-primary);
          background: var(--color-green-subtle);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          padding: 10px 28px;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-load-more:hover {
          background: var(--color-green);
          border-color: var(--color-green);
        }

        /* Delete confirmation modal */
        .delete-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }

        .delete-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          max-width: 380px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          animation: slideUp 0.2s ease;
        }

        .delete-modal-icon {
          color: #dc3545;
          margin-bottom: 12px;
        }

        .delete-modal h3 {
          font-family: var(--font-family-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--color-text-main);
          margin-bottom: 8px;
        }

        .delete-modal p {
          font-family: var(--font-family-body);
          font-size: 0.85rem;
          color: var(--color-text-muted);
          line-height: 1.5;
          margin-bottom: 24px;
        }

        .delete-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-cancel {
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          font-weight: 600;
          padding: 10px 24px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: #ffffff;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-cancel:hover {
          background: var(--color-green-subtle);
        }

        .btn-confirm-delete {
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          font-weight: 600;
          padding: 10px 24px;
          border-radius: var(--radius-full);
          border: none;
          background: #dc3545;
          color: #ffffff;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-confirm-delete:hover {
          background: #c82333;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .rename-btn {
          color: var(--color-text-subtle);
          padding: 4px;
          border-radius: 6px;
          transition: all 0.15s ease;
        }
        .rename-btn:hover {
          color: var(--color-primary);
          background: var(--color-green-light);
        }

        .rename-modal-icon {
          color: var(--color-primary);
          margin-bottom: 12px;
        }

        .rename-field {
          margin: 16px 0 20px;
        }

        .rename-field input {
          width: 100%;
          padding: 12px 14px;
          border: 1.5px solid var(--color-border);
          border-radius: 10px;
          font-family: var(--font-family-body);
          font-size: 0.92rem;
          color: var(--color-text-main);
          transition: border-color 0.15s ease;
          box-sizing: border-box;
        }

        .rename-field input:focus {
          outline: none;
          border-color: var(--color-green);
        }

        .btn-confirm-save {
          font-family: var(--font-family-body);
          font-size: 0.88rem;
          font-weight: 700;
          padding: 10px 24px;
          border-radius: var(--radius-full);
          border: none;
          background: var(--color-primary);
          color: #ffffff;
          cursor: pointer;
          transition: var(--transition-fast);
        }
        .btn-confirm-save:hover {
          background: var(--color-primary-light);
        }
      `}</style>
    </div>
  );
};
