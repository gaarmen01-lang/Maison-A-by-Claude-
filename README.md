# Maison A — Salon de coiffure

Site vitrine et de réservation pour un salon de coiffure féminin premium, en **français** et en **néerlandais**.

## Fonctionnalités

**Site public** (`/`)
- Présentation du salon, carte des prestations avec tarifs et durées, horaires et adresse.
- Bascule FR / NL (mémorisée dans le navigateur, détection automatique de la langue).
- Prise de rendez-vous en ligne : prestation, date, créneau horaire (seuls les créneaux libres sont proposés), nom, prénom, e-mail et téléphone.

**Espace administrateur** (`/admin`, protégé par mot de passe)
- **Agenda** jour par jour : liste des rendez-vous, coordonnées des clientes, annulation / rétablissement / suppression, CA du jour.
- **Nouveau rendez-vous** : le salon fixe lui-même un rendez-vous (téléphone, comptoir), e-mail facultatif, prix ajustable, possibilité de forcer un créneau déjà complet.
- **Chiffre d'affaires** : CA réalisé par jour grâce aux rendez-vous confirmés, sur la période choisie (7 derniers jours, mois en cours, 30 prochains jours ou dates libres), avec graphique, total, nombre de rendez-vous, panier moyen et meilleur jour. Les rendez-vous annulés ne sont pas comptés.

## Pensé pour le téléphone

- **Clientes** : barre « Appeler / Réserver » fixée en bas de l'écran, choix du jour dans un bandeau à faire défiler au doigt, gros créneaux faciles à toucher, claviers adaptés (e-mail, téléphone) et passage automatique à l'étape suivante.
- **Salon** : barre d'onglets en bas comme une application, rendez-vous affichés en cartes avec bouton d'appel direct, CA lisible sans défilement horizontal.
- **Installer l'espace salon comme une application** : ouvrir `/admin` sur le téléphone, puis *Partager → Sur l'écran d'accueil* (iPhone) ou *⋮ → Ajouter à l'écran d'accueil* (Android).

## Démarrer

Node.js 18 ou plus récent, aucune dépendance à installer.

```bash
ADMIN_PASSWORD="votre-mot-de-passe" npm start
```

- Site : http://localhost:3000
- Administration : http://localhost:3000/admin

Sans `ADMIN_PASSWORD`, le mot de passe est `admin` (développement uniquement ; avec `NODE_ENV=production`, le serveur refuse de démarrer sans mot de passe).

| Variable | Rôle | Défaut |
|---|---|---|
| `ADMIN_PASSWORD` | Mot de passe de l'espace salon | `admin` |
| `PORT` | Port HTTP | `3000` |
| `DATA_FILE` | Fichier de données des rendez-vous | `data/db.json` |
| `TZ` | Fuseau horaire du salon (ex. `Europe/Brussels`) | celui du serveur |

## Personnaliser

Tout se règle dans [`lib/config.js`](lib/config.js) : prestations (noms FR/NL, descriptions, durée, prix), horaires d'ouverture, nombre de fauteuils (rendez-vous simultanés), intervalle entre créneaux, délai minimum et horizon de réservation.

Les textes du site sont dans [`public/js/i18n.js`](public/js/i18n.js) ; l'adresse et le téléphone dans [`public/index.html`](public/index.html) (section « Horaires ») et dans les clés `hours.address` de `i18n.js`.

## Tests

```bash
npm test
```

## Mise en ligne

Le serveur doit tourner en continu et pouvoir écrire dans `data/` (VPS, Render, Railway, Fly.io avec un volume…). Placez-le derrière HTTPS (le cookie de session passe en `Secure` quand l'en-tête `X-Forwarded-Proto: https` est présent) et sauvegardez régulièrement `data/db.json`.
