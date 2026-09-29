import {
  Download,
  ArrowLeft,
  MapPin,
  Calendar,
  ShieldCheck,
  Award,
  Loader2,
  Printer,
  Eye,
} from 'lucide-react';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { AuthUser, NeighborhoodAnalysis } from '../../types';

interface ReportViewProps {
  analysis: NeighborhoodAnalysis;
  onBackToEdit: () => void;
  user?: AuthUser | null;
}

export const ReportView: React.FC<ReportViewProps> = ({
  analysis,
  onBackToEdit,
  user,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const generatePdfInstance = async () => {
    const element = reportRef.current;
    if (!element) return null;

    if (document.fonts) {
      await document.fonts.ready;
    }

    // 1. Rendu canvas haute définition avec espacement des polices préservé
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc: Document) => {
        const sheet = clonedDoc.querySelector('.printable-report-sheet') as HTMLElement;
        if (sheet) {
          sheet.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
          sheet.style.letterSpacing = '0px';
          const allElements = sheet.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.letterSpacing = '0px';
            htmlEl.style.fontVariantLigatures = 'none';
          });
          const agentWords = sheet.querySelectorAll('.agent-name-word');
          agentWords.forEach((w, idx) => {
            const wordEl = w as HTMLElement;
            if (idx < agentWords.length - 1) {
              wordEl.style.marginRight = '6px';
            }
          });
          const docWords = sheet.querySelectorAll('.doc-word');
          docWords.forEach((w) => {
            const wordEl = w as HTMLElement;
            if (wordEl.style.marginRight && wordEl.style.marginRight !== '0px') {
              wordEl.style.display = 'inline-block';
            }
          });
        }
      },
    });

    // 2. Création directe du PDF A4 (exactement 1 seule page, sans saut ni page blanche)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    // Format A4 portrait : 210 x 297 mm
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    return pdf;
  };

  const handlePreviewPdf = async () => {
    if (isPreviewing || isDownloading) return;

    setIsPreviewing(true);
    try {
      const pdf = await generatePdfInstance();
      if (!pdf) return;
      const pdfBlobUrl = pdf.output('bloburl');
      window.open(pdfBlobUrl, '_blank');
    } catch (error) {
      console.error('Erreur lors de l\'aperçu du PDF:', error);
      alert('Impossible d\'ouvrir l\'aperçu. Vous pouvez utiliser le bouton Télécharger.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloading || isPreviewing) return;

    setIsDownloading(true);
    try {
      const pdf = await generatePdfInstance();
      if (!pdf) return;

      const cleanCity = (analysis.city || 'Quartier').replace(/[^a-zA-Z0-9à-üÀ-Ü_-]/g, '_');
      const cleanPostcode = (analysis.postcode || '').replace(/[^0-9]/g, '');
      const filename = `Rapport_Citynside_${cleanCity}${cleanPostcode ? `_${cleanPostcode}` : ''}.pdf`;

      pdf.save(filename);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      alert('Une erreur est survenue lors du téléchargement du PDF. Vous pouvez également cliquer sur Imprimer.');
    } finally {
      setIsDownloading(false);
    }
  };

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

  const getAgentNameParts = () => {
    const full = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || "Agent Immobilier";
    return full.trim().split(/\s+/).filter(Boolean);
  };

  const renderSpacedText = (text: string, spacePx = 4) => {
    return text.trim().split(/\s+/).map((word, idx, arr) => (
      <span
        key={idx}
        className="doc-word"
        style={{
          display: 'inline-block',
          marginRight: idx < arr.length - 1 ? `${spacePx}px` : '0px',
        }}
      >
        {word}
      </span>
    ));
  };

  return (
    <div className="report-view-wrapper">
      {/* Top action bar (hidden during print) */}
      <div className="report-actions-bar no-print">
        <button className="btn-outline back-btn" onClick={onBackToEdit}>
          <ArrowLeft size={16} />
          <span>Modifier l'analyse</span>
        </button>

        <div className="actions-right">
          <button 
            className="btn-outline print-action-btn" 
            onClick={handlePreviewPdf} 
            disabled={isPreviewing || isDownloading}
            title="Prévisualiser le PDF dans un nouvel onglet"
          >
            {isPreviewing ? <Loader2 size={16} className="spin-icon" /> : <Eye size={16} />}
            <span>Aperçu</span>
          </button>
          <button className="btn-outline print-action-btn" onClick={handlePrint} title="Imprimer ou enregistrer via la boîte de dialogue système">
            <Printer size={16} />
            <span>Imprimer</span>
          </button>
          <button 
            className="btn-primary print-btn" 
            onClick={handleDownloadPdf} 
            disabled={isDownloading || isPreviewing}
            title="Télécharger le fichier PDF directement"
          >
            {isDownloading ? (
              <>
                <Loader2 size={18} className="spin-icon" />
                <span>Téléchargement...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Télécharger</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Actual A4 Document Sheet */}
      <div className="printable-report-sheet" ref={reportRef}>
        {/* Header Document */}
        <header className="sheet-header">
          <div className="header-brand-block">
            <div className="sheet-logo-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" className="sheet-logo" width="46" height="46">
                <defs>
                  <linearGradient id="gradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#193832"/>
                    <stop offset="100%" stopColor="#245148"/>
                  </linearGradient>
                  <linearGradient id="gradCenter" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8EA885"/>
                    <stop offset="100%" stopColor="#76936D"/>
                  </linearGradient>
                  <linearGradient id="gradRight" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E443C"/>
                    <stop offset="100%" stopColor="#122A25"/>
                  </linearGradient>
                </defs>
                <path d="M50 8 L88 30 L88 70 L50 92 L12 70 L12 30 Z" stroke="#193832" strokeWidth="4" strokeLinejoin="round" fill="none"/>
                <path d="M26 42 L38 35 L38 72 L26 65 Z" fill="url(#gradLeft)"/>
                <path d="M44 26 L56 20 L56 78 L44 72 Z" fill="url(#gradCenter)"/>
                <path d="M62 38 L74 44 L74 68 L62 62 Z" fill="url(#gradRight)"/>
              </svg>
            </div>
            <div>
              <h1 className="sheet-brand-name">Citynside</h1>
              <span className="sheet-brand-tagline">
                Rapport d'Analyse du logement
              </span>
            </div>
          </div>

          <div className="header-agent-badge">
            <span className="agent-agency">
              {getAgentNameParts().map((part, idx) => (
                <span key={idx} className="agent-name-word">
                  {part}
                </span>
              ))}
            </span>
            <span className="agent-rep">{user?.agency ? user.agency : "Agent certifié Citynside"}</span>
            <span className="agent-date">
              <Calendar
                size={12}
                style={{ display: "inline", marginRight: "4px" }}
              />
              {`Édité le ${new Date().toLocaleDateString("fr-FR")}`}
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
              {`${analysis.postcode} ${analysis.city}`}
              {analysis.neighborhoodName && analysis.neighborhoodName !== analysis.address && (
                <> &bull; <b>{analysis.neighborhoodName}</b></>
              )}
            </p>
          </div>

          {/* Global Score Widget */}
          <div className="global-score-widget">
            <div className="score-circle-display">
              <span className="score-big">
                {analysis.globalScore.toFixed(1)}
              </span>
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
            <h3 className="section-title">
              Indicateurs Objectifs & Données Publiques
            </h3>
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
                <span>{renderSpacedText("Transparence & Méthodologie", 5)}</span>
              </div>
              <p className="meth-text">
                {renderSpacedText("Les scores sont calculés par algorithme multi-critères selon l'accessibilité piétonne (rayons de 300 à 900 m), la variété des équipements et l'exposition sonore.", 4)}
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
                  {(analysis.impressions?.atmosphere ?? 70) > 60
                    ? "Quartier calme et paisible"
                    : (analysis.impressions?.atmosphere ?? 70) > 30
                    ? "Quartier équilibré"
                    : "Quartier très animé"}
                  {analysis.impressions?.nightLighting
                    ? " • Éclairage nocturne adéquat"
                    : ""}
                </p>
                {analysis.impressions?.securityObservations && (
                  <p className="imp-subquote">
                    "{analysis.impressions.securityObservations}"
                  </p>
                )}
              </div>

              <div className="imp-block">
                <span className="imp-label">Mobilité & Accessibilité</span>
                <p className="imp-text">
                  <span>Facilité de déplacement : </span>
                  <b>{`${analysis.impressions?.mobilityEase ?? 80}/100`}</b>
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
                  <span>Accessibilité PMR : </span>
                  <b>
                    {analysis.impressions?.pmrAccessible
                      ? "Oui (aménagée)"
                      : "Partielle"}
                  </b>
                </p>
              </div>

              <div className="imp-block">
                <span className="imp-label">Ambiance du Secteur</span>
                {analysis.impressions?.neighborhoodDynamic !== undefined && (
                  <p className="imp-text" style={{ marginBottom: '6px' }}>
                    <span>Dynamisme : </span>
                    <b>
                      {analysis.impressions.neighborhoodDynamic <= 33
                        ? "Peu dynamique"
                        : analysis.impressions.neighborhoodDynamic <= 66
                        ? "Dynamisme modéré"
                        : "Très dynamique"}
                    </b>
                  </p>
                )}
                {analysis.impressions?.ambianceTags && analysis.impressions.ambianceTags.length > 0 && (
                  <div className="pill-tags-list">
                    {analysis.impressions.ambianceTags.map((tag) => (
                      <span key={tag} className="pill-tag active">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {analysis.impressions?.generalNotes && (
                  <p className="imp-subquote">
                    "{analysis.impressions.generalNotes}"
                  </p>
                )}
              </div>
            </div>

            {/* Client Guarantee Badge */}
            <div className="guarantee-badge">
              <Award size={28} className="award-icon" />
              <div>
                <p className="g-desc">
                  {renderSpacedText("Document remis dans le cadre du devoir de conseil de l'agent immobilier.", 4)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sheet Footer */}
        <footer className="sheet-footer">
          <span>Citynside — L'expert de l'analyse immobilière</span>
          <span>Page 1 / 1</span>
        </footer>
      </div>

      <style>{`
        /* ReportView — Charte Citynside Premium */
        .report-view-wrapper {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding-bottom: 60px;
        }

        .report-actions-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 10px;
          width: 100%;
          max-width: 794px;
        }

        /* Actions en haut de page */
        .actions-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .print-action-btn {
          padding: 10px 16px;
          font-size: 0.92rem;
          display: flex;
          align-items: center;
          gap: 6px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          background: #ffffff;
          border: 1px solid var(--color-border);
          color: var(--color-text-main);
          transition: all 0.2s ease;
        }

        .print-action-btn:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .print-btn {
          padding: 10px 22px;
          font-size: 0.94rem;
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--color-primary) 0%, #1a4a2a 100%);
          border: none;
          color: white;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(46, 125, 50, 0.2);
        }
        
        .print-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(46, 125, 50, 0.3);
        }

        .print-btn:disabled {
          opacity: 0.75;
          cursor: not-allowed;
          transform: none;
        }

        /* Feuille A4 imprimable / exportable */
        .printable-report-sheet {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.05);
          padding: 34px 42px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background-image: radial-gradient(circle at 100% 0%, rgba(46,125,50,0.03) 0%, transparent 40%),
                            radial-gradient(circle at 0% 100%, rgba(46,125,50,0.03) 0%, transparent 40%);
          position: relative;
          overflow: hidden;
          /* A4 dimensions for perfect single-page capture */
          width: 794px;
          height: 1120px;
          max-height: 1120px;
          box-sizing: border-box;
          flex-shrink: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          letter-spacing: 0px !important;
        }

        /* Forcer l'annulation des ligatures et espacements fantômes pour html2canvas */
        .printable-report-sheet,
        .printable-report-sheet * {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
          letter-spacing: 0px !important;
          font-variant-ligatures: none !important;
        }

        .sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 14px;
          border-bottom: 2px solid rgba(46, 125, 50, 0.1);
        }

        .header-brand-block {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .sheet-logo-wrap {
          width: 46px;
          height: 46px;
          background: var(--color-green-light);
          border-radius: 10px;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sheet-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .sheet-brand-name {
          font-size: 1.6rem;
          font-weight: 800;
          color: var(--color-primary);
          margin: 0 0 2px 0;
        }

        .sheet-brand-tagline {
          font-size: 0.78rem;
          color: var(--color-text-muted);
          font-weight: 500;
          text-transform: uppercase;
        }

        .header-agent-badge {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          line-height: 1.4;
        }

        .agent-agency {
          font-size: 0.88rem;
          font-weight: 800;
          color: var(--color-primary);
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .agent-name-word {
          display: inline-block;
        }

        .agent-name-word:not(:last-child) {
          margin-right: 6px;
        }

        .agent-rep {
          font-size: 0.75rem;
          color: var(--color-green-hover);
          font-weight: 600;
        }

        .agent-date {
          font-size: 0.72rem;
          color: var(--color-text-subtle);
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* Bannière propriété */
        .property-summary-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, rgba(205, 227, 202, 0.4) 0%, rgba(205, 227, 202, 0.1) 100%);
          padding: 18px 26px;
          border-radius: 10px;
          border: 1px solid rgba(46, 125, 50, 0.15);
        }

        .prop-type-tag {
          font-size: 0.68rem;
          font-weight: 800;
          color: var(--color-primary);
          text-transform: uppercase;
          background: rgba(46, 125, 50, 0.1);
          padding: 3px 8px;
          border-radius: 4px;
          display: inline-block;
          margin-bottom: 8px;
        }

        .prop-address {
          font-family: var(--font-family-heading);
          font-size: 1.4rem;
          font-weight: 700;
          color: var(--color-primary);
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 4px 0;
        }

        .pin-icon {
          color: var(--color-green-hover);
        }

        .prop-city {
          font-family: var(--font-family-body);
          font-size: 0.9rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        /* Widget score global */
        .global-score-widget {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #ffffff;
          padding: 12px 24px;
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.04);
        }

        .score-circle-display {
          display: flex;
          align-items: baseline;
        }

        .score-big {
          font-family: var(--font-family-heading);
          font-size: 2.6rem;
          font-weight: 800;
          color: var(--color-primary);
          line-height: 1;
        }

        .score-unit {
          font-family: var(--font-family-body);
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-muted);
          margin-left: 2px;
        }

        .score-verdict {
          display: flex;
          flex-direction: column;
          border-left: 2px solid rgba(0, 0, 0, 0.06);
          padding-left: 16px;
        }

        .verdict-grade {
          font-family: var(--font-family-heading);
          font-size: 1.4rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 2px;
        }

        .verdict-label {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          font-weight: 600;
        }

        /* Grille contenu */
        .sheet-grid-content {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 28px;
          margin-top: 4px;
        }

        .section-title {
          font-size: 0.9rem;
          font-weight: 800;
          color: var(--color-primary);
          margin: 0 0 16px 0;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .section-title::before {
          content: "";
          display: block;
          width: 4px;
          height: 14px;
          background: var(--color-primary);
          border-radius: 2px;
        }

        .report-categories-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .report-cat-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .cat-row-left {
          display: flex;
          flex-direction: column;
        }

        .cat-title-text {
          font-family: var(--font-family-body);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-text-main);
          margin-bottom: 2px;
        }

        .cat-highlight {
          font-family: var(--font-family-body);
          font-size: 0.76rem;
          color: var(--color-text-muted);
        }

        /* Pill score en vert */
        .cat-score-pill {
          font-family: var(--font-family-body);
          font-size: 0.95rem;
          color: var(--color-primary);
          background: rgba(46, 125, 50, 0.08);
          padding: 6px 12px;
          border-radius: 99px;
          font-weight: 700;
        }

        .methodology-box {
          margin-top: 18px;
          background: rgba(0, 0, 0, 0.02);
          border: 1px dashed rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .meth-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-family-body);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .meth-text {
          font-family: var(--font-family-body);
          font-size: 0.74rem;
          color: var(--color-text-muted);
          line-height: 1.45;
          margin: 0;
        }

        .sources-tags-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }

        .sources-tags-cloud span {
          font-family: var(--font-family-body);
          font-size: 0.65rem;
          background: #ffffff;
          color: var(--color-text-muted);
          border: 1px solid rgba(0,0,0,0.08);
          padding: 3px 8px;
          border-radius: 4px;
          font-weight: 600;
          text-transform: uppercase;
        }

        /* Colonne impressions */
        .impressions-report-card {
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
          border-radius: 8px;
          padding: 20px;
        }

        .imp-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(0,0,0,0.04);
        }
        
        .imp-block:last-child {
          padding-bottom: 0;
          border-bottom: none;
        }

        .imp-label {
          font-size: 0.74rem;
          font-weight: 800;
          color: var(--color-text-muted);
          text-transform: uppercase;
        }

        .imp-text {
          font-family: var(--font-family-body);
          font-size: 0.86rem;
          color: var(--color-text-main);
          margin: 0;
          font-weight: 500;
        }

        .imp-sub {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-muted);
          margin: 0;
        }

        .imp-subquote {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          font-style: italic;
          color: var(--color-text-main);
          background: rgba(46, 125, 50, 0.05);
          border-left: 3px solid var(--color-primary);
          padding: 8px 12px;
          border-radius: 0 4px 4px 0;
          margin: 4px 0 0 0;
        }

        .pill-tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 4px 0;
        }

        .pill-tag {
          font-family: var(--font-family-body);
          font-size: 0.72rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 99px;
          background: rgba(0,0,0,0.04);
          color: var(--color-text-main);
        }

        .pill-tag.active {
          background: rgba(46, 125, 50, 0.1);
          color: var(--color-primary);
        }

        /* Badge garantie */
        .guarantee-badge {
          margin-top: 18px;
          display: flex;
          align-items: center;
          gap: 16px;
          background: linear-gradient(135deg, rgba(241, 232, 80, 0.2) 0%, rgba(241, 232, 80, 0.05) 100%);
          border: 1px solid rgba(241, 232, 80, 0.4);
          padding: 16px;
          border-radius: 8px;
        }

        .award-icon {
          color: #d97706;
          flex-shrink: 0;
          background: rgba(255, 255, 255, 0.6);
          padding: 6px;
          border-radius: 50%;
          width: 42px;
          height: 42px;
        }

        .g-title {
          font-family: var(--font-family-body);
          font-size: 0.85rem;
          color: #92400e;
          font-weight: 800;
          display: block;
          margin-bottom: 2px;
        }

        .g-desc {
          font-family: var(--font-family-body);
          font-size: 0.74rem;
          color: #92400e;
          opacity: 0.95;
          margin: 0;
          line-height: 1.4;
          word-spacing: 4px;
        }

        .sheet-footer {
          margin-top: 10px;
          padding-top: 14px;
          border-top: 1px solid rgba(0,0,0,0.06);
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
          color: var(--color-text-subtle);
          font-weight: 500;
        }

        /* Styles pour impression via navigateur (Ctrl+P / bouton Imprimer) */
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print, .cyt-sidebar, .report-actions-bar {
            display: none !important;
          }
          #root {
            display: block !important;
            height: auto !important;
            width: auto !important;
          }
          .report-view-wrapper {
            padding: 0 !important;
            margin: 0 !important;
          }
          .printable-report-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 15mm 20mm !important;
            width: 100% !important;
            height: auto !important;
            max-height: 297mm !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};
