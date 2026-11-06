# EcoBloc — contrats de construction (lecture obligatoire)

Prototype B2B d'une entreprise (fictive) qui transforme des déchets plastiques en pavés, dalles et bordures non structurels, au Bénin puis en Afrique de l'Ouest. Interface 100 % en français. Cible : acheteurs professionnels, collecteurs, opérateurs de production.

**Règle d'or de crédibilité** : tout est démonstratif. Jamais d'affirmation « plus résistant que le béton », « ignifuge », « sans danger », « certifié », « conforme à la norme X », ni d'usage structurel/porteur. Les données chiffrées sont des valeurs de démonstration. Les paiements sont simulés. Utiliser les mentions de `NOTICES` (`shared/utils/labels.ts`).

---
## 1. Stack et conventions

- Nuxt 4 en mode **SPA** (`ssr: false`), TypeScript strict, Tailwind CSS v4 (tokens dans `app/assets/css/main.css`), `reka-ui` pour les primitives accessibles, icônes **Lucide via `<Icon name="lucide:xxx" />`** (module `@nuxt/icon`). Utiliser des icônes partout où elles aident (boutons, puces, statuts, vides) plutôt que de longs textes. Pas d'emoji dans l'interface.
- Animations : `gsap` (+ `gsap/ScrollTrigger`) et `three` sont installés. Toujours importés dynamiquement côté client, jamais pour des effets gratuits ; respecter `prefers-reduced-motion`.
- Répertoires : `app/` (pages, composants, composables, layouts, middleware, plugins, utils), `shared/` (types, utils, seed, services : utilisable côté serveur et client), `server/` (Nitro), `tests/` (vitest).
- Alias : `#shared/...` → `shared/...` (ex. `import { buildSeed } from '#shared/seed'`). **Auto-importés** : tout export de `shared/utils/*.ts` (top-level uniquement), les composables `app/composables`, les composants (`app/components/ui/Button.vue` → `<UiButton>`, `app/components/product/Card.vue` → `<ProductCard>`, `app/components/chart/Bar.vue` → `<ChartBar>`), les types de `shared/types`. Dans les fichiers de `shared/` et `tests/`, **importer explicitement avec des chemins relatifs** (ils doivent tourner sous vitest sans Nuxt).
- Classes Tailwind utilisant les tokens sémantiques : `bg-bg bg-surface bg-surface-2 border-line text-ink text-muted bg-primary text-primary-ink bg-accent text-accent-ink text-success text-warning text-danger text-info`, rayons `rounded-md/lg/xl` (suivent le thème), polices `font-display` (titres, chiffres clés) et `font-sans` (corps). Utilitaires maison : `.card`, `.card-flat`, `.tnum` (chiffres tabulaires — à utiliser pour tout nombre dans un tableau), `.paver-bg`, `.hazard`, `.scroll-x`. **Ne jamais coder de couleur en dur** : deux thèmes (clair « Atelier », sombre « Graphite ») + un éditeur de thème qui surcharge les variables CSS. Pour les opacités : `bg-primary/10`, `border-line`, etc.
- Textes : français, phrase en minuscules (« Demander un devis »), verbes actifs pour les boutons (« Enregistrer », « Envoyer le devis »), le même verbe dans le bouton, la confirmation et la notification. Erreurs : dire ce qui s'est passé et comment corriger, sans s'excuser. États vides : une phrase + une action.
- Style visuel : le seul moment spectaculaire est la scène 3D d'accueil (pavés en point de Hongrie). Tout le reste est sobre et précis : pas de dégradés décoratifs, pas de cartes toutes identiques sur fond flou, pas d'étiquette MAJUSCULES au-dessus de chaque titre, pas de mise en avant d'un seul mot par titre. Vitrine = aérée, éditoriale, typographique ; espaces de travail = denses (tableaux, filtres). Mobile d'abord pour `/collecte` et `/terrain`.
- Accessibilité : focus visible conservé, `aria-label` sur les boutons-icônes, contraste suffisant, cibles tactiles ≥ 44 px sur `/collecte` et `/terrain`.

---
## 2. Données — composables

`useDb()` renvoie le noyau de base (voir `shared/utils/db-core.ts`) :

```ts
const db = useDb()
db.all('orders')          // lignes VISIBLES pour l'utilisateur courant (réactif dans computed())
db.get('orders', id)      // une ligne visible
db.peek('products', id)   // une ligne sans filtrage (jointures d'affichage : nom produit, client…)
db.raw('orders')          // toutes les lignes (réservé aux services)
db.create('claims', {...}, { summary? })      // lève PermissionError si le rôle n'a pas le droit
db.update('products', id, { published: true })
db.remove('faqs', id)
db.nextRef('quotes', 'DV') // « DV-2026-0013 »
db.notify({ userId?, roles?, title, body?, level, href? })
db.history('Statut modifié', 'note')   // entrée d'historique {id, at, userId, userName, action, note}
db.ready (Ref<boolean>), db.mode (Ref<'local'|'neon'>), db.reset() // réamorce la démo
```
Les pages **lisent** avec `db.all/get/peek` et **écrivent** de préférence via les **services** (§3) ; l'écriture directe (`db.create/update/remove`) est réservée aux CRUD simples (catalogue, FAQ, paramètres…). Ne jamais passer `via:` depuis une page.

`useAuth()` : `{ user (ComputedRef<User|null>), role (ComputedRef<RoleKey>), isLoggedIn, loading, can(perm), loginDemo(userId), switchDemoRole(role), loginWithPassword(email, password), signUp({ name, email, password, role }), logout(), demoAccounts (ComputedRef<User[]>), demoMode (boolean) }`.

`useToast()` : `toast.success(msg, { title? })`, `.error`, `.info`, `.warning`.
`useConfirm()` : `const ok = await confirm({ title, message, confirmLabel?, tone?: 'danger'|'primary' })`.
`useAction()` : `const act = useAction(); await act(() => svc.orders.pay(id, {...}), 'Paiement simulé enregistré')` → exécute, affiche un toast de succès, ou un toast d'erreur (message de `ServiceError`/`PermissionError`), renvoie `true/false`.
`useBrand()` : `{ name, tagline, monogram, logoUrl }` (depuis `settings`), `useSettings()` : `ComputedRef<AppSettings>`.
`useCart()` : `{ items: Ref<{ productId, qty, finish?, color? }[]>, add(productId, qty?, opts?), setQty, remove, clear, count, has(productId) }` (localStorage `ecobloc:cart`).
`useTheme()` : `{ mode, resolved, setMode, overrides, setOverride(theme, key, value), resetOverrides, radius, density, setRadius, setDensity }`.
`usePageTitle(title)` : définit le titre d'onglet « title · Marque ».
`useServices()` : services liés à la base (§3), signatures sans le paramètre `db`.

---
## 3. Services métier — `shared/services/*` (contrat de signatures)

Fonctions pures `(db: Db, input) => résultat`, exposées dans `shared/services/index.ts` sous `{ quotes, orders, deliveries, collections, receipts, inventory, production, quality, env, catalog }` ; `useServices()` les lie à `useDb()`. Chaque écriture passe `{ via: '<service>' }` (clés de `SERVICE_ROLES`, ajouter si besoin). Erreurs métier : `throw new ServiceError('message en français')` (exporter `ServiceError` depuis `shared/services/errors.ts`). Chaque service : historique (`db.history`), journal d'audit via le noyau, notifications aux rôles concernés (`db.notify`), cohérence des quantités (jamais de stock négatif).

Helpers purs `shared/services/pricing.ts` : `isOrderable(product)` (publié ET `validation === 'authorized'`), `canRequestQuote(product)` (publié ET validation ≠ `development`), `unitPriceFor(product, grid?, qty)` (null = sur devis), `computeTotals({ lines, discountPct, deliveryFee, depositPct, vatRatePct? })` → `{ subtotal, discountTotal, deliveryFee, total, depositAmount }`, `deliveryFeeFor(settings, zoneId)`, `productStock(db, productId)` → `{ released, reserved, availableToSell, pendingQc, total }` (uniquement lots de produits finis libérés pour `availableToSell`), `rawStockByPolymer(db)`.

- `quotes.request({ contact, deliveryAddress, lines:[{productId, qty}], customerNotes?, companyId? })` → Quote `requested` (refuse les produits `development`) · `quotes.take(id)` (→ `in_review`, `assignedTo`) · `quotes.send(id, { lines:[{id?, productId, qty, unitPrice, discountPct?}], discountPct, deliveryFee, depositPct, validUntil, internalNotes? })` → `sent` · `quotes.negotiate(id, body)` · `quotes.accept(id)` → crée la Order (`pending_payment`, `unpaid`), facture fictive `issued`, devis `converted`, renvoie l'Order · `quotes.decline(id, reason)`.
- `orders.createDirect({ lines:[{productId, qty}], deliveryAddress, companyId?, purchaseOrderRef? })` (produits `isOrderable` avec prix uniquement) · `orders.pay(orderId, { amount, method, kind })` → Payment simulé (`ref` préfixe `SIM-`), met à jour `paymentStatus/amountPaid`, `confirmed` quand l'acompte est réglé, facture `paid` si soldé · `orders.refund(orderId, amount, reason)` · `orders.cancel(orderId, reason)` · `orders.sendToPreparation(orderId)` → `in_preparation`, crée la Delivery `to_prepare`, tente `orders.allocate` · `orders.allocate(orderId)` (réserve FIFO des lots **libérés** pour les lignes dont le produit `requiresReleasedLot` ; sinon `awaitingStock = true` + notification production).
- `deliveries.plan(id, { carrierId, plannedDate, fee? })` (`planned`, commande `ready_to_ship`) · `deliveries.ship(id)` (`in_transit`, commande `shipped`, lots `reservedQty→shippedQty`, mouvements de stock) · `deliveries.deliver(id, { receivedBy, note?, photo? })` (`delivered`, commande `delivered`, **preuve obligatoire**) · `deliveries.incident(id, { type, description })` · `deliveries.resolveIncident(id, incidentId)`.
- `collections.request({ supplierId?, polymers:[{code, estimatedKg}], pickupPoint, photos?, preferredSlots, notes? })` (refuse les polymères non acceptés dans `settings.polymers`) · `collections.review(id, { accept, reason?, proposedSlots? })` · `collections.plan(id, { scheduledAt, driverUserId, tourId? })` (crée ou complète une Tour) · `collections.driverUpdate(id, { status:'en_route'|'collected'|'weighed'|'problem'|'cancelled', recordedKg?, proof?, problemReason? })` · `collections.cancel(id, reason)`.
- `receipts.confirm({ collectionId?, supplierId, lines:[{polymer, weighedKg, acceptedKg, rejectedKg, quarantineKg, contaminationPct?, decision, reason?}], notes? })` → Receipt + RawLots (`available`/`quarantine`) + mouvements `in`, collecte `received`, rémunération **simulée** `pending` si `settings.features.collectorPayouts` et fournisseur `per_kg` · `receipts.pay(receiptId)` → `paid_simulated`.
- `inventory.adjustRaw(rawLotId, newKg, reason)` · `inventory.adjustFinished(lotId, newQty, reason)` · `inventory.transfer({ itemKind, itemId, toLocationId, qty? })` · `inventory.recordLoss(rawLotId, kg, reason)`.
- `production.createOrder({ productId, plannedQty, plannedStart, plannedEnd, operatorIds, internalRecipeNote? })` · `production.reserve(workOrderId, allocations? | 'auto')` (matières `available` uniquement ; refuse si insuffisant) · `production.start(id)` · `production.pause(id)` · `production.resume(id)` · `production.logEvent(id, { type, severity, description, durationMin? })` · `production.record(id, { producedQty, scrapQty, materialKgConsumed })` · `production.complete(id)` → crée le ProductionLot (`pending_qc`, `rawInputs` = matières consommées), consomme les réservations, mouvements · `production.cancel(id, reason)` (libère les réservations).
- `quality.request(lotId, assignedTo?)` → QcInspection `pending` avec résultats à saisir issus des `qcTemplates` applicables, lot `in_qc` · `quality.record(inspectionId, results)` (`in_progress`) · `quality.decide(inspectionId, { decision, reason })` : `accepted` **refusé** si un test `required` n'est pas saisi ou hors critère → `ServiceError` ; lot `released`/`rejected`/`quarantine` · `quality.attachReport(inspectionId, documentId)`.
- `env.aggregate(period)` (recalcule un EnvRecord/période/polymère depuis receipts, rawLots, workOrders, lots) · `env.validateRecord(id)` · `env.createIndicator(partial)` · `env.publish(indicatorId)` (**refuse** sans méthodologie, sans pièce justificative, ou non validé) · `env.unpublish(indicatorId)`.
- `catalog.setValidation(productId, status, note?)` (journalise ; `authorized` exige ≥ 1 document `published` de type `test_report` ou `datasheet`).

Ne **jamais** calculer d'économie de CO₂ : les indicateurs d'impact publiés sont des quantités mesurées (kg reçus, acceptés, utilisés, rebuts, produits finis) avec méthodologie.

---
## 4. Kit d'interface — `app/components/ui/*` (contrat d'API)

Primitives (toutes stylées avec les tokens) : `UiButton` (`variant`: primary|secondary|outline|ghost|danger|accent, `size`: sm|md|lg, `icon`, `iconRight`, `loading`, `to`, `block`, `type`), `UiInput` (v-model, `type`, `icon`, `prefix/suffix`, `error`), `UiTextarea`, `UiSelect` (v-model, `options: {value,label,disabled?}[]`, `placeholder`, `searchable?`), `UiCheckbox`, `UiSwitch`, `UiRadioGroup`, `UiField` (`label`, `hint`, `error`, `required`, slot), `UiSearch`, `UiBadge` (`tone`, `icon`, `size`), `UiStatusBadge` (`kind: StatusKind`, `value`, `size`) — **toujours utiliser ce composant pour afficher un statut**, `UiAvatar` (`name`, `hue?`), `UiProgress` (`value`, `max`, `tone`), `UiTooltip`, `UiDropdown` (`items:[{label, icon?, onSelect, danger?, divider?}]` + slot trigger), `UiAlert` (`tone`, `title`, `icon`, slot), `UiSkeleton`, `UiEmpty` (`icon`, `title`, `hint`, slot actions), `UiSpinner`.

Surcouches : `UiDialog` (`v-model:open`, `title`, `description`, `size`: sm|md|lg|xl, slots default + `footer`), `UiSheet` (tiroir latéral), `UiTabs` (`v-model`, `items:[{value,label,icon?,count?}]`, slot par valeur), `UiToaster`, `UiConfirmHost` (déjà montés dans `app.vue`).

Données : `UiPageHeader` (`title`, `description`, `back?` (route), `icon?`, slot `actions`, slot `meta`), `UiStat` (`label`, `value`, `icon`, `tone`, `hint`, `delta?`, `to?`), `UiCard` (`title?`, `description?`, `padding?`, slots header/actions/default/footer), `UiKeyValue` (`items:[{label,value,mono?}]`), `UiTimeline` (`items:[{at,title,body?,icon?,tone?,by?}]`), `UiStepper` (`steps`, `current`), `UiDemoBadge` (puce « Démo » à poser à côté d'un chiffre/document fictif), `UiDataTable`, `UiFormDialog`, `UiCloudUpload`, `UiPagination`.

**`UiDataTable`** : props `rows`, `columns: { key, label, sortable?, align?: 'left'|'right'|'center', width?, hide?: 'sm'|'md'|'lg', value?: (row)=>string|number, sortValue?: (row)=>string|number }[]`, `rowKey='id'`, `searchable=true`, `searchText?: (row)=>string` (par défaut : toutes les valeurs primitives de la ligne, sans accents), `filters?: { key, label, options:{value,label}[], accessor:(row)=>string|string[] }[]`, `pageSize=10`, `initialSort?: {key, dir:'asc'|'desc'}`, `loading`, `dense`, `exportName?` (bouton « Exporter en CSV »), `emptyTitle`, `emptyHint`. Émet `row-click(row)`. Slots : `cell-<key>="{ row, value }"`, `actions="{ row }"` (colonne finale), `toolbar` (boutons à droite de la recherche), `empty`, `card="{ row }"` (rendu carte sous 640 px). Tri, recherche, filtres, pagination réellement fonctionnels.

**`UiFormDialog`** : `v-model:open`, `title`, `description?`, `fields: FieldDef[]`, `initial?: object`, `submitLabel='Enregistrer'`, `size`, événement `submit(values)` (async autorisé : bouton en chargement tant que la promesse n'est pas résolue ; si elle lève, l'erreur s'affiche dans le dialogue). `FieldDef = { key, label, type: 'text'|'email'|'tel'|'textarea'|'number'|'currency'|'select'|'multiselect'|'checkbox'|'switch'|'date'|'datetime'|'color'|'tags'|'media', options?, required?, min?, max?, step?, placeholder?, hint?, span?: 1|2, rows?, validate?: (value, all)=>string|undefined, showIf?: (all)=>boolean }`. Validation à la soumission + au blur.

**`UiCloudUpload`** : `v-model` (`MediaRef | MediaRef[]`), `folder` (sous-dossier Cloudinary : `produits|atelier|collectes|qualite|livraisons|documents|branding|etudes-de-cas`), `multiple?`, `accept?`, `label`. Demande une signature à `POST /api/cloudinary/sign`, envoie directement à Cloudinary ; si la signature/le réseau échoue, bascule sur un aperçu local (`URL.createObjectURL`/data-URL) avec la mention « aperçu local — non envoyé ».

Visuels : `ProductVisual` (`app/components/product/Visual.vue`) rend un visuel **procédural SVG** (pavé/dalle/bordure en plastique recyclé moucheté, couleur `tone`, motif `pattern`, ombre isométrique) ; `UiImage` (`media: MediaRef | undefined` — pas `ref`, nom réservé par Vue —, `alt`, `ratio`, `width`, fallback `ProductVisual` si `product` fourni) construit l'URL Cloudinary `https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto,w_<n>/<publicId>` depuis `useRuntimeConfig().public.cloudinaryCloudName`.

Graphiques SVG maison (légers, accessibles, thémés) dans `app/components/chart/*` : `ChartBar` (`data:[{label,value,tone?}]` ou `series`, `stacked?`, `horizontal?`, `unit?`, `height`), `ChartLine` (`series:[{name, points:[{x:string|number,y:number}], tone?}]`), `ChartDonut` (`data:[{label,value,tone?}]`, `center?` texte), `ChartSparkline` (`values:number[]`, `tone`), `ChartLegend`. Couleurs via variables CSS (`var(--primary)`, `var(--accent)`, `var(--info)`…), jamais de hex.

---
## 5. Routes, layouts, pages

Les routes sont définies dans `app/utils/nav.ts` (`PUBLIC_*`, `CLIENT_NAV`, `COLLECTOR_NAV`, `DRIVER_NAV`, `OPS_NAV`, `ADMIN_NAV`) : **chaque entrée doit avoir sa page**, plus les routes de détail (`[id].vue`) et de création indiquées ci-dessous. Le layout est choisi automatiquement par préfixe de route (middleware `zone.global.ts`) : `public` (vitrine), `client` (/espace), `field` (/collecte, /terrain — coque mobile avec barre d'onglets basse), `console` (/ops, /admin — barre latérale dense). Les pages n'ont donc **pas** à déclarer `layout`. Le contenu d'une page ne doit pas redéclarer d'en-tête global/menu : commencer par `UiPageHeader` (sauf vitrine). L'accès par rôle est appliqué par middleware (`canAccessRoute`) ; masquer en plus les boutons d'action selon `useAuth().can(...)`.

Chaque page d'espace de travail doit : afficher un titre (`usePageTitle`), gérer l'état vide (`UiEmpty`), n'avoir **aucun bouton sans action**, confirmer les actions destructrices/irréversibles (`useConfirm`), notifier (`useAction`/`useToast`), et se rafraîchir seule quand les données changent (tout vient de `computed()` sur `db.all/get`). Les tableaux utilisent `UiDataTable` ; chaque ligne mène à un écran de détail quand il existe. Mettre une `UiDemoBadge`/mention `NOTICES.demoData` sur les indicateurs et documents fictifs.

Routes de détail/création : `/catalogue/[ref]`, `/espace/devis/[id]`, `/espace/commandes/[id]`, `/collecte/demandes/[id]`, `/collecte/demandes/nouvelle`, `/terrain/collectes/[id]`, `/ops/appro/{demandes,fournisseurs,receptions,lots-matiere}/[id]` + `/ops/appro/receptions/nouvelle`, `/ops/production/{ordres,lots}/[id]` + `/ops/production/ordres/nouveau`, `/ops/qualite/controles/[id]`, `/ops/commercial/{clients,devis,commandes}/[id]`, `/ops/logistique/expeditions/[id]`, `/admin/{utilisateurs,clients,produits,commandes,lots}/[id]` + `/admin/produits/nouveau`.

Comptes de démonstration (mot de passe commun `demo1234`, e-mails `<rôle>@ecobloc.demo` : `client`, `pro`, `distributeur`, `collecteur`, `chauffeur`, `appro`, `production`, `qualite`, `commercial`, `logistique`, `admin`, `environnement`) — définis dans `shared/seed`.

---
## 6. Vérification (règles pour les agents)

- **Ne jamais lancer `nuxt dev`, `nuxt build`, `nuxt typecheck` ni `nuxt prepare`** (le dépôt est partagé entre agents en parallèle ; l'intégration, le build et le contrôle de types sont faits à la fin par l'intégrateur).
- Logique (`shared/`, `server/`) : `npx vitest run tests/<votre-fichier>.test.ts`. Les tests ne doivent pas dépendre de Nuxt (imports relatifs, voir §1).
- Composants / pages : `node scripts/check-sfc.mjs <fichiers ou dossiers>` compile script + template de chaque `.vue` et signale les composants introuvables (auto-import `app/components/**`). Le lancer avant de rendre la main ; il ne vérifie pas les types, donc relire aussi les noms de props et d'API par rapport à ce document et aux fichiers existants.
- Si un composant du kit UI (§4) ou un composable (§2) que vous utilisez n'existe pas encore, **ne le recréez pas** : suivez le contrat de ce document (un autre agent l'écrit en parallèle) et mentionnez-le dans votre rapport.
- N'éditer que les fichiers de votre périmètre. Si un contrat manque ou est ambigu, choisir l'option la plus simple et la noter en tête de votre rapport final.
- Rapport final : liste des fichiers créés, API exposée si elle diffère du contrat, points non terminés. Court.

## 7. Précisions de données

- `ProductionLot.availableQty` d'un lot **non libéré** = quantité physiquement en stock mais **non vendable** (en attente de contrôle, quarantaine, rejet). Seuls les lots `qcStatus === 'released'` comptent pour `productStock().availableToSell` et peuvent être alloués/réservés/expédiés.
- Un lot de matière première n'est créé que pour les kg acceptés ou mis en quarantaine à la réception ; les kg rejetés ne créent pas de lot.
- Comptes de démonstration : `usr_client1` (particulier, sert aussi de compte « client »), `usr_pro1` (Désiré Akpo, BâtiPlus), `usr_distri`, `usr_coll1`, `usr_driver1`, `usr_appro`, `usr_prod`, `usr_qual`, `usr_sales`, `usr_logi`, `usr_admin`, `usr_env`. Le seed (`buildSeed()`) est validé par `tests/seed.test.ts` : ne pas casser ses invariants.

## 8. API HTTP (Nitro) — contrat client ↔ serveur

Toutes les routes sont sous `/api`, JSON, erreurs `{ statusCode, statusMessage, data? }` (messages en français).

**Authentification** (en-têtes de requête, évalués par `server/utils/session.ts`) :
- `Authorization: Bearer <jwt Neon Auth>` — vérifié avec `jose` (`createRemoteJWKSet(NEON_AUTH_JWKS_URL)`, émetteur/audience = origine de `NEON_AUTH_BASE_URL`, alg EdDSA). Le `sub`/e-mail est rapproché d'une ligne `users` (`neonUserId` ou e-mail).
- `x-demo-user: <userId>` — **uniquement si `NUXT_PUBLIC_DEMO_MODE=true`** ; identifie un compte de démonstration (`demo: true`). Sans en-tête valide : rôle `visitor`.
- `x-service: <clé de SERVICE_ROLES>` — présent sur les écritures émises par un service métier ; le serveur vérifie `serviceAllowed(clé, rôle)` au lieu des droits de collection (prototype : les services s'exécutent côté client ; en production ils migreraient côté serveur — à documenter).

| Route | Rôle |
|---|---|
| `GET /api/health` | `{ ok, db: 'neon'\|'none', seeded: boolean, demoMode, time }` — jamais de secret |
| `GET /api/db/bootstrap` | `{ seedVersion, state: Partial<DbState> }` : état **filtré par rôle** (`ACCESS.read` + `filterRows`) ; si la base est vide : l'amorce (`buildSeed()`) puis renvoie |
| `PUT /api/db/:collection/:id` | crée/remplace une ligne (corps = ligne complète) ; vérifie droits (collection, champs, propriété de la ligne ou `x-service`) ; zod : objet, `id` identique au paramètre |
| `DELETE /api/db/:collection/:id` | supprime une ligne (mêmes contrôles) |
| `POST /api/db/reset` | **admin + mode démo** : réamorce la base ; journalise |
| `GET /api/auth/me` | `{ user, role, mode: 'demo'\|'neon'\|'visitor' }` |
| `POST /api/auth/sync` | après inscription/connexion Neon Auth : crée/retrouve la ligne `users` (rôle ∈ `SELF_SIGNUP_ROLES`, `pendingApproval: true` pour `collector`/`distributor`) |
| `POST /api/cloudinary/sign` | corps `{ folder }` (sous-dossier autorisé) → `{ cloudName, apiKey, timestamp, folder, signature }` (jamais le secret) ; authentifié |
| `POST /api/cloudinary/folders` | **admin** : crée l'arborescence `ecobloc/…` sur Cloudinary, renvoie le détail créé/déjà présent/erreur |

Stockage Neon : tables `records(collection text, id text, data jsonb, updated_at timestamptz, PK(collection,id))` et `meta(key text PK, value jsonb)` (clé `seedVersion`). Le serveur n'utilise **jamais** de secrets côté client ; `.env` n'est jamais journalisé ni versionné.
