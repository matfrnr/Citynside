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
import { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DEFAULT_REPORT_CUSTOMIZATION, fetchReportCustomization, saveReportCustomization, type ReportCustomization } from '../../services/reportCustomization';
import { LOCAL_DEMO_USER_ID, type AuthUser, type NeighborhoodAnalysis } from '../../types';

interface ReportViewProps {
  isDemo: boolean;
  analysis: NeighborhoodAnalysis;
  onBackToEdit: () => void;
  user?: AuthUser | null;
  onReportGenerated?: () => void;
}

const loadReportCustomization = (key: string): ReportCustomization => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return DEFAULT_REPORT_CUSTOMIZATION;
    const parsed = JSON.parse(saved) as Partial<ReportCustomization>;
    return {
      ...DEFAULT_REPORT_CUSTOMIZATION,
      ...parsed,
      includedSections: { ...DEFAULT_REPORT_CUSTOMIZATION.includedSections, ...parsed.includedSections },
    };
  } catch {
    return DEFAULT_REPORT_CUSTOMIZATION;
  }
};

export const ReportView: React.FC<ReportViewProps> = ({
  isDemo,
  analysis,
  onBackToEdit,
  user,
  onReportGenerated,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const isServerUser = Boolean(user?.id && user.id !== LOCAL_DEMO_USER_ID);
  const customizationKey = `citynside_report_customization_${user?.id || 'local'}_${analysis.id}`;
  const [customization, setCustomization] = useState(() => ({ key: customizationKey, value: loadReportCustomization(customizationKey) }));
  const [customizationLoaded, setCustomizationLoaded] = useState(!isServerUser);
  const [customizationDirty, setCustomizationDirty] = useState(false);
  const [customizationSyncState, setCustomizationSyncState] = useState<'loading' | 'saving' | 'ready' | 'saved' | 'error' | 'local'>(isServerUser ? 'loading' : 'local');
  const customizationRef = useRef(customization);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  customizationRef.current = customization;
  const customizationValue = customization.key === customizationKey ? customization.value : DEFAULT_REPORT_CUSTOMIZATION;
  const { includedSections, strengths, reservations } = customizationValue;

  useEffect(() => {
    let cancelled = false;
    setCustomizationLoaded(!isServerUser);
    setCustomizationDirty(false);
    if (!isServerUser || !user?.id) {
      setCustomization({ key: customizationKey, value: loadReportCustomization(customizationKey) });
      setCustomizationSyncState('local');
      setCustomizationLoaded(true);
      return () => { cancelled = true; };
    }

    setCustomizationSyncState('loading');
    void fetchReportCustomization(user.id, analysis.id).then((saved) => {
      if (cancelled) return;
      const localValue = loadReportCustomization(customizationKey);
      setCustomization({ key: customizationKey, value: saved || localValue });
      setCustomizationLoaded(true);
      if (saved) {
        setCustomizationSyncState('saved');
      } else if (localStorage.getItem(customizationKey)) {
        // Reprise des préférences locales précédentes et migration automatique vers Supabase.
        setCustomizationDirty(true);
        setCustomizationSyncState('saving');
      } else {
        setCustomizationSyncState('ready');
      }
    }).catch((error) => {
      if (cancelled) return;
      console.warn('Chargement des préférences de rapport depuis Supabase impossible :', error);
      setCustomization({ key: customizationKey, value: loadReportCustomization(customizationKey) });
      setCustomizationLoaded(true);
      setCustomizationSyncState('error');
    });
    return () => { cancelled = true; };
  }, [analysis.id, customizationKey, isServerUser, user?.id]);

  useEffect(() => {
    if (!customizationLoaded || customization.key !== customizationKey) return;
    try { localStorage.setItem(customizationKey, JSON.stringify(customization.value)); } catch { /* Le rapport reste utilisable si le stockage local est indisponible. */ }
    if (!isServerUser || !user?.id) {
      setCustomizationSyncState('local');
      return;
    }
    if (!customizationDirty) return;

    setCustomizationSyncState('saving');
    const snapshot = customization;
    const timer = window.setTimeout(() => {
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined).then(() =>
        saveReportCustomization(user.id, analysis.id, snapshot.value),
      );
      void saveQueueRef.current.then(() => {
        const latest = customizationRef.current;
        if (latest.key === customizationKey && JSON.stringify(latest.value) === JSON.stringify(snapshot.value)) {
          setCustomizationDirty(false);
          setCustomizationSyncState('saved');
        }
      }).catch((error) => {
        console.warn('Enregistrement des préférences de rapport dans Supabase impossible :', error);
        setCustomizationSyncState('error');
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [analysis.id, customization, customizationDirty, customizationKey, customizationLoaded, isServerUser, user?.id]);

  const updateCustomization = (value: Partial<ReportCustomization>) => {
    if (!customizationLoaded) return;
    setCustomization((current) => ({
      key: customizationKey,
      value: { ...(current.key === customizationKey ? current.value : loadReportCustomization(customizationKey)), ...value },
    }));
    setCustomizationDirty(true);
  };

  const generatePdfInstance = async () => {
    const element = reportRef.current;
    if (!element) return null;

    if (document.fonts) {
      await document.fonts.ready;
    }

    // Capture le document complet ; le PDF sera ensuite réparti sur autant de pages A4 que nécessaire.
    const pageBreaks: number[] = [];
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc: Document) => {
        const sheet = clonedDoc.querySelector('.printable-report-sheet') as HTMLElement;
        if (sheet) {
          sheet.style.height = 'auto';
          sheet.style.maxHeight = 'none';
          sheet.style.overflow = 'visible';
          sheet.style.width = '794px';
          sheet.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
          sheet.style.letterSpacing = '0px';
          const allElements = sheet.querySelectorAll('*');
          allElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            htmlEl.style.letterSpacing = '0px';
            htmlEl.style.fontVariantLigatures = 'none';
          });
          const pageHeightCss = 1122;
          const sheetTop = sheet.getBoundingClientRect().top;
          const risks = sheet.querySelector('.report-risk-section') as HTMLElement | null;
          if (risks) {
            const risksRect = risks.getBoundingClientRect();
            const risksTop = risksRect.top - sheetTop;
            const risksBottom = risksRect.bottom - sheetTop;
            if (risksTop < pageHeightCss && risksBottom > pageHeightCss && risksTop > 120) {
              risks.style.marginTop = `${pageHeightCss + 34 - risksTop}px`;
            }
          }
          const observations = sheet.querySelector('.sheet-col-impressions') as HTMLElement | null;
          const observationsTop = observations ? observations.getBoundingClientRect().top - sheetTop : 0;
          const observationsNeedPageTwo = sheet.scrollHeight > pageHeightCss && observations;
          if (observationsNeedPageTwo && observations) {
            const pageTopInset = 34;
            const gap = Math.max(0, pageHeightCss + pageTopInset - observationsTop);
            sheet.style.setProperty('--observations-page-gap', `${gap}px`);
            // Start page two with a small top inset so its heading does not touch the page edge.
            pageBreaks.push(pageHeightCss);
          } else {
            let pageStart = 0;
            const keepTogetherBlocks = [...sheet.querySelectorAll(
              '.report-notes-strip, .report-cat-row, .report-risk-section, .impressions-report-card, .methodology-box, .guarantee-badge',
            )].map((block) => {
              const rect = (block as HTMLElement).getBoundingClientRect();
              return { top: rect.top - sheetTop, bottom: rect.bottom - sheetTop };
            }).sort((a, b) => a.top - b.top);
            keepTogetherBlocks.forEach(({ top, bottom }) => {
              if (bottom - pageStart > pageHeightCss && top > pageStart + 120) {
                pageBreaks.push(top);
                pageStart = top;
              }
            });
          }
          // Keep the remaining card breakpoints ordered before canvas slicing.
          pageBreaks.sort((a, b) => a - b);
        }
      },
    });

    // 2. Découpe sur des limites de cartes pour éviter les scores coupés entre deux pages.
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageHeightPx = Math.floor(canvas.width * 297 / 210);
    const scale = canvas.width / 794;
    const breaks = [0, ...pageBreaks.map((point) => Math.round(point * scale)), canvas.height];
    const pageSlices: Array<[number, number]> = [];
    for (let index = 0; index < breaks.length - 1; index++) {
      let start = breaks[index];
      const end = breaks[index + 1];
      while (end - start > pageHeightPx) {
        pageSlices.push([start, start + pageHeightPx]);
        start += pageHeightPx;
      }
      if (end > start) pageSlices.push([start, end]);
    }
    pageSlices.forEach(([start, end], index) => {
      if (index > 0) pdf.addPage();
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = end - start;
      const context = pageCanvas.getContext('2d');
      if (!context) return;
      context.drawImage(canvas, 0, start, canvas.width, end - start, 0, 0, canvas.width, end - start);
      const imageHeightMm = pageCanvas.height * 210 / canvas.width;
      pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.96), 'JPEG', 0, 0, 210, imageHeightMm, undefined, 'FAST');
    });
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
      onReportGenerated?.();
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
  const hasRightSections = includedSections.sources || includedSections.impressions;
  const positiveRiskFindings = (analysis.riskAssessment?.findings ?? []).filter((finding) => !/pas de risque connu|non concern|aucun risque|absence de risque|non expose|non exposé/i.test(finding.addressStatus));

  const getAgentName = () => [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || "Agent Immobilier";

  const renderSpacedText = (text: string) => text;

  return (
    <div className="report-view-wrapper">
      {!isDemo && <div className="report-options no-print">
        <button type="button" className="btn-outline" onClick={() => setShowReportOptions((open) => !open)} aria-expanded={showReportOptions}>
          Personnaliser le rapport
        </button>
        {showReportOptions && <div className="report-options-panel">
          <strong>Sections à inclure</strong>
          <label><input type="checkbox" disabled={!customizationLoaded} checked={includedSections.scores} onChange={(e) => updateCustomization({ includedSections: { ...includedSections, scores: e.target.checked } })} /> Scores par catégorie</label>
          <label><input type="checkbox" disabled={!customizationLoaded} checked={includedSections.sources} onChange={(e) => updateCustomization({ includedSections: { ...includedSections, sources: e.target.checked } })} /> Transparence & méthodologie</label>
          <label><input type="checkbox" disabled={!customizationLoaded} checked={includedSections.impressions} onChange={(e) => updateCustomization({ includedSections: { ...includedSections, impressions: e.target.checked } })} /> Observations terrain</label>
          <label><input type="checkbox" disabled={!customizationLoaded} checked={includedSections.risks} onChange={(e) => updateCustomization({ includedSections: { ...includedSections, risks: e.target.checked } })} /> Risques et nuisances</label>
          <div className="report-notes-fields">
            <label>Points forts<textarea disabled={!customizationLoaded} maxLength={160} value={strengths} onChange={(e) => updateCustomization({ strengths: e.target.value })} placeholder="Ex. Tram à proximité, commerces accessibles…" /></label>
            <label>Réserves<textarea disabled={!customizationLoaded} maxLength={160} value={reservations} onChange={(e) => updateCustomization({ reservations: e.target.value })} placeholder="Ex. Peu de stationnement, rue passante…" /></label>
          </div>
          <span className={`report-save-hint ${customizationSyncState === 'error' ? 'error' : ''}`} aria-live="polite">
            {customizationSyncState === 'loading' ? 'Chargement des préférences depuis le serveur…' :
              customizationSyncState === 'saving' ? 'Synchronisation avec le serveur…' :
              customizationSyncState === 'ready' ? 'Sauvegarde serveur prête' :
              customizationSyncState === 'saved' ? 'Enregistré sur le serveur' :
              customizationSyncState === 'error' ? 'Serveur indisponible : copie locale conservée' :
              'Enregistré sur cet appareil (mode démo)'}
          </span>
        </div>}
      </div>}
      {/* Top action bar (hidden during print) */}
      <div className="report-actions-bar no-print">
        <button className="btn-outline back-btn" onClick={onBackToEdit}>
          <ArrowLeft size={16} />
          <span>{isDemo ? "Retour à la carte" : "Modifier l'analyse"}</span>
        </button>

        {!isDemo && <div className="actions-right">
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
        </div>}
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
              {getAgentName()}
            </span>
            <span className="agent-rep">{user?.agency ? user.agency : "Agent certifié Citynside"}</span>
            <span className="agent-date">
              <Calendar
                size={12}
                style={{ display: "inline", marginRight: "4px" }}
              />
              {`Analyse réalisée le ${new Date(analysis.createdAt).toLocaleDateString("fr-FR")}`}
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

        {(strengths.trim() || reservations.trim()) && <section className="report-notes-strip">
          {strengths.trim() && <div><strong>Points forts</strong><p>{strengths.trim()}</p></div>}
          {reservations.trim() && <div><strong>Réserves</strong><p>{reservations.trim()}</p></div>}
        </section>}

        {/* Dual Column: Categories Breakdown + Agent Impressions */}
        <div className="sheet-grid-content single-column">
          {/* Left Column: Calculated Data Scores */}
          {includedSections.scores && <div className="sheet-col-scores">
            <h3 className="section-title">
              Indicateurs Objectifs & Données Publiques
            </h3>
            <div className="report-categories-list">
              {analysis.categories.map((cat) => {
                const nearestFactor = cat.positiveFactors?.find((factor) => /\d+\s*m/i.test(factor.label));
                const factorPlace = nearestFactor?.label.replace(/\s+à\s+\d+\s*m.*$/i, "").trim();
                const placeAlreadyMentioned = Boolean(factorPlace && cat.highlightText.toLocaleLowerCase("fr").includes(factorPlace.toLocaleLowerCase("fr")));
                return <div key={cat.category} className="report-cat-row">
                  <div className="cat-row-left">
                    <span className="cat-title-text">{cat.label}</span>
                    <span className="cat-highlight">{cat.highlightText}</span>
                    {nearestFactor && !placeAlreadyMentioned && <span className="cat-distance">Distance : {nearestFactor.label.match(/\d+\s*m/i)?.[0].replace(/m/i, ' m')}</span>}
                  </div>
                  <div className="cat-row-right">
                    <span className="cat-score-pill">
                      <b>{cat.score.toFixed(1)}</b>/10
                    </span>
                    <span className="report-score-level">{cat.score >= 9 ? "Très favorable" : cat.score >= 7 ? "Favorable" : cat.score >= 5 ? "À améliorer" : "Vigilance"}</span>
                  </div>
                  <div className="report-score-track" role="img" aria-label={`${cat.score.toFixed(1)} sur 10`}><span style={{ width: `${Math.max(0, Math.min(10, cat.score)) * 10}%` }} /></div>
                </div>;
              })}
            </div>
          </div>}

          {includedSections.risks && <section className="report-risk-section" aria-label="Risques et nuisances">
            <h3 className="section-title">Risques et nuisances</h3>
            <div className="report-risk-grid">
              <article className="report-risk-card">
                <strong>Risques recensés par Géorisques</strong>
                {analysis.riskAssessment?.status === 'loading' && <p>Consultation en cours, informations indisponibles au moment de la création du rapport.</p>}
                {analysis.riskAssessment?.status === 'unavailable' && <p>Les données Géorisques n’ont pas pu être récupérées pour cette analyse.</p>}
                {analysis.riskAssessment?.status === 'available' && positiveRiskFindings.length === 0 && <p>Aucun signal positif n’a été renvoyé à cette adresse. Cela ne signifie pas qu’il n’existe aucun risque : consultez les informations officielles à jour.</p>}
                {positiveRiskFindings.length > 0 && <ul>{positiveRiskFindings.map((finding) => <li key={finding.id}><span>{finding.label}</span><b>{finding.addressStatus}</b></li>)}</ul>}
                {!analysis.riskAssessment && <p>Aucune donnée Géorisques n’est enregistrée pour cette analyse.</p>}
                <small>Source : Géorisques · données indicatives à vérifier dans les documents réglementaires.</small>
              </article>
              <article className="report-risk-card">
                <strong>Bruit et qualité de l’air</strong>
                {(() => {
                  const score = analysis.categories.find((category) => category.category === 'tranquillite');
                  return score ? <><p><b>{score.score.toFixed(1)}/10</b> · {score.highlightText}</p><small>Estimation de l’environnement sonore et de la qualité de l’air ; ce n’est pas une mesure acoustique à l’adresse.</small></> : <p>Aucune estimation disponible pour cette analyse.</p>;
                })()}
              </article>
            </div>
          </section>}

          {/* Right Column: Agent Field Impressions */}
          {hasRightSections && <div className={`sheet-col-impressions ${includedSections.impressions ? 'has-impressions' : ''} ${includedSections.sources ? 'has-sources' : ''}`}>
            {includedSections.impressions && <>
            <h3 className="section-title">Observations Terrain de l'Agent</h3>
            <div className="impressions-report-card">
              {!analysis.impressions && <p className="imp-no-data">Aucune observation terrain renseignée pour cette analyse.</p>}
              {analysis.impressions && <>
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
              </>}
            </div>

            {/* Client Guarantee Badge */}
            <div className="guarantee-badge">
              <Award size={28} className="award-icon" />
              <div>
                <p className="g-desc">
                  {renderSpacedText("Document remis dans le cadre du devoir de conseil de l'agent immobilier.")}
                </p>
              </div>
            </div>
            </>}
            {includedSections.sources && <div className="methodology-box">
              <div className="meth-header">
                <ShieldCheck size={16} />
                <span>{renderSpacedText("Transparence & Méthodologie")}</span>
              </div>
              <p className="meth-text">
                {renderSpacedText("Les scores sont calculés à partir de plusieurs sources publiques fiables et de critères liés à l'environnement du quartier.")}
              </p>
            </div>}
          </div>}
        </div>

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

        .report-options { width: 100%; max-width: 794px; margin: 0 auto -8px; }
        .report-options-panel { margin-top: 10px; padding: 16px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 18px; background: #fff; border: 1px solid var(--color-border); border-radius: 10px; }
        .report-options-panel>strong { grid-column: 1 / -1; color: var(--color-primary); }
        .report-options-panel>label { display: flex; align-items: center; gap: 8px; color: var(--color-text-main); font-size: .82rem; }
        .report-notes-fields { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .report-notes-fields label { display: grid; gap: 6px; color: var(--color-primary); font-size: .8rem; font-weight: 650; }
        .report-notes-fields textarea { min-height: 64px; padding: 9px 11px; resize: vertical; border: 1px solid var(--color-border); border-radius: 7px; font: inherit; font-weight: 400; }
        .report-save-hint { grid-column: 1 / -1; color: var(--color-text-muted); font-size: .72rem; }
        .report-notes-strip { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 8px 0 10px; }
        .report-notes-strip>div { padding: 9px 11px; border-radius: 6px; background: #f3f7f2; }
        .report-notes-strip>div+div { background: #fff7ed; }
        .report-notes-strip strong { font-size: .67rem; text-transform: uppercase; color: var(--color-primary); }
        .report-notes-strip p { margin: 3px 0 0; font-size: .72rem; line-height: 1.35; color: #34433b; overflow-wrap: anywhere; }

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
          overflow: visible;
          /* Keep A4 width but let long reports continue below the first screen page. */
          width: 794px;
          min-height: 1120px;
          height: auto;
          max-height: none;
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
        .sheet-grid-content.single-column { grid-template-columns: 1fr; }
        .sheet-grid-content.two-columns { grid-template-columns: 1.15fr .85fr; }

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
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        .report-risk-section{grid-column:1/-1;min-width:0;margin-top:8px;break-inside:avoid;page-break-inside:avoid}.report-risk-section>.section-title{margin-bottom:10px}.report-risk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.report-risk-card{min-width:0;padding:12px 14px;border:1px solid #e5e9e2;border-radius:8px;background:#fafbf9;break-inside:avoid;page-break-inside:avoid}.report-risk-card>strong{display:block;margin-bottom:7px;color:#24443c;font-size:.76rem}.report-risk-card p,.report-risk-card small{display:block;color:#5d6e68;font-size:.69rem;line-height:1.45;overflow-wrap:anywhere}.report-risk-card small{margin-top:7px;font-size:.62rem}.report-risk-card ul{display:grid;gap:5px;margin:0;padding:0;list-style:none}.report-risk-card li{display:flex;justify-content:space-between;gap:10px;padding-top:5px;border-top:1px solid #e9ede8;color:#354841;font-size:.68rem}.report-risk-card li b{flex:0 0 auto;color:#8b5415;text-align:right}

        .report-cat-row {
          min-width: 0;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          grid-template-areas: "left right" "track track";
          row-gap: 6px;
          align-items: center;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .cat-row-left {
          grid-area: left;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow-wrap: anywhere;
        }

        .cat-title-text {
          font-family: var(--font-family-body);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--color-text-main);
          margin-bottom: 2px;
          overflow-wrap: anywhere;
        }

        .cat-highlight {
          font-family: var(--font-family-body);
          font-size: 0.76rem;
          color: var(--color-text-muted);
          overflow-wrap: anywhere;
          white-space: normal;
        }
        .cat-distance { margin-top: 3px; color: #48634f; font-size: .66rem; line-height: 1.3; overflow-wrap: anywhere; white-space: normal; }

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

        .cat-row-right { grid-area: right; min-width: 68px; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; align-self: start; }
        .report-score-level { color: #52665b; font-size: .62rem; font-weight: 700; }
        .report-score-track { grid-area: track; width: 100%; height: 4px; overflow: hidden; border-radius: 99px; background: #e7eee8; }
        .report-score-track span { display: block; height: 100%; border-radius: inherit; background: #5c8a65; }

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
          overflow-wrap: anywhere;
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
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
          border-radius: 8px;
          padding: 20px;
        }

        .imp-no-data { margin: 0; color: #52665b; font-size: .78rem; line-height: 1.5; }
        .sheet-col-impressions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; margin-top: var(--observations-page-gap, 0px); }
        .sheet-col-impressions>.section-title { grid-column: 1 / -1; margin-bottom: 0; }
        .sheet-col-impressions>.methodology-box { grid-column: 2; margin-top: 0; }
        .sheet-col-impressions:not(.has-impressions)>.methodology-box,
        .sheet-col-impressions:not(.has-sources)>.guarantee-badge { grid-column: 1 / -1; }
        .impressions-report-card .imp-no-data { grid-column: 1 / -1; }

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
          overflow-wrap: anywhere;
        }

        .imp-sub {
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          color: var(--color-text-muted);
          margin: 0;
          overflow-wrap: anywhere;
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
          overflow-wrap: anywhere;
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
            max-height: none !important;
            overflow: visible !important;
            page-break-after: auto !important;
            break-after: auto !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
        @media(max-width:700px){.report-options-panel{grid-template-columns:1fr}.report-notes-fields,.report-categories-list,.impressions-report-card,.sheet-col-impressions{grid-template-columns:1fr}.sheet-col-impressions>.methodology-box,.sheet-col-impressions:not(.has-impressions)>.methodology-box{grid-column:1}.report-cat-row{grid-template-columns:minmax(0,1fr) auto}}
      `}</style>
    </div>
  );
};
