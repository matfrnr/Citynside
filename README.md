# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Accès agents Citynside

Le serveur d’authentification requiert Node.js 24 ou supérieur (SQLite intégré à Node). Les comptes ne peuvent être créés qu’avec une clé d’invitation à usage unique.

1. Installez les dépendances avec `npm install`.
2. Créez une clé avec `npm run invite:create`, puis transmettez-la à l’agent par un canal privé. La clé en clair n’est affichée qu’à sa création; seule son empreinte est enregistrée.
3. Lancez `npm run dev`. L’interface démarre sur `http://localhost:5173` et l’API d’authentification sur le port `3001`.
4. L’agent choisit « Inscription », saisit son nom, son adresse professionnelle, sa clé et un mot de passe d’au moins 12 caractères.

La base des comptes et invitations est créée dans `data/citynside.sqlite` (ignorée par Git). Pour changer son emplacement, définissez `CITYNSIDE_DATA_DIR`. L’API écoute sur `127.0.0.1:3001` par défaut; `API_HOST` et `API_PORT` permettent de configurer son écoute.

### Assistant IA de quartier

L’assistant utilise l’API Groq côté serveur. Pour le développement local, copiez `.env.example` vers `.env`, puis renseignez `GROQ_API_KEY`, `SUPABASE_URL` et `SUPABASE_ANON_KEY` (les variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont aussi reconnues localement). Pour Vercel ou Netlify, configurez ces trois variables dans les variables d’environnement du projet. Ne préfixez jamais la clé Groq par `VITE_` et ne la publiez pas dans le navigateur.

Les requêtes sont réservées aux utilisateurs connectés. Le quota partagé est de 50 requêtes par jour pour toute l’équipe, avec une limite par compte de 20 requêtes sur une heure et 5 sur 10 minutes. Les quotas sont enregistrés dans Supabase : appliquez la migration `supabase/migrations/20261009_assistant_shared_quota.sql` avant d’activer l’assistant. L’interface avertit l’utilisateur à l’approche des plafonds et lorsqu’un plafond est atteint. Les questions hors sujet sont bloquées dans l’interface et côté serveur, sans consommer de quota. Seuls les scores, les libellés et les résumés d’indicateurs sont transmis; l’adresse précise et les coordonnées ne le sont pas. En l’absence de clé Groq, l’assistant affiche un message de configuration.

En production, servez l’application et l’API sous la même origine derrière un reverse proxy HTTPS, définissez `NODE_ENV=production` pour activer l’attribut `Secure` du cookie, protégez les sauvegardes SQLite et ne publiez jamais une clé d’invitation. Les analyses et les champs du profil restent dans le `localStorage` du navigateur, isolés par compte sur cet appareil; ils ne sont pas synchronisés entre appareils et ne sont pas stockés dans la base serveur.
