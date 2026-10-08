import {
  Bell,
  Star,
  Home,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  GitCompareArrows,
  History,
  SlidersHorizontal,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { AppView } from "../../types";

const SIDEBAR_COLLAPSED_KEY = "citynside_sidebar_collapsed";

interface SidebarProps {
  currentView: AppView;
  displayName: string;
  onNavigate: (view: AppView) => void;
  favoritesCount: number;
  importantNotificationsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  displayName,
  onNavigate,
  favoritesCount,
  importantNotificationsCount,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isHovered, setIsHovered] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches,
  );
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const syncLayout = () => setIsMobileLayout(media.matches);
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  const isMac =
    typeof navigator !== "undefined" &&
    /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform || navigator.userAgent);
  const shortcutLabel = isMac ? "⌘B" : "Ctrl+B";

  const updateTooltipPos = () => {
    if (toggleBtnRef.current) {
      const rect = toggleBtnRef.current.getBoundingClientRect();
      if (isCollapsed) {
        setTooltipPos({
          top: rect.top + rect.height / 2,
          left: rect.right + 12,
        });
      } else {
        setTooltipPos({
          top: rect.bottom + 10,
          right: window.innerWidth - rect.right,
        });
      }
    }
  };

  const toggleCollapsed = () => {
    setIsHovered(false);
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Fermer l'infobulle au scroll ou resize
  useEffect(() => {
    const handleDismiss = () => setIsHovered(false);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss);
    return () => {
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss);
    };
  }, []);

  // Raccourci clavier Ctrl+B / Cmd+B pour replier / déplier le menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase() || "AG";

  const navItems = [
    { id: "home" as AppView, label: "Home", icon: Home },
    { id: "new-analysis" as AppView, label: "Carte", icon: Map },
    {
      id: "enregistrements" as AppView,
      label: "Historique",
      icon: History,
    },
    { id: "favoris" as AppView, label: "Favoris", icon: Star, badge: favoritesCount },
    { id: "comparison" as AppView, label: "Comparer", icon: GitCompareArrows },
    { id: "personalisation" as AppView, label: "Personnalisation", icon: SlidersHorizontal },
    { id: "notifications" as AppView, label: "Notifications", icon: Bell, badge: importantNotificationsCount },
  ];

  return (
    <aside className={`cyt-sidebar ${isCollapsed ? "is-collapsed" : ""}`}>
      {/* En-tête : Logo + Marque + Bouton replier */}
      <div className="sidebar-header-row">
        <div
          className="sidebar-brand-block"
          onClick={() => onNavigate("home")}
          role="button"
          tabIndex={0}
          title={isCollapsed ? "Citynside — Accueil" : undefined}
        >
          <div className="brand-logo-container">
            <img
              src="/logo-citynside.svg"
              alt="Citynside"
              className="brand-logo-img"
            />
          </div>
          {!isCollapsed && <span className="brand-title">Citynside</span>}
        </div>

        {isCollapsed && <div className="collapsed-header-divider" aria-hidden="true" />}

        <button
          ref={toggleBtnRef}
          type="button"
          className="sidebar-collapse-toggle"
          onClick={toggleCollapsed}
          onMouseEnter={() => {
            updateTooltipPos();
            setIsHovered(true);
          }}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => {
            updateTooltipPos();
            setIsHovered(true);
          }}
          onBlur={() => setIsHovered(false)}
          aria-label={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          <span className={`toggle-icon-wrap ${isCollapsed ? "is-collapsed" : ""}`}>
            {isCollapsed ? (
              <PanelLeftOpen size={18} strokeWidth={2.2} />
            ) : (
              <PanelLeftClose size={18} strokeWidth={2.2} />
            )}
          </span>
        </button>

        {/* Infobulle flottante stylée */}
        {isHovered && tooltipPos && (
          <div
            className={`sidebar-floating-tooltip ${isCollapsed ? "tooltip-right" : "tooltip-bottom"}`}
            style={{
              top: `${tooltipPos.top}px`,
              ...(tooltipPos.left !== undefined ? { left: `${tooltipPos.left}px` } : {}),
              ...(tooltipPos.right !== undefined ? { right: `${tooltipPos.right}px` } : {}),
            }}
            role="tooltip"
          >
            <span className="tooltip-text">
              {isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
            </span>
            <kbd className="tooltip-shortcut">{shortcutLabel}</kbd>
          </div>
        )}
      </div>

      {/* Liens de navigation */}
      <nav className="sidebar-nav" aria-label="Menu principal">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          const isActive =
            (currentView === "home" && item.id === "home") ||
            (currentView === "new-analysis" && item.id === "new-analysis") ||
            (currentView === "impressions" && item.id === "new-analysis") ||
            (currentView === "report" && item.id === "home") ||
            currentView === item.id;

          const itemTitle = isCollapsed
            ? `${item.label}${item.badge && item.badge > 0 ? ` (${item.badge})` : ""}`
            : undefined;

          return (
            <button
              key={item.id}
              className={`sidebar-nav-btn ${isActive ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              title={itemTitle}
              aria-current={isActive ? "page" : undefined}
            >
              <div className="nav-icon-wrapper">
                <IconComponent
                  className="nav-icon"
                  size={20}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                {Boolean(isCollapsed && typeof item.badge === "number" && item.badge > 0) && (
                  <span className="badge-dot-compact">
                    {item.badge! > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>

              {(!isCollapsed || isMobileLayout) && <span className="nav-label">{item.label}</span>}

              {Boolean(!isCollapsed && item.badge && item.badge > 0) && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Profil en pied de menu */}
      <div className="sidebar-footer">
        <button
          className={`agent-profile ${currentView === "profile" ? "active" : ""}`}
          onClick={() => onNavigate("profile")}
          aria-current={currentView === "profile" ? "page" : undefined}
          title={isCollapsed ? `Votre Profil (${displayName})` : undefined}
        >
          <div className="avatar-img-wrap">
            <span className="agent-avatar" aria-hidden="true">
              {initials}
            </span>
          </div>

          {!isCollapsed && (
            <div className="agent-info-text">
              <span className="agent-label">Votre Profil</span>
              <span className="agent-subname" title={displayName}>
                {displayName}
              </span>
            </div>
          )}
        </button>
      </div>

      <style>{`
        /* ===================================================
           SIDEBAR — Charte Citynside V1 (Menu Repliant)
           =================================================== */
        .cyt-sidebar {
          width: 252px;
          min-width: 252px;
          height: 100vh;
          background: #ffffff;
          border-right: 1px solid #dce8e0;
          display: flex;
          flex-direction: column;
          padding: 22px 14px 20px;
          z-index: 50;
          box-shadow: 2px 0 16px rgba(21, 58, 61, 0.03);
          transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
                      min-width 0.22s cubic-bezier(0.4, 0, 0.2, 1),
                      padding 0.22s ease;
          overflow: hidden;
        }

        /* État replié : menu compact rail */
        .cyt-sidebar.is-collapsed {
          width: 74px;
          min-width: 74px;
          padding: 20px 10px;
        }

        /* En-tête : logo + toggle */
        .sidebar-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 28px;
          min-height: 44px;
        }

        .cyt-sidebar.is-collapsed .sidebar-header-row {
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .sidebar-brand-block {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          padding: 6px 8px;
          border-radius: var(--radius-sm);
          transition: background 0.15s ease;
          min-width: 0;
        }

        .sidebar-brand-block:hover {
          background: var(--color-green-subtle);
        }

        .cyt-sidebar.is-collapsed .sidebar-brand-block {
          padding: 4px;
        }

        .brand-logo-container {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease;
        }

        .sidebar-brand-block:hover .brand-logo-container {
          transform: scale(1.06);
        }

        .brand-logo-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .brand-title {
          font-family: var(--font-family-heading);
          font-size: 1.42rem;
          font-weight: 700;
          color: var(--color-primary);
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        /* Bouton toggle replier / déplier */
        .sidebar-collapse-toggle {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          border: 1px solid rgba(21, 58, 61, 0.12);
          background: #ffffff;
          color: var(--color-primary);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          box-shadow: 0 1px 2px rgba(21, 58, 61, 0.04), 0 0 0 1px rgba(21, 58, 61, 0.02);
          transition: background 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
                      border-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
                      color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
                      box-shadow 0.18s cubic-bezier(0.2, 0.8, 0.2, 1),
                      transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
          flex-shrink: 0;
          outline: none;
        }

        .sidebar-collapse-toggle:hover {
          background: linear-gradient(135deg, #f4faf3 0%, #ebf5ea 100%);
          border-color: var(--color-green);
          color: var(--color-primary-dark);
          box-shadow: 0 3px 10px rgba(157, 197, 153, 0.35), 0 1px 2px rgba(21, 58, 61, 0.05);
          transform: translateY(-1px);
        }

        .sidebar-collapse-toggle:focus-visible {
          border-color: var(--color-green);
          box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px var(--color-green);
        }

        .sidebar-collapse-toggle:active {
          transform: translateY(0) scale(0.93);
          box-shadow: inset 0 1px 2px rgba(21, 58, 61, 0.12);
          background: #e2eee1;
        }

        /* En mode replié */
        .cyt-sidebar.is-collapsed .sidebar-collapse-toggle {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid rgba(21, 58, 61, 0.13);
          box-shadow: 0 1px 3px rgba(21, 58, 61, 0.05);
        }

        .cyt-sidebar.is-collapsed .sidebar-collapse-toggle:hover {
          background: linear-gradient(135deg, #f0f8ef 0%, #e4f2e2 100%);
          border-color: var(--color-green);
          box-shadow: 0 4px 14px rgba(157, 197, 153, 0.42), 0 1px 3px rgba(21, 58, 61, 0.06);
        }

        /* Séparateur subtil entre logo et toggle en mode replié */
        .collapsed-header-divider {
          width: 24px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(21, 58, 61, 0.12), transparent);
          margin: 1px 0;
        }

        /* Micro-animation de l'icône : direction intuitive */
        .toggle-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .sidebar-collapse-toggle:hover .toggle-icon-wrap {
          transform: translateX(-1.5px);
        }

        .sidebar-collapse-toggle:hover .toggle-icon-wrap.is-collapsed {
          transform: translateX(1.5px);
        }

        /* Infobulle flottante stylée */
        .sidebar-floating-tooltip {
          position: fixed;
          z-index: 99999;
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          background: #153a3d;
          border: 1px solid rgba(157, 197, 153, 0.35);
          border-radius: 7px;
          box-shadow: 0 6px 20px rgba(14, 35, 37, 0.28), 0 1px 4px rgba(0, 0, 0, 0.12);
          color: #ffffff;
          font-family: var(--font-family-body);
          font-size: 0.78rem;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          user-select: none;
          animation: tooltipFadeIn 0.15s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .sidebar-floating-tooltip.tooltip-right {
          transform: translateY(-50%);
          animation-name: tooltipFadeInRight;
        }

        .sidebar-floating-tooltip.tooltip-bottom {
          transform-origin: top right;
        }

        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-3px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes tooltipFadeInRight {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }

        .tooltip-text {
          letter-spacing: -0.01em;
          color: #f1f8f3;
        }

        .tooltip-shortcut {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 4px;
          padding: 1px 5px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.69rem;
          font-weight: 600;
          color: var(--color-yellow);
          line-height: 1.2;
        }

        /* Navigation */
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
          padding: 11px 14px;
          border-radius: var(--radius-sm);
          font-family: var(--font-family-body);
          font-size: 0.92rem;
          font-weight: 500;
          color: var(--color-text-muted);
          transition: background-color 0.15s ease, color 0.15s ease;
          position: relative;
          border: 0;
          background: transparent;
          cursor: pointer;
          text-align: left;
          width: 100%;
        }

        .cyt-sidebar.is-collapsed .sidebar-nav-btn {
          justify-content: center;
          padding: 12px 0;
          gap: 0;
        }

        .sidebar-nav-btn:hover {
          background-color: var(--color-green-subtle);
          color: var(--color-primary);
        }

        .sidebar-nav-btn.active {
          background-color: var(--color-primary);
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(21, 58, 61, 0.28);
        }

        .nav-icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .nav-icon {
          flex-shrink: 0;
        }

        .nav-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Badge étendu */
        .nav-badge {
          margin-left: auto;
          background: var(--color-green);
          color: var(--color-primary-dark);
          font-size: 0.70rem;
          padding: 2px 7px;
          border-radius: 99px;
          font-weight: 700;
          font-family: var(--font-family-body);
          flex-shrink: 0;
        }

        .sidebar-nav-btn.active .nav-badge {
          background: var(--color-yellow);
          color: var(--color-primary-dark);
        }

        /* Badge compact sur icône */
        .badge-dot-compact {
          position: absolute;
          top: -6px;
          right: -8px;
          background: var(--color-green);
          color: var(--color-primary-dark);
          font-size: 0.62rem;
          font-weight: 700;
          min-width: 16px;
          height: 16px;
          padding: 0 3px;
          border-radius: 99px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }

        .sidebar-nav-btn.active .badge-dot-compact {
          background: var(--color-yellow);
          color: var(--color-primary-dark);
        }

        /* Pied de menu (Profil) */
        .sidebar-footer {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid var(--color-border-subtle);
        }

        .agent-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          padding: 8px 10px;
          width: 100%;
          border: 0;
          background: transparent;
          text-align: left;
          border-radius: var(--radius-sm);
          transition: background 0.15s ease;
          min-width: 0;
        }

        .cyt-sidebar.is-collapsed .agent-profile {
          justify-content: center;
          padding: 8px 0;
        }

        .agent-profile:hover {
          background: var(--color-green-subtle);
        }

        .agent-profile.active {
          background: var(--color-green-light);
        }

        .avatar-img-wrap {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid var(--color-green);
          flex-shrink: 0;
        }

        .agent-avatar {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          background: var(--color-green-light);
          color: var(--color-primary);
          font-family: var(--font-family-body);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .agent-info-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
        }

        .agent-label {
          font-family: var(--font-family-body);
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--color-primary);
          line-height: 1.2;
        }

        .agent-subname {
          font-family: var(--font-family-body);
          font-size: 0.72rem;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .cyt-sidebar, .cyt-sidebar.is-collapsed { width: 74px; min-width: 74px; padding: 18px 8px; }
          .sidebar-header-row, .cyt-sidebar.is-collapsed .sidebar-header-row { justify-content: center; margin-bottom: 20px; }
          .brand-title, .nav-label, .agent-info-text, .sidebar-collapse-toggle { display: none !important; }
          .sidebar-nav-btn, .cyt-sidebar.is-collapsed .sidebar-nav-btn { justify-content: center; padding: 12px 0; }
          .sidebar-nav-btn { position: relative; }
          .nav-icon-wrapper { margin-top: 0; }
          .sidebar-nav-btn .nav-badge { position: absolute; top: 3px; right: 5px; margin: 0; min-width: 16px; height: 16px; padding: 0 3px; display: flex; align-items: center; justify-content: center; font-size: .58rem; }
          .sidebar-nav-btn .badge-dot-compact { top: -2px; right: -6px; }
          .sidebar-footer { padding-top: 10px; }
          .agent-profile, .cyt-sidebar.is-collapsed .agent-profile { justify-content: center; padding: 8px 0; }
        }

        @media (max-width: 768px) {
          .cyt-sidebar, .cyt-sidebar.is-collapsed {
            position: fixed; inset: auto 0 0; z-index: 100; width: 100%; min-width: 0;
            height: calc(72px + env(safe-area-inset-bottom)); padding: 5px 6px calc(5px + env(safe-area-inset-bottom));
            box-sizing: border-box; flex-direction: row; align-items: stretch; gap: 4px;
            overflow: hidden; border: 0; border-top: 1px solid #dce8e0; box-shadow: 0 -5px 20px rgba(21,58,61,.09);
          }
          .sidebar-header-row { display: none; }
          .sidebar-nav {
            min-width: 0; flex: 1; flex-direction: row; align-items: stretch; gap: 2px;
            overflow-x: auto; overflow-y: hidden; scrollbar-width: none; overscroll-behavior-x: contain;
          }
          .sidebar-nav::-webkit-scrollbar { display: none; }
          .sidebar-nav-btn, .cyt-sidebar.is-collapsed .sidebar-nav-btn {
            position: relative; flex: 0 0 60px; width: 60px; min-width: 60px; height: 100%; min-height: 0;
            display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 3px;
            padding: 5px 2px; border-radius: 10px; box-shadow: none;
          }
          .nav-label { display: block !important; max-width: 58px; font-size: .58rem; line-height: 1.1; text-align: center; }
          .nav-icon-wrapper { margin: 0; }
          .nav-badge, .badge-dot-compact { position: absolute; top: 1px; right: 5px; margin: 0; min-width: 15px; height: 15px; padding: 0 3px; display: flex; align-items: center; justify-content: center; line-height: 1; text-align: center; font-size: .55rem; box-sizing: border-box; }
          .sidebar-footer { flex: 0 0 50px; width: 50px; margin: 0; padding: 0; border: 0; display: flex; align-items: center; }
          .agent-profile, .cyt-sidebar.is-collapsed .agent-profile { width: 50px; justify-content: center; padding: 5px 0; }
          .agent-info-text, .brand-title { display: none !important; }
          .avatar-img-wrap { width: 32px; height: 32px; }
        }
      `}</style>
    </aside>
  );
};
