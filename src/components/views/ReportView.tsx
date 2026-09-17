import {
  Printer,
  ArrowLeft,
  MapPin,
  Calendar,
  ShieldCheck,
  Award,
} from 'lucide-react';
import type { NeighborhoodAnalysis } from '../../types';

interface ReportViewProps {
  analysis: NeighborhoodAnalysis;
  onBackToEdit: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  analysis,
  onBackToEdit,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const getScoreGrade = (score: number) => {
    if (score >= 8.5) return { grade: 'A+', label: 'Environnement Exceptionnel', color: '#1b633e' };
    if (score >= 7.5) return { grade: 'A', label: 'Très Bon Environnement', color: '#2e7d32' };
    if (score >= 6.5) return { grade: 'B', label: 'Bon Environnement', color: '#437356' };
    return { grade: 'C', label: 'Environnement Moyen', color: '#d97706' };
  };

  const appraisal = getScoreGrade(analysis.globalScore);

  return (
    <div className="report-view-wrapper">
      {/* Top action bar (hidden during print) */}
      <div className="report-actions-bar no-print">
        <button className="btn-outline back-btn" onClick={onBackToEdit}>
          <ArrowLeft size={16} />
          <span>Modifier l'analyse</span>
        </button>

        <div className="actions-right">
          <button className="btn-primary print-btn" onClick={handlePrint}>
            <Printer size={18} />
            <span>Imprimer / Télécharger le PDF</span>
          </button>
        </div>
      </div>

      {/* Actual A4 Document Sheet */}
      <div className="printable-report-sheet">
        {/* Header Document */}
        <header className="sheet-header">
          <div className="header-brand-block">
            <div className="sheet-logo-wrap">
              <img src="/logo-cytinside.svg" alt="Cytinside" className="sheet-logo" />
            </div>
            <div>
              <h1 className="sheet-brand-name">Cytinside</h1>
              <span className="sheet-brand-tagline">Rapport d'Analyse Environnementale du Bien</span>
            </div>
          </div>

          <div className="header-agent-badge">
            <span className="agent-agency">IMMOBILIER CONSEIL</span>
            <span className="agent-rep">Agent certifié Cytinside</span>
            <span className="agent-date">
              <Calendar size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Édité le {new Date().toLocaleDateString('fr-FR')}
            </span>
          </div>
        </header>

        {/* Property Overview Card */}
        <section className="property-summary-banner">
          <div className="property-details">
            <span className="prop-type-tag">DIAGNOSTIC DE SECTEUR</span>
            <h2 className="prop-address">
              <MapPin size={20} className="pin-icon" />
              {analysis.address}
            </h2>
            <p className="prop-city">
              {analysis.postcode} {analysis.city} • <b>{analysis.neighborhoodName}</b>
            </p>
          </div>

          {/* Global Score Widget */}
          <div className="global-score-widget">
            <div className="score-circle-display">
              <span className="score-big">{analysis.globalScore.toFixed(1)}</span>
              <span className="score-unit">/10</span>
            </div>
            <div className="score-verdict" style={{ color: appraisal.color }}>
              <span className="verdict-grade">{appraisal.grade}</span>
              <span className="verdict-label">{appraisal.label}</span>
            </div>
          </div>
        </section>

        {/* Dual Column: Categories Breakdown + Agent Impressions */}
        <div className="sheet-grid-content">
          {/* Left Column: Calculated Data Scores */}
          <div className="sheet-col-scores">
            <h3 className="section-title">Indicateurs Objectifs & Données Publiques</h3>
            <div className="report-categories-list">
              {analysis.categories.map((cat) => (
                <div key={cat.category} className="report-cat-row">
                  <div className="cat-row-left">
                    <span className="cat-title-text">{cat.label}</span>
                    <span className="cat-highlight">{cat.highlightText}</span>
                  </div>
                  <div className="cat-row-right">
                    <span className="cat-score-pill">
                      <b>{cat.score.toFixed(1)}</b>/10
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Methodology Note */}
            <div className="methodology-box">
              <div className="meth-header">
                <ShieldCheck size={16} />
                <span>Transparence & Méthodologie</span>
              </div>
              <p className="meth-text">
                Les scores sont calculés par algorithme multi-critères selon l'accessibilité piétonne (rayons de 300m à 900m), la variété des équipements et l'exposition sonore.
              </p>
              <div className="sources-tags-cloud">
                <span>Base Adresse Nationale</span>
                <span>OpenStreetMap</span>
                <span>INSEE BPE</span>
                <span>Cerema Bruit</span>
              </div>
            </div>
          </div>

          {/* Right Column: Agent Field Impressions */}
          <div className="sheet-col-impressions">
            <h3 className="section-title">Observations Terrain de l'Agent</h3>
            <div className="impressions-report-card">
              <div className="imp-block">
                <span className="imp-label">Atmosphère & Sécurité</span>
                <p className="imp-text">
                  {analysis.impressions?.atmosphere && analysis.impressions.atmosphere > 60
                    ? 'Quartier très calme et paisible'
                    : 'Quartier vivant et commerçant'}
                  {analysis.impressions?.nightLighting ? ' • Éclairage nocturne adéquat' : ''}
                </p>
                {analysis.impressions?.securityObservations && (
                  <p className="imp-subquote">"{analysis.impressions.securityObservations}"</p>
                )}
              </div>

              <div className="imp-block">
                <span className="imp-label">Mobilité & Accessibilité</span>
                <p className="imp-text">
                  Facilité de déplacement :{' '}
                  <b>{analysis.impressions?.mobilityEase || 80}/100</b>
                </p>
                {analysis.impressions?.observedTransports && (
                  <div className="pill-tags-list">
                    {analysis.impressions.observedTransports.map((t) => (
                      <span key={t} className="pill-tag">
                        ✓ {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="imp-sub">
                  Accessibilité PMR :{' '}
                  <b>{analysis.impressions?.pmrAccessible ? 'Oui (aménagée)' : 'Partielle'}</b>
                </p>
              </div>

              <div className="imp-block">
                <span className="imp-label">Ambiance du Secteur</span>
                {analysis.impressions?.ambianceTags && (
                  <div className="pill-tags-list">
                    {analysis.impressions.ambianceTags.map((tag) => (
                      <span key={tag} className="pill-tag active">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.impressions?.generalNotes && (
                  <p className="imp-subquote">"{analysis.impressions.generalNotes}"</p>
                )}
              </div>
            </div>

            {/* Client Guarantee Badge */}
            <div className="guarantee-badge">
              <Award size={28} className="award-icon" />
              <div>
                <strong className="g-title">Garantie d'Information Vérifiée</strong>
                <p className="g-desc">Document remis dans le cadre du devoir de conseil de l'agent immobilier.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sheet Footer */}
        <footer className="sheet-footer">
          <span>Cytinside SaaS — Analyse d'environnement pour professionnels de l'immobilier</span>
          <span>Page 1 / 1</span>
        </footer>
      </div>

      <style>{`
        .report-view-wrapper {
          max-width: 860px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-bottom: 60px;
        }

        .report-actions-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .print-btn {
          padding: 10px 22px;
          font-size: 0.94rem;
        }

        /* A4 Printable Sheet */
        .printable-report-sheet {
          background: #ffffff;
          border-radius: var(--radius-md);
          border: 1px solid #dce5da;
          box-shadow: var(--shadow-md);
          padding: 36px 40px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 18px;
          border-bottom: 2px solid #eef3ed;
        }

        .header-brand-block {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .sheet-logo-wrap {
          width: 44px;
          height: 44px;
        }

        .sheet-logo {
          width: 100%;
          height: 100%;
        }

        .sheet-brand-name {
          font-size: 1.5rem;
          font-weight: 800;
          color: #173830;
          letter-spacing: -0.03em;
        }

        .sheet-brand-tagline {
          font-size: 0.78rem;
          color: #697c74;
          font-weight: 500;
        }

        .header-agent-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.3;
        }

        .agent-agency {
          font-size: 0.85rem;
          font-weight: 800;
          color: #173830;
          letter-spacing: 0.04em;
        }

        .agent-rep {
          font-size: 0.75rem;
          color: #8ea885;
          font-weight: 700;
        }

        .agent-date {
          font-size: 0.72rem;
          color: #8c9e96;
          margin-top: 2px;
        }

        /* Property Banner */
        .property-summary-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f4f8f3;
          padding: 20px 24px;
          border-radius: var(--radius-sm);
          border: 1px solid #e1ebe0;
        }

        .prop-type-tag {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #275246;
        }

        .prop-address {
          font-size: 1.4rem;
          font-weight: 800;
          color: #173830;
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 4px 0;
        }

        .pin-icon {
          color: #8ea885;
        }

        .prop-city {
          font-size: 0.88rem;
          color: #5e736a;
        }

        .global-score-widget {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #ffffff;
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
          border: 1px solid #e5eee3;
        }

        .score-circle-display {
          display: flex;
          align-items: baseline;
        }

        .score-big {
          font-size: 2.2rem;
          font-weight: 800;
          color: #173830;
        }

        .score-unit {
          font-size: 0.95rem;
          font-weight: 600;
          color: #798d84;
        }

        .score-verdict {
          display: flex;
          flex-direction: column;
        }

        .verdict-grade {
          font-size: 1.25rem;
          font-weight: 800;
          line-height: 1;
        }

        .verdict-label {
          font-size: 0.76rem;
          font-weight: 700;
        }

        /* Content Grid */
        .sheet-grid-content {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 24px;
        }

        .section-title {
          font-size: 0.95rem;
          font-weight: 800;
          color: #173830;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .report-categories-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .report-cat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: #fafcfa;
          border: 1px solid #e6ede4;
          border-radius: var(--radius-xs);
        }

        .cat-row-left {
          display: flex;
          flex-direction: column;
        }

        .cat-title-text {
          font-size: 0.88rem;
          font-weight: 700;
          color: #173830;
        }

        .cat-highlight {
          font-size: 0.74rem;
          color: #63776e;
        }

        .cat-score-pill {
          font-size: 0.86rem;
          color: #173830;
          background: #eef5ec;
          padding: 4px 10px;
          border-radius: 99px;
        }

        .methodology-box {
          margin-top: 14px;
          background: #f7faf7;
          border: 1px dashed #cedccb;
          border-radius: var(--radius-xs);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .meth-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #1e453b;
        }

        .meth-text {
          font-size: 0.72rem;
          color: #61736b;
          line-height: 1.35;
        }

        .sources-tags-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 2px;
        }

        .sources-tags-cloud span {
          font-size: 0.66rem;
          background: #e8f0e6;
          color: #1b453b;
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 600;
        }

        /* Impressions Column */
        .impressions-report-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: #fafcfa;
          border: 1px solid #e6ede4;
          border-radius: var(--radius-xs);
          padding: 16px;
        }

        .imp-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .imp-label {
          font-size: 0.75rem;
          font-weight: 800;
          color: #173830;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .imp-text {
          font-size: 0.82rem;
          color: #274138;
        }

        .imp-sub {
          font-size: 0.78rem;
          color: #556c62;
        }

        .imp-subquote {
          font-size: 0.76rem;
          font-style: italic;
          color: #4b685d;
          background: #f1f7ef;
          padding: 6px 10px;
          border-radius: 4px;
          margin-top: 2px;
        }

        .pill-tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 4px 0;
        }

        .pill-tag {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 99px;
          background: #e6efe4;
          color: #194639;
        }

        .pill-tag.active {
          background: #9cbca4;
          color: #122a23;
        }

        .guarantee-badge {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          background: #eef6ed;
          border: 1px solid #d4e3d1;
          padding: 12px 14px;
          border-radius: var(--radius-xs);
        }

        .award-icon {
          color: #3b7454;
          flex-shrink: 0;
        }

        .g-title {
          font-size: 0.82rem;
          color: #173830;
          display: block;
        }

        .g-desc {
          font-size: 0.7rem;
          color: #5a7066;
        }

        .sheet-footer {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid #eef3ed;
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #8c9e96;
        }

        /* PRINT STYLES FOR HIGH QUALITY A4 PDF */
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, .cyt-sidebar {
            display: none !important;
          }
          #root {
            display: block !important;
            height: auto !important;
            width: auto !important;
          }
          .printable-report-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            width: 100% !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
};
