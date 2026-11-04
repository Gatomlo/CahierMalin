# Le Cahier Malin

Entraînement aux mots de dictée (8 jeux : cache-cache, quiz, memory, mots mêlés, lettres mêlées, coffre-fort, pendu, dictée audio), niveaux CP→champion par liste. Interface, commentaires et réponses **en français** ; commentaires de code sans accents.

## Stack
Node ≥ 22.5 (`node:sqlite`), Express 4, front en **un seul fichier** `public/index.html` (JS vanilla, sans build). Origine : artéfact Claude « Le Cahier Malin » (RZ2wxpXmNJTktuJfX1ZbL1), devenu appli serveur.

## Fichiers clés
- `server.js` : exporte `app` (écoute seulement si lancé directement, `PORT`) ; API `/api` : `GET|PUT /state`, `GET /config`, `POST /declinaisons`. Profil = en-tête `X-Profil` (prénom, pas de compte).
- `lib/db.js` : `data/cahier.db` (`CAHIER_DATA_DIR`) ; tables `lists`, `kv` (progress, stars, settings, gradeFloors en JSON par profil), `declinaisons` (cache IA). Migrations par `PRAGMA user_version`.
- `lib/forms.js` : déclinaisons. Avec clé Gemini (`GEMINI_API_KEY` ou fichier `data/gemini.key`, modèle `GEMINI_MODEL`, défaut `gemini-2.5-flash`) : pluriel, féminin, conjugaison (5 temps), phrases d'exemple ; réponses nettoyées et mises en cache. Sans clé : règles locales pour les groupes avec article seulement.
- `public/index.html` : état en mémoire, copie dans `localStorage` (hors ligne), synchro serveur au démarrage puis `PUT /state` (400 ms de délai) ; les URL d'API sont relatives (la racine redirige vers `/…/`).

## Commandes
- `npm test` (API + faux Gemini, données temporaires) · `npm start` (port 3000) · `CAHIER_DATA_DIR=<dossier> PORT=3111 node server.js` pour un essai.
- Passerelle : jonction `node-gateway/apps/cahier-malin` → ce dossier, servi sur `/cahier-malin/`.
- Déploiement (Infomaniak) : envoyer `server.js`, `lib/`, `public/`, `package.json`, `package-lock.json`, **jamais `data/`**, puis `npm install --omit=dev` et redémarrage. Clé Gemini : variable d'environnement ou `data/gemini.key` sur le serveur.

## Méthode
Tester par API/`npm test` avant toute capture. Le panneau « Décliner » est dans l'éditeur de liste (limite 12 mots par demande, 20 appels/min côté serveur).
