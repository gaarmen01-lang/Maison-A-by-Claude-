# Maison A — Salon de coiffure

Site vitrine et de réservation pour un salon de coiffure féminin premium, en **français** et en **néerlandais**.

## Fonctionnalités

**Site public** (`/`)
- Présentation du salon, carte des prestations avec tarifs et durées, horaires et adresse.
- Bascule FR / NL (mémorisée dans le navigateur, détection automatique de la langue).
- Prise de rendez-vous en ligne : prestation, **choix de la coiffeuse** (Employée 1, Employée 2 ou « Sans préférence »), date, créneau horaire (seuls les créneaux libres de la coiffeuse choisie sont proposés), nom, prénom, e-mail et téléphone.
- « Sans préférence » : la coiffeuse libre la moins chargée ce jour-là est attribuée automatiquement, et son nom est affiché dans la confirmation.

**Espace administrateur** (`/admin`, protégé par mot de passe)
- **Agenda** jour par jour : liste des rendez-vous avec la coiffeuse (mention « Demandée » quand la cliente l'a choisie), filtre par coiffeuse, coordonnées des clientes, annulation / rétablissement / suppression, CA du jour.
- **Nouveau rendez-vous** : le salon fixe lui-même un rendez-vous (téléphone, comptoir) et choisit la coiffeuse ou laisse l'attribution automatique, e-mail facultatif, prix ajustable.

**Règle de planning** : une coiffeuse ne peut jamais avoir deux rendez-vous qui se chevauchent (en tenant compte de la durée de chaque prestation), que le rendez-vous soit pris en ligne ou saisi par le salon. Deux rendez-vous à la même heure ne sont donc possibles que s'ils sont assurés par les deux coiffeuses.
- **Chiffre d'affaires** : CA réalisé par jour grâce aux rendez-vous confirmés, sur la période choisie (7 derniers jours, mois en cours, 30 prochains jours ou dates libres), avec graphique, total, nombre de rendez-vous, panier moyen, meilleur jour et **CA par coiffeuse** (total et par jour). Les rendez-vous annulés ne sont pas comptés.

## Pensé pour le téléphone

- **Clientes** : barre « Appeler / Réserver » fixée en bas de l'écran, choix du jour dans un bandeau à faire défiler au doigt, gros créneaux faciles à toucher, claviers adaptés (e-mail, téléphone) et passage automatique à l'étape suivante.
- **Salon** : barre d'onglets en bas comme une application, rendez-vous affichés en cartes avec bouton d'appel direct, CA lisible sans défilement horizontal.
- **Installer l'espace salon comme une application** : ouvrir `/admin` sur le téléphone, puis *Partager → Sur l'écran d'accueil* (iPhone) ou *⋮ → Ajouter à l'écran d'accueil* (Android).

## Démarrer

Node.js 18 ou plus récent.

```bash
npm install
ADMIN_PASSWORD="votre-mot-de-passe" npm start
```

- Site : http://localhost:3000
- Administration : http://localhost:3000/admin

Sans `ADMIN_PASSWORD`, le mot de passe est `admin` (développement uniquement ; avec `NODE_ENV=production`, le serveur refuse de démarrer sans mot de passe).

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | Mot de passe de l'espace salon | `admin` |
| `PORT` | Port HTTP | `3000` |
| `DATA_FILE` | Fichier de données des rendez-vous (sans `DATABASE_URL`) | `data/db.json` |
| `DATABASE_URL` | Base PostgreSQL (Supabase) ; remplace le fichier JSON | — |
| `SESSION_SECRET` | Clé de signature des sessions admin | dérivée du mot de passe |

Le fuseau horaire du salon (`Europe/Brussels`) se règle dans `lib/config.js`.

## Personnaliser

Tout se règle dans [`lib/config.js`](lib/config.js) : **coiffeuses** (`staff` : remplacez « Employée 1 / 2 » par les vrais prénoms, ajoutez-en une en copiant un bloc), prestations (noms FR/NL, descriptions, durée, prix), horaires d'ouverture, intervalle entre créneaux, délai minimum et horizon de réservation.

Les textes du site sont dans [`public/js/i18n.js`](public/js/i18n.js) ; l'adresse et le téléphone dans [`public/index.html`](public/index.html) (section « Horaires ») et dans les clés `hours.address` de `i18n.js`.

## Tests

```bash
npm test                                   # stockage fichier JSON
TEST_DATABASE_URL=postgres://… npm test    # mêmes tests sur PostgreSQL
```

## Mise en ligne (Vercel + Supabase)

- **Vercel** sert les pages de `public/` ; les requêtes `/api/*` passent par la fonction `api/index.js` (région Paris, voir `vercel.json`).
- **Supabase** stocke les rendez-vous (table créée par `supabase/migrations/001_appointments.sql`). La contrainte `no_double_booking` empêche en base toute double réservation d'une coiffeuse, même si deux clientes valident au même instant.
- Le site se connecte avec un rôle dédié `maison_app` (droits limités à la table des rendez-vous) via le pooler de connexions Supabase.
- Variables d'environnement du projet Vercel : `DATABASE_URL`, `ADMIN_PASSWORD`, `SESSION_SECRET`. Pour changer le mot de passe du salon : *Vercel → projet → Settings → Environment Variables → ADMIN_PASSWORD*, puis redéployer.
