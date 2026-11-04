# Le Cahier Malin

Entraînement aux mots de dictée (10 jeux : cache-cache, quiz, memory, mots mêlés, lettres mêlées, coffre-fort, pendu, phrase à trous, dictée-aventure, dictée audio), niveaux CP→champion par liste. Interface, commentaires et réponses **en français** ; commentaires de code sans accents.

## Stack
Node ≥ 22.5 (`node:sqlite`), Express 4, front en **un seul fichier** `public/index.html` (JS vanilla, sans build). Origine : artéfact Claude « Le Cahier Malin » (RZ2wxpXmNJTktuJfX1ZbL1), devenu appli serveur.

## Fichiers clés
- `server.js` : exporte `app` (écoute seulement si lancé directement, `PORT`) ; API `/api` : `GET|PUT /state`, `GET /config`, `POST /declinaisons`. Comptes parents + profils enfants : cookie de session `cm_session` (HttpOnly, 90 jours), en-tête `X-Profil` = numéro du profil (doit appartenir au compte).
- `lib/db.js` : `data/cahier.db` (`CAHIER_DATA_DIR`) ; tables `lists`, `kv` (progress, stars, settings, gradeFloors en JSON par profil), `declinaisons` (cache IA). Migrations par `PRAGMA user_version`.
- `lib/forms.js` : déclinaisons. Avec clé Gemini (`GEMINI_API_KEY` ou fichier `data/gemini.key`, modèle `GEMINI_MODEL`, défaut `gemini-2.5-flash`) : pluriel, féminin, conjugaison (5 temps), phrases d'exemple ; réponses nettoyées et mises en cache. Sans clé : règles locales pour les groupes avec article seulement.
- `public/index.html` : état en mémoire, copie dans `localStorage` (hors ligne), synchro serveur au démarrage puis `PUT /state` (400 ms de délai) ; les URL d'API sont relatives (la racine redirige vers `/…/`).

- `lib/conjugaison.js` : conjugaison locale (verbes réguliers en -er, liste de verbes en -ir type finir ; présent, imparfait, futur, conditionnel, passé composé avec avoir) ; le reste passe par Gemini. `POST /api/conjugaison` (syntaxe des listes), `POST /api/phrases` (phrases d'exemple, Gemini seulement).
- Syntaxe de liste : `chanter (présent)` ou `chanter (présent : je, nous)` → une forme par personne, enregistrée comme mot ordinaire avec `g` = la ligne d'origine (l'éditeur la réaffiche repliée ; progression conservée à la réouverture). Jeu « Phrase à trous » : seulement les mots dont la phrase `s` contient le mot.

- `lib/tts.js` : voix du serveur (Gemini TTS, `GEMINI_TTS_MODEL`, `GEMINI_VOICE`), son WAV en cache dans `data/tts/` (3000 fichiers max) ; `GET /api/tts?text=&slow=1`. Le front (`speak()`) l'utilise si `/api/config` annonce `tts`, sinon (ou en cas d'échec) voix du navigateur ; les sons d'une manche sont préchargés.
- Dictée-aventure (`POST /api/aventure`, Gemini seulement) : histoire en N chapitres (2-10) avec les mots du jeu + mots d'anciennes listes (réglage enfant, sans effet sur leur progression) ; chaque phrase dictée est comparée mot à mot (LCS), seuls les mots de la liste comptent pour la progression.

- Comptes : `lib/auth.js` (scrypt, sessions, déverrouillage « espace parent » 15 min par retape du mot de passe, freinage des essais), `lib/accounts.js` (requêtes), `lib/routes-account.js` (`/me`, `/setup`, `/login`, `/unlock`, `/parent/*`). Le premier compte créé via l'interface est administrateur et **reprend les profils d'avant les comptes** ; l'admin crée les autres comptes (une famille chacun, données isolées). Clés de données : `p<id>` dans `lists`/`kv`/`attempts`. Écritures API : JSON obligatoire (415 sinon). Le réglage « mots acquis après N jeux » ne se change que dans l'espace parent (`PUT /state` l'ignore).
- Suivi : le front envoie un journal d'essais (`POST /events`, table `attempts`) ; `GET /parent/profiles/:id/suivi` (14 jours, par jeu, mots à revoir, listes). Export/import JSON de listes, copie entre profils, voix au choix (`users.voice`).
- PWA : `manifest.json`, `sw.js` (réseau d'abord, jamais l'API), icônes PNG générées. Sons de réussite en Web Audio (réglage « Sons » sur l'accueil).

## Commandes
- `npm run set-password -- <identifiant> <mot de passe>` : réinitialise un compte parent (ferme ses sessions).
- `npm test` (API + faux Gemini, données temporaires) · `npm start` (port 3000) · `CAHIER_DATA_DIR=<dossier> PORT=3111 node server.js` pour un essai.
- Passerelle : jonction `node-gateway/apps/cahier-malin` → ce dossier, servi sur `/cahier-malin/`.
- Déploiement (Infomaniak) : envoyer `server.js`, `lib/`, `public/`, `package.json`, `package-lock.json`, **jamais `data/`**, puis `npm install --omit=dev` et redémarrage. Clé Gemini : variable d'environnement ou `data/gemini.key` sur le serveur.

## Déploiement des comptes
Au premier lancement après mise à jour la migration s'applique seule ; ouvrir l'appli, créer le compte parent (il récupère les profils existants). Sans HTTPS, le cookie n'est pas `Secure` (il l'est derrière un proxy qui envoie `X-Forwarded-Proto: https`).

## Méthode
Tester par API/`npm test` avant toute capture. Le panneau « Décliner » est dans l'éditeur de liste (limite 12 mots par demande, 20 appels/min côté serveur).
