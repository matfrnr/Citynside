import { useState } from 'react';
import {
  Shield,
  Train,
  Smile,
  ArrowRight,
  ArrowLeft,
  Bus,
  Bike,
  Car,
  CheckCircle2,
} from 'lucide-react';
import type { FieldImpressions, NeighborhoodAnalysis } from '../../types';

interface ImpressionsViewProps {
  analysis: NeighborhoodAnalysis;
  onSaveImpressions: (impressions: FieldImpressions) => void;
  onBack: () => void;
}

export const ImpressionsView: React.FC<ImpressionsViewProps> = ({
  analysis,
  onSaveImpressions,
  onBack,
}) => {
  const initial = analysis.impressions || {
    atmosphere: 70,
    nightLighting: true,
    securityObservations: '',
    mobilityEase: 80,
    observedTransports: ['Bus', 'Vélo'],
    pmrAccessible: true,
    neighborhoodDynamic: 65,
    ambianceTags: ['Résidentiel calme', 'Familial'],
    generalNotes: '',
  };

  const [impressions, setImpressions] = useState<FieldImpressions>(initial);

  const transportOptions = [
    { label: 'Métro', icon: Train },
    { label: 'Bus', icon: Bus },
    { label: 'Vélo', icon: Bike },
    { label: 'Parking', icon: Car },
  ];

  const ambianceOptions = ['Résidentiel calme', 'Animé', 'Commercial', 'Familial', 'Étudiant'];

  const toggleTransport = (item: string) => {
    setImpressions((prev) => {
      const exists = prev.observedTransports.includes(item);
      return {
        ...prev,
        observedTransports: exists
          ? prev.observedTransports.filter((t) => t !== item)
          : [...prev.observedTransports, item],
      };
    });
  };

  const toggleAmbiance = (item: string) => {
    setImpressions((prev) => {
      const exists = prev.ambianceTags.includes(item);
      return {
        ...prev,
        ambianceTags: exists
          ? prev.ambianceTags.filter((t) => t !== item)
          : [...prev.ambianceTags, item],
      };
    });
  };

  const handleSave = () => {
    onSaveImpressions(impressions);
  };

  return (
    <div className="impressions-view-container">
      {/* Back button */}
      <button className="back-link-btn" onClick={onBack}>
        <ArrowLeft size={16} />
        <span>Retour à l'analyse</span>
      </button>

      {/* Header matching Mockup 3 */}
      <div className="impressions-header">
        <h1 className="impressions-title">Mes impressions terrain</h1>
        <p className="impressions-subtitle">
          Partagez votre ressenti sur le quartier de <strong>{analysis.neighborhoodName || analysis.city}</strong>.
        </p>
      </div>

      <div className="impressions-sections-list">
        {/* SECTION 1: Sécurité & tranquillité */}
        <div className="section-group">
          <div className="section-title-badge">
            <Shield size={19} className="sec-icon" />
            <span className="sec-title">Sécurité & tranquillité</span>
          </div>

          <div className="cyt-card impression-card">
            {/* Atmosphère générale slider */}
            <div className="field-block">
              <label className="field-label">ATMOSPHÈRE GÉNÉRALE</label>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={impressions.atmosphere}
                  onChange={(e) =>
                    setImpressions({ ...impressions, atmosphere: Number(e.target.value) })
                  }
                />
                <div className="slider-labels">
                  <span>Agité</span>
                  <span>Calme</span>
                </div>
              </div>
            </div>

            {/* Éclairage nocturne */}
            <div className="field-row-toggle">
              <div>
                <span className="toggle-title">Éclairage nocturne correct</span>
                <p className="toggle-help">le quartier est-il bien éclairé la nuit ?</p>
              </div>
              <div className="segmented-switch">
                <button
                  type="button"
                  className={`switch-option ${impressions.nightLighting ? 'active' : ''}`}
                  onClick={() => setImpressions({ ...impressions, nightLighting: true })}
                >
                  Oui
                </button>
                <button
                  type="button"
                  className={`switch-option ${!impressions.nightLighting ? 'active' : ''}`}
                  onClick={() => setImpressions({ ...impressions, nightLighting: false })}
                >
                  Non
                </button>
              </div>
            </div>

            {/* Observations */}
            <div className="field-block">
              <label className="field-label">Observations</label>
              <textarea
                className="impression-textarea"
                rows={3}
                placeholder="Ex: Beaucoup de passage le soir, peu de nuisances sonores..."
                value={impressions.securityObservations}
                onChange={(e) =>
                  setImpressions({ ...impressions, securityObservations: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Accessibilité & mobilité */}
        <div className="section-group">
          <div className="section-title-badge">
            <Train size={19} className="sec-icon" />
            <span className="sec-title">Accessibilité & mobilité</span>
          </div>

          <div className="cyt-card impression-card">
            {/* Facilité de déplacement slider */}
            <div className="field-block">
              <label className="field-label">FACILITÉ DE DÉPLACEMENT</label>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={impressions.mobilityEase}
                  onChange={(e) =>
                    setImpressions({ ...impressions, mobilityEase: Number(e.target.value) })
                  }
                />
                <div className="slider-labels">
                  <span>Difficile</span>
                  <span>Facile</span>
                </div>
              </div>
            </div>

            {/* Moyens de transport observés avec icônes de la maquette */}
            <div className="field-block">
              <label className="field-label">Moyens de transport observés</label>
              <div className="chips-list">
                {transportOptions.map((opt) => {
                  const IconComp = opt.icon;
                  const isSelected = impressions.observedTransports.includes(opt.label);
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      className={`tag-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleTransport(opt.label)}
                    >
                      <IconComp size={15} />
                      <span>{opt.label}</span>
                      {isSelected && <CheckCircle2 size={13} className="check-chip" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accessible PMR */}
            <div className="field-row-toggle">
              <div>
                <span className="toggle-title">Accessible PMR</span>
                <p className="toggle-help">Trottoirs larges, rampes, etc.</p>
              </div>
              <div className="segmented-switch">
                <button
                  type="button"
                  className={`switch-option ${impressions.pmrAccessible ? 'active' : ''}`}
                  onClick={() => setImpressions({ ...impressions, pmrAccessible: true })}
                >
                  Oui
                </button>
                <button
                  type="button"
                  className={`switch-option ${!impressions.pmrAccessible ? 'active' : ''}`}
                  onClick={() => setImpressions({ ...impressions, pmrAccessible: false })}
                >
                  Non
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Ambiance & attractivité */}
        <div className="section-group">
          <div className="section-title-badge">
            <Smile size={19} className="sec-icon" />
            <span className="sec-title">Ambiance & attractivité</span>
          </div>

          <div className="cyt-card impression-card">
            {/* Dynamisme du quartier */}
            <div className="field-block">
              <label className="field-label">DYNAMISME DU QUARTIER</label>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={impressions.neighborhoodDynamic}
                  onChange={(e) =>
                    setImpressions({ ...impressions, neighborhoodDynamic: Number(e.target.value) })
                  }
                />
                <div className="slider-labels">
                  <span>Peu dynamique</span>
                  <span>Très dynamique</span>
                </div>
              </div>
            </div>

            {/* Sélecteur d'ambiance */}
            <div className="field-block">
              <label className="field-label">Sélecteur d'ambiance</label>
              <div className="chips-list">
                {ambianceOptions.map((opt) => {
                  const isSelected = impressions.ambianceTags.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      className={`tag-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleAmbiance(opt)}
                    >
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Impression générale */}
            <div className="field-block">
              <label className="field-label">Impression générale</label>
              <textarea
                className="impression-textarea"
                rows={2}
                placeholder="Ressenti global à transmettre au client..."
                value={impressions.generalNotes}
                onChange={(e) =>
                  setImpressions({ ...impressions, generalNotes: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="impressions-footer-action">
        <button className="btn-primary btn-save-large" onClick={handleSave}>
          <span>Enregistrer & Générer le rapport</span>
          <ArrowRight size={19} strokeWidth={2.4} />
        </button>
      </div>

      <style>{`
        /* ImpressionsView — Charte Citynside V1 */
        .impressions-view-container {
          max-width: 680px;
          margin: 0 auto;
          padding: 8px 12px 60px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .back-link-btn {
          align-self: flex-start;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-muted);
          font-family: var(--font-family-body);
          font-size: 0.86rem;
          font-weight: 500;
          padding: 6px 0;
          transition: color 0.15s ease;
        }
        .back-link-btn:hover {
          color: var(--color-primary);
        }

        .impressions-header {
          text-align: center;
          margin-bottom: 4px;
        }

        .impressions-title {
          font-size: 2.1rem;
          color: var(--color-primary);
          letter-spacing: -0.025em;
          font-weight: 700;
        }

        .impressions-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.94rem;
          color: var(--color-text-muted);
          margin-top: 6px;
          font-weight: 400;
        }

        .impressions-sections-list {
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        .section-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .section-title-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-left: 2px;
        }

        .sec-icon {
          color: var(--color-primary);
        }

        .sec-title {
          font-family: var(--font-family-heading);
          font-weight: 700;
          font-size: 1.1rem;
          color: var(--color-primary);
          letter-spacing: -0.01em;
        }

        .impression-card {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: #ffffff;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-card);
        }

        .field-block {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Labels Poppins uppercase — selon usage charte */
        .field-label {
          font-family: var(--font-family-body);
          font-size: 0.70rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--color-primary);
          text-transform: uppercase;
        }

        .slider-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 4px 0;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-muted);
          font-weight: 400;
        }

        .field-row-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-top: 1px solid var(--color-border-subtle);
          border-bottom: 1px solid var(--color-border-subtle);
        }

        .toggle-title {
          font-family: var(--font-family-body);
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--color-primary);
        }

        .toggle-help {
          font-family: var(--font-family-body);
          font-size: 0.76rem;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .segmented-switch {
          display: flex;
          background: var(--color-green-subtle);
          padding: 3px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
        }

        .switch-option {
          padding: 6px 18px;
          border-radius: var(--radius-full);
          font-family: var(--font-family-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--color-text-muted);
          transition: var(--transition-fast);
        }

        .switch-option.active {
          background: #ffffff;
          color: var(--color-primary);
          box-shadow: 0 2px 8px rgba(21, 58, 61, 0.12);
        }

        .impression-textarea {
          font-family: var(--font-family-body);
          width: 100%;
          padding: 12px 16px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.88rem;
          color: var(--color-text-main);
          background: var(--color-bg-app);
          resize: vertical;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .impression-textarea:focus {
          border-color: var(--color-green);
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(157, 197, 153, 0.22);
        }

        .chips-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-border);
          background: #ffffff;
          font-family: var(--font-family-body);
          font-size: 0.86rem;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: var(--transition-fast);
        }

        .tag-chip:hover {
          border-color: var(--color-green);
          background: var(--color-green-subtle);
          color: var(--color-primary);
        }

        /* Chip sélectionné — vert #9dc599 */
        .tag-chip.selected {
          background: var(--color-green);
          color: var(--color-primary-dark);
          border-color: var(--color-green);
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(157, 197, 153, 0.35);
        }

        .check-chip {
          color: var(--color-primary-dark);
        }

        .impressions-footer-action {
          display: flex;
          justify-content: center;
          margin-top: 14px;
        }

        /* Bouton principal — Jaune #f1e850 */
        .btn-save-large {
          width: 100%;
          max-width: 520px;
          background-color: var(--color-yellow);
          color: var(--color-text-on-yellow);
          font-weight: 700;
          font-size: 1.05rem;
          padding: 16px;
          border-radius: var(--radius-full);
          box-shadow: var(--shadow-cta-yellow);
          transition: var(--transition-smooth);
        }

        .btn-save-large:hover {
          background-color: var(--color-yellow-hover);
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(241, 232, 80, 0.52);
        }

        .btn-save-large:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};
