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
        .cyt-sidebar {
          width: 250px;
          min-width: 250px;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #e7efe5;
          display: flex;
          flex-direction: column;
          padding: 32px 18px 24px;
          z-index: 50;
          box-shadow: 2px 0 12px rgba(0, 0, 0, 0.02);
        }

        .sidebar-brand-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          margin-bottom: 40px;
          user-select: none;
        }

        .brand-logo-container {
          width: 54px;
          height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }

        .sidebar-brand-block:hover .brand-logo-container {
          transform: scale(1.05);
        }

        .brand-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand-title {
          font-family: var(--font-family-heading);
          font-size: 1.7rem;
          font-weight: 800;
          color: #122c25;
          letter-spacing: -0.03em;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }

        .sidebar-nav-btn {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 18px;
          border-radius: var(--radius-sm);
          font-size: 0.98rem;
          font-weight: 600;
          color: #2b453d;
          transition: var(--transition-fast);
          position: relative;
        }

        .sidebar-nav-btn:hover {
          background-color: #f3f7f2;
          color: #122c25;
        }

        .sidebar-nav-btn.active {
          background-color: #9cbca4;
          color: #0e241e;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(156, 188, 164, 0.35);
        }

        .nav-icon {
          flex-shrink: 0;
        }

        .nav-badge {
          margin-left: auto;
          background: #173830;
          color: white;
          font-size: 0.72rem;
          padding: 2px 7px;
          border-radius: 99px;
          font-weight: 700;
        }

        .sidebar-footer {
          margin-top: auto;
          padding-top: 20px;
          border-top: 1px solid #edf3ec;
        }

        .agent-profile {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 8px;
          border-radius: var(--radius-sm);
          transition: background 0.15s ease;
        }

        .agent-profile:hover {
          background: #f4f8f4;
        }

        .avatar-img-wrap {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid #9cbca4;
          flex-shrink: 0;
        }

        .agent-avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .agent-label {
          font-size: 0.88rem;
          font-weight: 700;
          color: #122c25;
        }

        @media (max-width: 768px) {
          .cyt-sidebar {
            width: 76px;
            min-width: 76px;
            padding: 20px 8px;
          }
          .brand-title, .nav-label, .agent-label {
            display: none;
          }
          .sidebar-nav-btn {
            justify-content: center;
            padding: 12px;
          }
        }
      `}</style>
    </aside>
  );
};
