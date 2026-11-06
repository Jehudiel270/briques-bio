# Backend EcoBloc — stockage, authentification, médias

## Architecture
- **SPA Nuxt** + **serveur Nitro** (`server/`). Le navigateur garde une copie réactive de l'état (`useDb`) et persiste chaque écriture :
  - mode `local` : `localStorage` (clé `ecobloc:db:v<version>`), aucune dépendance réseau — mode de démonstration autonome ;
  - mode `neon` : `PUT/DELETE /api/db/:collection/:id` vers Neon (Postgres), file ordonnée avec reprises ;
  - mode `auto` (défaut) : `GET /api/health` ; si `db: "neon"` → Neon, sinon repli local.
- **Stockage Neon** : deux tables, `records(collection, id, data jsonb, updated_at, seq)` et `meta(key, value)`. Le DDL est idempotent (`ensureSchema`), toutes les requêtes sont paramétrées (`server/utils/sql.ts`, testé avec PGlite).
- **Contrôle d'accès serveur** (`server/utils/rbac.ts`) : mêmes règles que le navigateur (`shared/utils/permissions.ts`) — lecture filtrée par rôle et par propriétaire au `bootstrap`, écritures contrôlées (collection, champs, propriété de la ligne, service déclaré).
- **Authentification** : Neon Auth (JWT EdDSA vérifié via JWKS distant, émetteur et audience = origine de `NEON_AUTH_BASE_URL`) ; en mode démo, comptes `<rôle>@ecobloc.demo` identifiés par `x-demo-user` (uniquement si `NUXT_PUBLIC_DEMO_MODE=true`).
- **Médias** : Cloudinary, envoi direct depuis le navigateur avec une signature fournie par `POST /api/cloudinary/sign` (le secret reste sur le serveur). Dossier racine `ecobloc/` + sous-dossiers `produits, atelier, collectes, qualite, livraisons, documents, branding, etudes-de-cas`.

## Modèle de menaces du prototype (limites assumées)
1. **Les services métier s'exécutent dans le navigateur** (`shared/services`). Le serveur vérifie que le rôle a le droit d'exécuter le service déclaré (`x-service`) mais ne rejoue pas la logique : un client malveillant autorisé à `orders.pay` pourrait écrire une commande incohérente. En production, les services doivent migrer côté serveur (même code, appelé depuis des routes `POST /api/services/<nom>` dans une transaction SQL).
2. Le journal d'audit et les notifications sont en ajout libre pour tout appelant (le serveur impose l'identité de l'appelant dans l'audit) : à durcir (service serveur) en production.
3. Les comptes de démonstration (`x-demo-user`) donnent de vrais droits tant que le mode démo est actif : **désactiver `NUXT_PUBLIC_DEMO_MODE` en production**.
4. Aucune donnée n'est réelle : paiements simulés, documents fictifs, indicateurs de démonstration.

## Variables d'environnement
Voir `.env.example` (le fichier `.env` n'est jamais versionné). `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NUXT_PUBLIC_NEON_AUTH_URL`, `CLOUDINARY_*`, `NUXT_PUBLIC_DATA_MODE` (`auto|neon|local`), `NUXT_PUBLIC_DEMO_MODE`.

## Procédures
- **Neon** : créer le projet, copier la chaîne de connexion (pooler) dans `DATABASE_URL`, puis `npm run db:seed` (`-- --reset` pour réinitialiser). Au premier appel, `/api/db/bootstrap` amorce aussi une base vide.
- **Neon Auth** : activer Neon Auth sur la branche, renseigner l'URL d'authentification (`NUXT_PUBLIC_NEON_AUTH_URL`, `NEON_AUTH_BASE_URL`) et l'URL JWKS (`…/.well-known/jwks.json`). Les inscriptions réelles sont rattachées à une ligne `users` par `POST /api/auth/sync` ; collecteur et distributeur restent « en attente de validation » jusqu'à approbation par un administrateur.
- **Cloudinary** : renseigner les trois variables `CLOUDINARY_*`, puis créer les dossiers : `npm run cloudinary:setup` (en local) ou, connecté en administrateur, **Admin → Médias Cloudinary → Créer les dossiers du projet** (`POST /api/cloudinary/folders`).

## Commandes
`npm run dev` · `npm run build` · `npm run test` · `npm run typecheck` · `npm run db:seed` · `npm run cloudinary:setup`
