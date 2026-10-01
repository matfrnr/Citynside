export const CURRENT_RELEASE_NOTES = {
  version: "2026-09-30-v2",
  date: "30 septembre 2026",
  title: "Les nouveautés Citynside",
  introduction: "Découvrez les dernières améliorations de votre espace de travail.",
  items: [
    {
      title: "Comparer deux quartiers",
      description: "Visualisez leurs scores et leurs équipements côte à côte, avec une phrase courte sur les principaux écarts.",
    },
    {
      title: "Rapports personnalisables",
      description: "Choisissez les sections à inclure et retrouvez vos points forts et réserves enregistrés avec votre compte.",
    },
    {
      title: "Rapports PDF plus lisibles",
      description: "Les observations commencent sur une nouvelle page lorsqu’un rapport doit être réparti sur plusieurs pages.",
    },
    {
      title: "Historique et favoris mieux organisés",
      description: "Les filtres sont répartis sur deux rangées pour faciliter la recherche de vos analyses.",
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
