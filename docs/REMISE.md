# Remise du projet EcoBloc

## Résumé transmis

Le compte rendu fourni indique qu'un ZIP final nommé `ecobloc-final.zip` a été préparé avec 388 fichiers et 148 pages. Il précise que le ZIP ne contient ni `.env`, ni `node_modules`, ni clés. **Ce ZIP n'est pas présent dans le dossier de travail actuel** (`D:\Incomplets\ecobloc-final`).

Les éléments ci-dessous reprennent les vérifications et constats communiqués avec le projet; ils n'ont pas tous été rejoués dans cette session.

## Vérifications rapportées

- `nuxt typecheck` ne remonte aucune erreur.
- Les 154 tests Vitest passent.
- Le build de production réussit.
- Les pages des 12 rôles ont été parcourues dans un navigateur, y compris les détails (dossiers, commandes, lots et contrôles), avec les comptes de démonstration; aucune erreur d'exécution n'a été relevée.
- L'affichage « introuvable » pour une commande appartenant à un autre client est volontaire : chaque client ne voit que ses commandes.
- Les workflows A (devis → livraison), B (collecte → lot de matière) et C (fabrication → contrôle → libération) sont couverts par des tests de services métier.
- Le parcours d'administration et d'audit (D) a été vérifié dans le navigateur, sans scénario de test dédié.
- Un défaut de chargement des icônes depuis un service externe a été corrigé : elles sont désormais servies par l'application.

## Installation et lancement

```bash
npm install
cp .env.example .env     # renseigner les clés si nécessaire; facultatif pour la démo
npm run dev              # http://localhost:3000
```

Sans clés, l'application fonctionne en mode local avec les données de démonstration.

## Comptes de démonstration

Mot de passe commun : `demo1234`. L'identifiant est `<rôle>@ecobloc.demo` pour chacun de ces rôles :

- `client`
- `pro`
- `distributeur`
- `collecteur`
- `chauffeur`
- `appro`
- `production`
- `qualite`
- `commercial`
- `logistique`
- `environnement`
- `admin`

Le sélecteur de rôle en haut de page est disponible uniquement en mode démo.

## Services externes à configurer

Les connexions à Neon, Neon Auth et Cloudinary n'ont pas pu être testées depuis l'environnement de développement. Les identifiants sont censés rester dans le `.env` local et ne pas figurer dans le ZIP; aucun fichier `.env` n'est présent dans le dossier de travail actuellement inspecté.

Après avoir renseigné les variables nécessaires dans `.env` :

```bash
npm run cloudinary:setup   # crée ecobloc/ et ses sous-dossiers
npm run db:seed            # initialise le schéma et les données de démonstration dans Neon
```

La création des dossiers Cloudinary est également disponible dans **Admin → Médias**. Sans clés, le mode local de démonstration reste utilisable.

## Fonctionnel et simulé

**Fonctionnel :** catalogue, devis, commandes, réservation des lots libérés, collecte et pesée, réception, lots de matière, ordres de fabrication, contrôle qualité et libération, livraisons avec preuve, permissions et journal d'audit.

**Simulé :** paiements, remboursements, versements aux collecteurs, factures, documents techniques, indicateurs d'impact et notifications SMS / WhatsApp / e-mail. Ces éléments sont indiqués comme fictifs dans l'interface.

## Avant toute commercialisation

- Publier les essais en laboratoire produit par produit.
- Valider le cadre juridique, fiscal et les assurances.
- Intégrer un agrégateur de paiement réel et une facturation conforme.
- Réaliser une revue de sécurité : les services métier s'exécutent encore côté client (voir [BACKEND.md](./BACKEND.md)).
- Mettre en place les protections nécessaires pour les données personnelles.
- Définir les procédures d'exploitation et former les équipes.
