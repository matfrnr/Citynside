import { useCallback, useEffect, useState } from "react";
import { Bell, Bike, Building2, CheckCircle2, ExternalLink, FileText, Landmark, Trash2, TrainFront, Wrench } from "lucide-react";
import type { AuthUser } from "../../types";
import { deleteNotification, deleteNotifications, fetchNotifications, markNotificationsRead, type AppNotification } from "../../services/notifications";
import { fetchLocalResources, type LocalResource } from "../../services/localResources";

interface NotificationsViewProps { user: AuthUser; onImportantUnreadChange?: (count: number) => void; }

const formatDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export const NotificationsView: React.FC<NotificationsViewProps> = ({ user, onImportantUnreadChange }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [resources, setResources] = useState<LocalResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<"activity" | "local">("activity");
  const city = user.agencyCity?.trim() || "";

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setNotifications(await fetchNotifications(user.id)); }
    catch { setError("Impossible de charger les notifications. Vérifiez la configuration Supabase."); }
    finally { setLoading(false); }
  }, [user.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    onImportantUnreadChange?.(notifications.filter((item) => item.importance === "important" && !item.read).length);
  }, [notifications, onImportantUnreadChange]);
  useEffect(() => {
    if (!city) { setResources([]); return; }
    let cancelled = false;
    setLoadingResources(true);
    void fetchLocalResources(city).then((items) => { if (!cancelled) setResources(items); })
      .catch(() => { if (!cancelled) setError("Les liens locaux ne sont pas accessibles pour le moment."); })
      .finally(() => { if (!cancelled) setLoadingResources(false); });
    return () => { cancelled = true; };
  }, [city]);

  const markAllRead = async () => {
    try { await markNotificationsRead(user.id); await refresh(); }
    catch { setError("Impossible de mettre à jour l’état des notifications."); }
  };

  const removeOne = async (id: string) => {
    try { await deleteNotification(user.id, id); setNotifications((current) => current.filter((item) => item.id !== id)); }
    catch { setError("Impossible de supprimer cette notification."); }
  };

  const clearSection = async () => {
    try {
      await deleteNotifications(user.id, section === "local" ? "territory" : undefined);
      setNotifications((current) => section === "local" ? current.filter((item) => item.kind !== "territory") : current.filter((item) => item.kind === "territory"));
    } catch { setError("Impossible de supprimer ces notifications."); }
  };

  const iconFor = (kind: AppNotification["kind"]) => kind === "report" ? FileText : kind === "territory" ? Bike : kind === "analysis" ? CheckCircle2 : Bell;
  const activityNotifications = notifications.filter((item) => item.kind !== "territory");
  const localNotifications = notifications.filter((item) => item.kind === "territory");
  const visibleNotifications = section === "activity" ? activityNotifications : localNotifications;
  return <div className="notifications-container">
    <header className="notif-header"><div><h1 className="notif-title">Centre de notifications</h1><p className="notif-subtitle">Activité de votre compte et informations locales.</p></div>{notifications.some((item) => !item.read) && <button className="notif-read-all" onClick={markAllRead}>Tout marquer comme lu</button>}</header>
    <nav className="notif-tabs" aria-label="Catégories de notifications">
      <button className={section === "activity" ? "active" : ""} aria-pressed={section === "activity"} onClick={() => setSection("activity")}>Activité{activityNotifications.some((item) => !item.read) && <span>{activityNotifications.filter((item) => !item.read).length}</span>}</button>
      <button className={section === "local" ? "active" : ""} aria-pressed={section === "local"} onClick={() => setSection("local")}>Veille locale{localNotifications.some((item) => !item.read) && <span>{localNotifications.filter((item) => !item.read).length}</span>}</button>
    </nav>
    {visibleNotifications.length > 0 && <button className="notif-clear-section" onClick={clearSection}><Trash2 size={15}/>Supprimer {section === "activity" ? "toute l’activité" : "toute la veille locale"}</button>}
    {section === "local" && <section className="watch-card cyt-card">
      <div className="watch-heading"><span className="watch-icon"><Landmark size={20}/></span><div><h2>Liens utiles {city && `· ${city}`}</h2><p>Sites de la commune, de son intercommunalité et ressources locales.</p></div></div>
      {!city ? <p className="watch-hint">Ajoutez la ville de votre agence dans votre profil pour afficher les ressources locales.</p> : loadingResources ? <p className="watch-hint">Recherche des sites officiels et ressources pour {city}…</p> : <ul className="local-resource-list">{resources.map((resource) => {
        const Icon = resource.id === "municipality" ? Building2 : resource.id === "intercommunal" ? Landmark : resource.id === "transit" ? TrainFront : resource.id === "works" ? Wrench : ExternalLink;
        return <li key={resource.id}><span className="resource-icon"><Icon size={18}/></span><div className="resource-copy"><strong>{resource.title}</strong><small>{resource.description}</small></div><a href={resource.url} target="_blank" rel="noreferrer" aria-label={`Ouvrir : ${resource.title}`}><ExternalLink size={16}/></a></li>;
      })}</ul>}
      <p className="watch-source">Le site de la mairie est recherché dans l’Annuaire officiel des administrations. Les autres liens ouvrent des recherches ciblées par ville.</p>
    </section>}
    {error && <p className="notif-error" role="alert">{error}</p>}
    <section className="notif-list" aria-label={section === "activity" ? "Notifications d’activité" : "Informations locales"}>{loading ? <p className="empty-notifications">Chargement des notifications…</p> : visibleNotifications.length === 0 ? section === "activity" ? <p className="empty-notifications">Aucune notification d’activité pour le moment. Les analyses, modifications du profil et rapports apparaîtront ici.</p> : null : visibleNotifications.map((n) => { const Icon = iconFor(n.kind); return <article key={n.id} className={`notif-card cyt-card ${n.read ? "is-read" : "is-unread"} priority-${n.importance}`}><div className="notif-icon-wrap"><Icon size={20}/></div><div className="notif-content"><div className="notif-top"><h3 className="notif-item-title">{n.title}{n.importance !== "normal" && <span className={`importance-badge ${n.importance}`}>{n.importance === "important" ? "Important" : "À suivre"}</span>}</h3><time className="notif-date" dateTime={n.createdAt}>{formatDate(n.createdAt)}</time></div><p className="notif-desc">{n.description}</p>{n.sourceUrl && <a className="notif-source-link" href={n.sourceUrl} target="_blank" rel="noreferrer">Voir la source <ExternalLink size={13}/></a>}</div><button className="notif-delete" aria-label={`Supprimer la notification : ${n.title}`} title="Supprimer cette notification" onClick={() => void removeOne(n.id)}><Trash2 size={16}/></button></article>; })}</section>
    <style>{`.notif-tabs{display:flex;gap:8px;border-bottom:1px solid var(--color-border)}.notif-tabs button{display:flex;align-items:center;gap:8px;padding:10px 14px;margin-bottom:-1px;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--color-text-muted);font:inherit;font-size:.86rem;cursor:pointer}.notif-tabs button.active{border-bottom-color:var(--color-primary);color:var(--color-primary);font-weight:650}.notif-tabs button span{display:grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:99px;background:#e7f3e8;color:var(--color-primary);font-size:.68rem;font-weight:700}.notif-clear-section{display:inline-flex;align-items:center;gap:7px;align-self:flex-end;border:0;background:transparent;color:#9f2d26;font:inherit;font-size:.78rem;cursor:pointer}.notif-delete{display:grid;place-items:center;flex:0 0 32px;height:32px;border:1px solid var(--color-border);border-radius:6px;background:#fff;color:#9f2d26;cursor:pointer}.notif-delete:hover,.notif-clear-section:hover{background:#fff2f0}.notif-item-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.importance-badge{display:inline-flex;align-items:center;padding:3px 8px;border-radius:99px;font-size:.64rem;font-weight:700;letter-spacing:.02em}.importance-badge.attention{background:#fff0d9;color:#a35300}.importance-badge.important{background:#fde8e7;color:#a12d27}.notif-card.priority-attention{border-left:3px solid #e99a32;background:#fffdfa}.notif-card.priority-important{border-left:3px solid #c94c43;background:#fffafa}.notif-card.priority-attention .notif-icon-wrap{background:#fff0d9;color:#a35300}.notif-card.priority-important .notif-icon-wrap{background:#fde8e7;color:#a12d27}.local-resource-list{list-style:none;padding:0;margin:0;display:grid;gap:8px}.local-resource-list li{display:flex;align-items:center;gap:11px;padding:12px;border:1px solid var(--color-border);border-radius:7px;color:var(--color-primary)}.resource-icon{display:grid;place-items:center;flex:0 0 36px;height:36px;border-radius:8px;background:#eef5eb;color:#456c54}.resource-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.resource-copy strong{font-size:.82rem}.resource-copy small{color:var(--color-text-muted);font-size:.73rem;line-height:1.4}.local-resource-list a{display:grid;place-items:center;width:32px;height:32px;color:#527f5e;border-radius:6px}.local-resource-list a:hover{background:#eef5eb}.watch-source{font-size:.7rem;color:var(--color-text-subtle)}`}</style>
    <style>{`.notifications-container{max-width:800px;margin:0 auto;display:flex;flex-direction:column;gap:20px}.notif-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.notif-title{font-size:2rem;color:var(--color-primary);font-weight:700}.notif-subtitle{font-size:.9rem;color:var(--color-text-muted);margin-top:4px}.notif-read-all,.watch-refresh{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--color-border);border-radius:7px;background:#fff;padding:9px 12px;color:var(--color-primary);font:inherit;font-size:.8rem;cursor:pointer}.watch-card{padding:20px;background:#fff;display:flex;flex-direction:column;gap:14px}.watch-heading{display:flex;align-items:center;gap:12px}.watch-heading h2{color:var(--color-primary);font-size:1rem}.watch-heading p,.watch-hint{color:var(--color-text-muted);font-size:.82rem;line-height:1.5;margin-top:4px}.watch-icon,.notif-icon-wrap{display:grid;place-items:center;flex-shrink:0;width:40px;height:40px;border-radius:10px;background:var(--color-green-light);color:var(--color-primary)}.watch-refresh{align-self:flex-start;background:var(--color-primary);color:#fff;border-color:var(--color-primary)}.watch-refresh:disabled{opacity:.65;cursor:wait}.city-items{list-style:none;padding:0;margin:0;display:grid;gap:8px}.city-items li{display:flex;align-items:center;gap:10px;padding:11px;border:1px solid var(--color-border);border-radius:7px;color:var(--color-primary)}.city-items li>span{color:#527f5e}.city-items li div{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.city-items strong{font-size:.82rem}.city-items small{font-size:.74rem;color:var(--color-text-muted)}.city-items a,.notif-source-link{color:#527f5e;display:inline-flex;align-items:center;gap:5px}.watch-source{font-size:.7rem;color:var(--color-text-subtle)}.watch-source a{color:inherit}.notif-error{color:#9f2d26;background:#fff2f0;padding:10px 12px;border-radius:6px;font-size:.82rem}.notif-list{display:flex;flex-direction:column;gap:10px}.notif-card{display:flex;align-items:flex-start;gap:14px;padding:16px 18px;background:#fff}.notif-card.is-unread{border-left:3px solid #74a16e}.notif-card.is-read{opacity:.78}.notif-content{flex:1;display:flex;flex-direction:column;gap:5px;min-width:0}.notif-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.notif-item-title{font-size:.9rem;font-weight:650;color:var(--color-primary)}.notif-date{font-size:.72rem;color:var(--color-text-subtle);white-space:nowrap}.notif-desc{font-size:.82rem;color:var(--color-text-muted);line-height:1.45}.notif-source-link{font-size:.74rem;text-decoration:none}.empty-notifications{padding:22px;background:#fff;border:1px solid var(--color-border);border-radius:8px;text-align:center;color:var(--color-text-muted);font-size:.84rem;line-height:1.5}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.notif-header,.notif-top{align-items:flex-start;flex-direction:column}.notif-date{white-space:normal}}`}</style>
  </div>;
};
