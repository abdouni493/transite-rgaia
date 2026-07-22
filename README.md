# TransitPro — Gestion de transit automobile

Application de gestion pour entreprise de transit / dédouanement de véhicules importés.
Thème **bleu nuit → argent**, dégradés et animations sur toutes les ouvertures/fermetures,
**bilingue Français / العربية** avec bascule RTL complète.

Toutes les données vivent dans **Supabase** (PostgreSQL + Auth + RLS). Aucune donnée
de démonstration n'est embarquée dans l'application.

---

## 1. Base de données

1. Ouvrir le projet Supabase → **SQL Editor** → **New query**.
2. Coller l'intégralité de [`supabase_schema.sql`](./supabase_schema.sql) → **Run**.
   Base déjà en service ? Jouer plutôt
   [`supabase_migration_versement.sql`](./supabase_migration_versement.sql), qui
   passe la capacité à 5 véhicules et numérote l'existant.
3. **Authentication → Providers → Email** : laisser *Confirm email* **désactivé**
   (l'application connecte l'utilisateur immédiatement après la création du compte).

Le script crée :

| Groupe | Tables |
| --- | --- |
| Identité | `profiles` (miroir de `auth.users`) |
| Catalogue | `app_pages` (les 10 interfaces), `app_actions` (tous les boutons de chaque interface) |
| Entreprise | `company` |
| Métier | `principal_clients`, `secondary_clients`, `containers`, `payments`, `cash_transactions` |
| Employés | `roles`, `workers`, `advances`, `absences`, `payroll_runs` |

Plus : le déclencheur `handle_new_user` (auth → `profiles`), les fonctions
`is_admin()`, `email_for_identifier()`, `my_permissions()`, `has_action()`,
la contrainte « 5 véhicules maximum par conteneur », les séquences de
numérotation (`declaration_no_seq`, `versement_ref_seq`) et les politiques RLS.

## 2. Comptes

| Compte | Créé depuis | Stocké dans |
| --- | --- | --- |
| **Administrateur** | Page de connexion → « Créer un compte administrateur » | `auth.users` + `profiles` (role `admin`) |
| **Employé** | Écran **Employés** → nouvel employé, interrupteur « Compte » activé | `auth.users` + `profiles` (role `worker`) + `workers` |

Les deux se connectent avec **nom d'utilisateur ou e-mail** + mot de passe.
Les mots de passe ne sont jamais copiés dans les tables métier — ils restent dans
`auth.users`.

> La création d'un employé passe par un client Supabase isolé (sans persistance de
> session) : l'administrateur reste connecté pendant l'opération.

## 3. Permissions

Un employé créé n'a **aucune permission** : sa barre latérale est vide tant qu'un
administrateur n'a rien accordé depuis le bouton **Permissions** de sa carte.

Le dialogue affiche **toutes les interfaces de l'application** à gauche. En
sélectionner une affiche à droite **tous les boutons d'action** de cette interface,
séparés en deux blocs :

- **Actions standard** — consulter, créer, modifier…
- **Actions sensibles** (en rouge) — versements, suppressions, suppression des
  versements d'un conteneur, gestion des permissions.

Ce que l'employé voit dans sa barre latérale = les interfaces cochées.
Ce qu'il voit comme boutons = les actions cochées. La même règle est rejouée
côté serveur par les politiques RLS (`has_action()`), donc elle tient même en
cas d'appel direct à l'API.

## 4. Développement

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc + vite build
npm run typecheck
npm run lint
```

Variables d'environnement (facultatives en local, voir [`.env.example`](./.env.example)) :

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

## 5. Déploiement Vercel

1. **Import Project** → sélectionner ce dépôt.
2. Framework : **Vite** (détecté via [`vercel.json`](./vercel.json)).
3. **Environment Variables** : ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Le `rewrite` de `vercel.json` renvoie toutes les routes vers `index.html`.

## 6. Sections

| Section | Contenu |
| --- | --- |
| Tableau de bord | KPI, graphiques, alertes |
| Clients principaux | Cartes, recherche, filtres, détails 4 onglets, versements + impression |
| Clients secondaires | Assistant multi-étapes ; à l'étape conteneur, la création d'un conteneur est **à côté de la recherche** |
| Conteneurs | Contenu, historique des versements (imprimable), reste par client principal |
| Suivi de dédouanement | Pipeline 6 statuts |
| Suivi de versement | Versements par conteneur, historique, **impression d'un reçu ou de tout l'historique** |
| Caisse | Dépôts / retraits, versements des conteneurs, impression |
| Employés | Cartes avec **toutes les actions visibles** : Voir, Modifier, Permissions, Acomptes, Absences, Versement, Supprimer |
| Rapports | Analyse par période avec détail cliquable |
| Paramètres | Entreprise, compte, sauvegarde / restauration / synchronisation |

## 7. Impression

Tous les documents passent par `src/components/print/PrintDocument.tsx` :

```
 [logo]
 NOM DE L'ENTREPRISE                     adresse · téléphone · e-mail · NIF · NIS · RC
 ═══════════════════════════════════════════════════════════════════
                          SUIVI DE VERSEMENT
 ───────────────────────────────────────────────────────────────────
 … contenu …
```

Deux formats : **reçu d'un versement** (bouton imprimante sur chaque ligne
d'historique) et **historique complet** (bouton « Imprimer l'historique »).

## 8. Règles métier

- Un conteneur contient **au maximum 5 véhicules** (contrainte en base).
- Un client secondaire = une personne + un véhicule + un conteneur + un prix.
- Chaque client secondaire reçoit un **numéro de déclaration** séquentiel
  (`0001`, `0002`, …) : c'est son identifiant métier, affiché partout et
  recherchable depuis « Clients secondaires » et « Suivi de dédouanement ».
- Chaque versement reçoit une **référence versement** séquentielle (`00001`,
  `00002`, …), imprimée sur le reçu et sur les historiques. La rechercher dans
  « Suivi de versement » affiche le conteneur qui la contient.
- Les versements sont enregistrés par couple **(conteneur, client principal)**.
- Statuts : `Non arrivé → Arrivé → Saisie → Liquidé → Sortie → Remis au client`.
- Un nouvel employé est créé **sans aucune permission**.
- Le calcul de paie liste les **mois (ou jours) non payés**, les **acomptes** et
  **absences non encore déduits**, propose un net **modifiable à la main**, avec
  **date de versement modifiable** et **description facultative**.

Tous les calculs financiers passent par `src/lib/selectors.ts` — un seul point de vérité.

## 9. Stack

React 19 · TypeScript · Vite · Tailwind CSS · Framer Motion · Recharts · lucide-react · Supabase
