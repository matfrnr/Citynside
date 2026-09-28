import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { HomeView } from './components/views/HomeView';
import { NewAnalysisView } from './components/views/NewAnalysisView';
import { ImpressionsView } from './components/views/ImpressionsView';
import { ReportView } from './components/views/ReportView';
import { EnregistrementsView } from './components/views/EnregistrementsView';
import { NotificationsView } from './components/views/NotificationsView';
import type { AppView, NeighborhoodAnalysis, FieldImpressions } from './types';
import { getStoredAnalyses, saveAnalysis, toggleFavorite } from './services/storage';

export const App: React.FC = () => {
  const [analyses, setAnalyses] = useState<NeighborhoodAnalysis[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [activeAnalysis, setActiveAnalysis] = useState<NeighborhoodAnalysis | null>(null);

  // Load initial analyses from storage
  useEffect(() => {
    const loaded = getStoredAnalyses();
    setAnalyses(loaded);
    if (loaded.length > 0) {
      setActiveAnalysis(loaded[0]);
    }
  }, []);

  const handleSelectAnalysis = (analysis: NeighborhoodAnalysis) => {
    setActiveAnalysis(analysis);
    setCurrentView('report');
  };

  const handleStartNewAnalysis = () => {
    // A new search must start from a genuinely blank state.
    setActiveAnalysis(null);
    setCurrentView('new-analysis');
  };

  const handleUpdateAnalysis = (updated: NeighborhoodAnalysis) => {
    setActiveAnalysis(updated);
    saveAnalysis(updated);
    setAnalyses(getStoredAnalyses());
  };

  const handleGoToImpressions = () => {
    setCurrentView('impressions');
  };

  const handleSaveImpressions = (impressions: FieldImpressions) => {
    if (!activeAnalysis) return;

    const updated: NeighborhoodAnalysis = {
      ...activeAnalysis,
      impressions,
    };

    setActiveAnalysis(updated);
    saveAnalysis(updated);
    setAnalyses(getStoredAnalyses());
    setCurrentView('report');
  };

  const handleToggleFav = (id: string) => {
    toggleFavorite(id);
    const updatedList = getStoredAnalyses();
    setAnalyses(updatedList);
    if (activeAnalysis && activeAnalysis.id === id) {
      setActiveAnalysis({
        ...activeAnalysis,
        isFavorite: !activeAnalysis.isFavorite,
      });
    }
  };

  const favoritesCount = analyses.filter((a) => a.isFavorite).length;

  return (
    <div className="cyt-app-layout">
      {/* Fixed Sidebar */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'new-analysis') {
            handleStartNewAnalysis();
            return;
          }
          setCurrentView(view);
        }}
        favoritesCount={favoritesCount}
      />

      {/* Main Tablet Content Area */}
      <main className="cyt-main-viewport">
        <div className="main-scroll-inner">
          {currentView === 'home' && (
            <HomeView
              analyses={analyses}
              onSelectAnalysis={handleSelectAnalysis}
              onStartNewAnalysis={handleStartNewAnalysis}
              onToggleFavorite={handleToggleFav}
            />
          )}

          {currentView === 'new-analysis' && (
            <NewAnalysisView
              currentAnalysis={activeAnalysis}
              onUpdateAnalysis={handleUpdateAnalysis}
              onGoToImpressions={handleGoToImpressions}
            />
          )}

          {currentView === 'impressions' && activeAnalysis && (
            <ImpressionsView
              analysis={activeAnalysis}
              onSaveImpressions={handleSaveImpressions}
              onBack={() => setCurrentView('new-analysis')}
            />
          )}

          {currentView === 'report' && activeAnalysis && (
            <ReportView
              analysis={activeAnalysis}
              onBackToEdit={() => setCurrentView('new-analysis')}
            />
          )}

          {currentView === 'enregistrements' && (
            <EnregistrementsView
              analyses={analyses}
              onSelectAnalysis={handleSelectAnalysis}
              onToggleFavorite={handleToggleFav}
            />
          )}

          {currentView === 'notifications' && <NotificationsView />}
        </div>
      </main>

      <style>{`
        .cyt-app-layout {
          display: flex;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-color: var(--color-bg-app);
        }

        .cyt-main-viewport {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          position: relative;
        }

        .main-scroll-inner {
          padding: 32px 36px 48px;
          min-height: 100%;
        }

        @media (max-width: 768px) {
          .main-scroll-inner {
            padding: 20px 16px 36px;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
