# Citynside

Application React, TypeScript et Vite pour analyser un quartier et générer un rapport.

## Développement local

1. Installez les dépendances avec `npm install`.
2. Copiez `.env.example` vers `.env` et remplacez les valeurs d’exemple :
   - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` configurent l’authentification et les profils dans l’interface.
   - `VITE_MAPBOX_TOKEN` active les recherches de lieux Mapbox.
   - `GROQ_API_KEY` active l’assistant de quartier. Cette clé est réservée au serveur et ne doit jamais être préfixée par `VITE_`.
   - `SUPABASE_URL` et `SUPABASE_ANON_KEY` sont utilisés par l’assistant côté serveur.
   - `GEORISQUES_PROXY_ORIGIN` est facultatif en local. Sans cette valeur, Vite relaie les requêtes Géorisques vers le service officiel.
3. Lancez `npm run dev`.

Les comptes se connectent avec Supabase Auth. L’interface permet de se connecter et de réinitialiser un mot de passe; la création des comptes se fait dans Supabase.

## Commandes

- `npm run dev` : serveur de développement Vite.
- `npm run build` : vérification TypeScript et compilation de production.
- `npm run preview` : prévisualisation du build.
- `npm run lint` : vérification statique avec Oxlint.

## Déploiement

Le projet est configuré pour Vercel. Les routes du dossier `api/` sont déployées comme fonctions Vercel; la fonction Géorisques est configurée dans la région `cdg1` dans `vercel.json`. Renseignez les variables serveur de l’assistant dans les paramètres du projet Vercel. Les variables `VITE_*` sont intégrées à l’interface au moment du build et doivent être définies avant celui-ci.

Les analyses et préférences locales sont conservées dans le navigateur. Les informations de profil sont enregistrées dans la table Supabase `profiles` ainsi que dans les métadonnées du compte.
