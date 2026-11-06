# EcoBloc — plateforme B2B de valorisation de déchets plastiques (prototype)

Prototype **fictif** d’une plateforme web pour une entreprise qui transforme des déchets plastiques en pavés, dalles et bordures **non structurels** (Bénin / Afrique de l’Ouest). Toutes les données, tous les prix, tous les documents et tous les paiements sont **fictifs ou simulés**.

Stack : Nuxt 4 (SPA) · TypeScript · Tailwind v4 · reka-ui · Lucide (`@nuxt/icon`) · GSAP + ScrollTrigger · Three.js (une scène légère) · Neon (Postgres) + Neon Auth · Cloudinary · Zod · Vitest.

## Démarrage rapide

```bash
npm install
cp .env.example .env        # puis renseigner vos clés (voir plus bas) — facultatif pour la démo
npm run dev                 # http://localhost:3000
```

Sans aucune clé, l’application fonctionne en **mode démo local** : les données de démonstration sont chargées dans le navigateur (localStorage) et un sélecteur de rôle permet de parcourir tous les espaces.

### Comptes de démonstration

Mot de passe commun : `demo1234`.

| Rôle | Identifiant | Espace |
|---|---|---|
| Client particulier | `client@ecobloc.demo` | `/espace` |
| Client professionnel | `pro@ecobloc.demo` | `/espace` |
| Distributeur | `distributeur@ecobloc.demo` | `/espace` |
| Collecteur | `collecteur@ecobloc.demo` | `/collecte` |
| Agent / chauffeur | `chauffeur@ecobloc.demo` | `/terrain` |
| Approvisionnement & stock | `appro@ecobloc.demo` | `/ops/appro` |
| Production | `production@ecobloc.demo` | `/ops/production` |
| Qualité | `qualite@ecobloc.demo` | `/ops/qualite` |
| Commercial | `commercial@ecobloc.demo` | `/ops/commercial` |
| Logistique | `logistique@ecobloc.demo` | `/ops/logistique` |
| Environnement / audit | `environnement@ecobloc.demo` | `/ops/environnement` |
| Administrateur | `admin@ecobloc.demo` | `/admin` |

Le **sélecteur de rôle** (barre en haut, mode démo uniquement) permet de changer de rôle sans se reconnecter. Il est désactivé dès que `NUXT_PUBLIC_DEMO_MODE=false`.

## Variables d’environnement

Copiez `.env.example` vers `.env` (jamais commité). Aucune clé n’est écrite dans le code.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Base Neon (Postgres). Sans elle : mode local navigateur. |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` | Neon Auth (comptes réels, jetons JWT EdDSA vérifiés côté serveur). |
| `NUXT_PUBLIC_NEON_AUTH_URL` | URL publique Neon Auth pour le navigateur. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER` | Médias (photos de collecte, preuves de livraison, documents). La clé secrète ne quitte jamais le serveur : les envois sont signés par `/api/cloudinary/sign`. |
| `NUXT_PUBLIC_DATA_MODE` | `auto` (défaut), `local` ou `neon`. |
| `NUXT_PUBLIC_DEMO_MODE` | `true` : sélecteur de rôle et comptes démo. |

### Créer le dossier Cloudinary du projet

```bash
npm run cloudinary:setup     # crée ecobloc/ et ses sous-dossiers (produits, atelier, collectes, qualite, livraisons, documents, branding, etudes-de-cas)
```

Ou, application lancée et connecté en admin : « Médias Cloudinary » → « Créer les dossiers du projet ».

### Initialiser la base Neon

```bash
npm run db:seed              # crée les tables (DDL idempotent) et charge les données de démonstration
```

Au premier appel, le serveur initialise aussi une base vide automatiquement.

## État du prototype

- **148 pages** : site public (accueil, catalogue, fiches produit, comparateur, matériaux, traçabilité, impact, FAQ, études de cas fictives, devis, commande de démonstration…) et espaces des **12 rôles** (client, pro, distributeur, collecteur, chauffeur, appro/stock, production, qualité, commercial, logistique, environnement/audit, admin).
- **4 workflows** couverts par les services métier et leurs tests : A (devis → commande → paiement simulé → préparation → livraison avec preuve), B (collecte → pesée → réception → lot de matière → versement simulé), C (ordre de fabrication → réservation → lot → contrôle → libération / rejet / quarantaine ; seuls les lots libérés alimentent les commandes), D (administration et audit).
- Vérifications faites : `nuxt typecheck` sans erreur, 154 tests Vitest, 221 fichiers `.vue` valides, `nuxt build` réussi, et parcours navigateur (Playwright) de toutes les pages de chacun des 12 rôles, détails inclus, sans erreur d’exécution.
- **Non testé depuis l’environnement de développement** : connexions réelles à Neon, Neon Auth et Cloudinary (réseau bloqué). À valider chez vous avec `npm run db:seed` et `npm run cloudinary:setup`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run preview` | Build de production et prévisualisation |
| `npm run typecheck` | Vérification TypeScript (`nuxt typecheck`) |
| `npm test` | Tests (seed, services, permissions serveur, persistance, formulaires…) |
| `npm run db:seed` | Schéma + données de démonstration dans Neon |
| `npm run cloudinary:setup` | Dossiers Cloudinary du projet |

## Architecture en bref

- `shared/` : types, rôles et permissions (collection / champ / ligne), moteur de données réactif, **services métier purs** (devis → commande → paiement → préparation → livraison ; collecte → pesée → réception → lot de matière ; ordre de fabrication → lot → contrôle qualité → libération), données de démonstration.
- `app/` : pages, composants (kit UI, graphiques SVG, scène 3D), thèmes clair « Atelier » et sombre « Graphite » personnalisables (Admin → Apparence & thèmes).
- `server/` : API Nitro (état filtré par rôle, écriture autorisée ligne par ligne, journal d’audit, vérification JWT Neon Auth, signature Cloudinary, limitation de débit).
- `docs/` : `CONTRACTS.md` (contrat de construction), `BACKEND.md` (architecture, menace, procédures Neon / Cloudinary).

## Règles de crédibilité

Aucun contenu ne prétend que les produits sont « plus résistants que le béton », « ignifuges », « sans danger », « certifiés » ou « conformes à une norme » ; aucun usage structurel ; aucune économie de CO₂ calculée automatiquement ; chaque donnée, facture, certificat ou paiement de démonstration est marqué fictif ; chaque produit porte un statut de validation (développement, essais en cours, résultats disponibles, usage autorisé).

## Modules opérationnels vs simulés

**Fonctionnent réellement (logique métier, permissions, traçabilité)** : catalogue, devis et négociation, commandes, réservation FIFO de lots libérés, collecte et pesée, réception et lots de matière, ordres de fabrication, contrôle qualité et libération, livraisons avec preuve, notifications internes, journal d’audit, rôles et permissions.

**Simulés** : paiements, remboursements, versements aux collecteurs, factures et bons de réception, documents techniques, indicateurs d’impact, notifications SMS / WhatsApp / e-mail.

## Avant toute commercialisation

Essais en laboratoire publiés produit par produit ; cadre juridique, fiscal et assurances ; agrégateur de paiement réel et facturation conforme ; procédures d’exploitation et formation ; revue de sécurité (les services s’exécutent aujourd’hui côté client — voir `docs/BACKEND.md`) ; protection des données personnelles.
