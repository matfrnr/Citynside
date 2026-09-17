import { CheckCircle2, FileText, Info } from 'lucide-react';

export const NotificationsView: React.FC = () => {
  const notifications = [
    {
      id: '1',
      title: 'Mise à jour des données de transport (TAG / SNCF)',
      desc: 'Nouvelle fréquence de desserte intégrée pour les lignes de tramway à Grenoble.',
      date: 'Aujourd’hui à 10:14',
      type: 'info',
      icon: Info,
    },
    {
      id: '2',
      title: 'Rapport consulté par un acquéreur',
      desc: 'Le rapport PDF pour l’adresse « Place de l’Aigle » a été ouvert.',
      date: 'Hier à 17:30',
      type: 'success',
      icon: CheckCircle2,
    },
    {
      id: '3',
      title: 'Projet d’aménagement urbain détecté',
      desc: 'Création d’une nouvelle piste cyclable sécurisée à 200m du Quartier Europole.',
      date: 'Il y a 3 jours',
      type: 'alert',
      icon: FileText,
    },
  ];

  return (
    <div className="notifications-container">
      <div className="notif-header">
        <h1 className="notif-title">Centre de Notifications</h1>
        <p className="notif-subtitle">Veille territoriale et activité de vos diagnostics clients</p>
      </div>

      <div className="notif-list">
        {notifications.map((n) => {
          const IconComp = n.icon;
          return (
            <div key={n.id} className="notif-card cyt-card">
              <div className="notif-icon-wrap">
                <IconComp size={20} />
              </div>
              <div className="notif-content">
                <div className="notif-top">
                  <h3 className="notif-item-title">{n.title}</h3>
                  <span className="notif-date">{n.date}</span>
                </div>
                <p className="notif-desc">{n.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        /* NotificationsView — Charte Citynside V1 */
        .notifications-container {
          max-width: 760px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .notif-header {
          text-align: center;
        }

        .notif-title {
          font-size: 2rem;
          color: var(--color-primary);
          font-weight: 700;
        }

        .notif-subtitle {
          font-family: var(--font-family-body);
          font-size: 0.9rem;
          color: var(--color-text-muted);
          margin-top: 4px;
          font-weight: 400;
        }

        .notif-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .notif-card {
          display: flex;
          gap: 16px;
          padding: 16px 20px;
          background: #ffffff;
        }

        /* Icône en fond vert de la charte */
        .notif-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: var(--color-green-light);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notif-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .notif-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .notif-item-title {
          font-family: var(--font-family-body);
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .notif-date {
          font-family: var(--font-family-body);
          font-size: 0.73rem;
          color: var(--color-text-subtle);
        }

        .notif-desc {
          font-family: var(--font-family-body);
          font-size: 0.83rem;
          color: var(--color-text-muted);
          line-height: 1.4;
          font-weight: 400;
        }
      `}</style>
    </div>
  );
};
