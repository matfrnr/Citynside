export const CURRENT_RELEASE_NOTES = {
  version: "2026-10-10-v2",
  date: "10 octobre 2026",
  title: "Citynside se réinvente",
  introduction: "Depuis la V1, l’application a été repensée pour vous aider à analyser, comparer et présenter les quartiers plus simplement.",
  items: [
    {
      title: "Une application entièrement repensée",
      description: "Une nouvelle interface et une navigation plus claire réunissent vos analyses, votre carte et vos rapports dans un espace plus simple à parcourir.",
    },
    {
      title: "Comparez les quartiers côte à côte",
      description: "Mettez deux analyses en regard pour repérer plus facilement leurs différences, leurs atouts et leurs points de vigilance.",
    },
    {
      title: "Personnalisez votre expérience",
      description: "Choisissez vos préférences d’affichage et d’analyse, comme la page d’accueil, les réglages de la carte, le profil de score ou les unités de distance.",
    },
    {
      title: "Posez vos questions au chatbot Citynside",
      description: "Échangez en langage naturel sur un quartier : le chatbot s’appuie sur les indicateurs de l’analyse pour vous apporter des explications plus concrètes.",
    },
    {
      title: "Et plusieurs améliorations au quotidien",
      description: "Avatars prédéfinis, résultats PMR plus lisibles, accès direct au rapport officiel Géorisques et reconnexion plus fluide complètent cette évolution.",
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
