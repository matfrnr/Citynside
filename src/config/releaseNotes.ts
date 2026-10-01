export const CURRENT_RELEASE_NOTES = {
  version: "2026-10-01-v1",
  date: "1er octobre 2026",
  title: "Citynside évolue",
  introduction: "Les principales nouveautés ajoutées à votre espace ces derniers mois.",
  items: [
    {
      title: "Comparer et retrouver vos analyses",
      description: "Comparez deux quartiers côte à côte. Vos recherches sont conservées dans l’historique (20 dernières) et vous pouvez ajouter les adresses utiles à vos favoris.",
    },
    {
      title: "Des analyses plus complètes",
      description: "De nouveaux indicateurs enrichissent les scores. Les risques et nuisances peuvent être ajoutés au rapport à la demande.",
    },
    {
      title: "Rapports personnalisables et synchronisés",
      description: "Choisissez les sections du rapport, enregistrez vos points forts et réserves sur votre compte, puis consultez un aperçu et un PDF mieux mis en page.",
    },
    {
      title: "Notifications utiles",
      description: "Retrouvez les événements importants du compte et de vos rapports, avec des niveaux de priorité, un badge et la possibilité de supprimer les notifications.",
    },
    {
      title: "Accès rapides personnalisables",
      description: "Choisissez les raccourcis qui vous conviennent et retrouvez vos analyses enregistrées plus facilement.",
    },
    {
      title: "Une expérience adaptée à chaque écran",
      description: "La navigation, la recherche, la carte et les rapports s’adaptent aux mobiles et aux tablettes.",
    },
  ],
} as const;

const RELEASE_NOTES_CONTINUE_PREFIX = "citynside_release_notes_continue_";

export const releaseNotesContinueKey = (userId: string) =>
  `${RELEASE_NOTES_CONTINUE_PREFIX}${userId}`;

export const clearReleaseNotesContinueState = (userId?: string) => {
  try {
    if (userId) {
      sessionStorage.removeItem(releaseNotesContinueKey(userId));
      return;
    }
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(RELEASE_NOTES_CONTINUE_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch { /* Le stockage de session peut être désactivé par le navigateur. */ }
};
