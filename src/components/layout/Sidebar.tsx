import React from 'react';
import { Home, Map, Bookmark, Bell } from 'lucide-react';
import type { AppView } from '../../types';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  favoritesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  favoritesCount,
}) => {
  const navItems = [
    { id: 'home' as AppView, label: 'Home', icon: Home },
    { id: 'new-analysis' as AppView, label: 'Carte', icon: Map },
    { id: 'enregistrements' as AppView, label: 'Enregistrements', icon: Bookmark, badge: favoritesCount },
    { id: 'notifications' as AppView, label: 'Notifications', icon: Bell },
  ];

  return (
    <aside className="cyt-sidebar">
      {/* Brand Header Stacked Centered matching mockups */}
      <div className="sidebar-brand-block" onClick={() => onNavigate('home')} role="button" tabIndex={0}>
        <div className="brand-logo-container">
          <img src="/logo-cytinside.svg" alt="Cytinside" className="brand-logo-img" />
        </div>
        <span className="brand-title">Cytinside</span>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive =
            (currentView === 'home' && item.id === 'home') ||
            (currentView === 'new-analysis' && item.id === 'new-analysis') ||
            (currentView === 'impressions' && item.id === 'new-analysis') ||
            (currentView === 'report' && item.id === 'home') ||
            currentView === item.id;

          return (
            <button
              key={item.id}
              className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <IconComponent
                className="nav-icon"
                size={20}
                strokeWidth={isActive ? 2.3 : 1.8}
              />
              <span className="nav-label">{item.label}</span>
              {Boolean(item.badge && item.badge > 0) && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile */}
      <div className="sidebar-footer">
        <div className="agent-profile">
          <div className="avatar-img-wrap">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
              alt="Agent immobilier"
              className="agent-avatar"
            />
          </div>
          <span className="agent-label">Votre Profil</span>
        </div>
      </div>

      <style>{`
        /* ===================================================
           SIDEBAR — Charte Citynside V1
           - Fond blanc, bordure droite subtile
           - Nav active : fond #153a3d + texte blanc
           - Brand : Fira Sans
           =================================================== */
        .cyt-sidebar {
          width: 252px;
          min-width: 252px;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #dce8e0;
          display: flex;
          flex-direction: column;
          padding: 28px 16px 22px;
          z-index: 50;
          box-shadow: 2px 0 16px rgba(21, 58, 61, 0.03);
        }

        .sidebar-brand-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 36px;
          user-select: none;
          padding: 8px;
          border-radius: var(--radius-sm);
          transition: background 0.15s ease;
        }

        .sidebar-brand-block:hover {
          background: var(--color-green-subtle);
        }

        .brand-logo-container {
          width: 50px;
          height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.22s ease;
        }

        .sidebar-brand-block:hover .brand-logo-container {
          transform: scale(1.06);
        }

        .brand-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        /* Fira Sans pour le logotype — Charte V1 */
        .brand-title {
          font-family: var(--font-family-heading);
          font-size: 1.55rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .sidebar-nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 16px;
          border-radius: var(--radius-sm);
          font-family: var(--font-family-body);
          font-size: 0.93rem;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: var(--transition-fast);
          position: relative;
        }

        .sidebar-nav-btn:hover {
          background-color: var(--color-green-subtle);
          color: var(--color-primary);
        }

        /* Nav active : fond #153a3d (couleur principale charte V1) */
        .sidebar-nav-btn.active {
          background-color: var(--color-primary);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(21, 58, 61, 0.30);
        }

        .nav-icon {
          flex-shrink: 0;
        }

        /* Badge en vert #9dc599 */
        .nav-badge {
          margin-left: auto;
          background: var(--color-green);
          color: var(--color-primary-dark);
          font-size: 0.70rem;
          padding: 2px 7px;
          border-radius: 99px;
          font-weight: 700;
          font-family: var(--font-family-body);
        }

        .sidebar-nav-btn.active .nav-badge {
          background: var(--color-yellow);
          color: var(--color-primary-dark);
        }

        .sidebar-footer {
          margin-top: auto;
          padding-top: 18px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .agent-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          transition: background 0.15s ease;
        }

        .agent-profile:hover {
          background: var(--color-green-subtle);
        }

        /* Bordure avatar en vert de la charte */
        .avatar-img-wrap {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--color-green);
          flex-shrink: 0;
        }

        .agent-avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .agent-label {
          font-family: var(--font-family-body);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        @media (max-width: 768px) {
          .cyt-sidebar {
            width: 68px;
            min-width: 68px;
            padding: 18px 8px;
          }
          .brand-title, .nav-label, .agent-label {
            display: none;
          }
          .sidebar-nav-btn {
            justify-content: center;
            padding: 11px;
          }
        }
      `}</style>
    </aside>
  );
};
