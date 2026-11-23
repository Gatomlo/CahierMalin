# Le Cahier Malin

Entraînement aux mots de dictée (10 jeux : cache-cache, quiz, memory, mots mêlés, lettres mêlées, coffre-fort, pendu, phrase à trous, dictée-aventure, dictée audio), niveaux CP→champion par liste. Interface, commentaires et réponses **en français** ; commentaires de code sans accents.

## Stack
Node ≥ 22.5 (`node:sqlite`), Express 4, front sans build : `public/index.html` (structure), `public/style.css`, `public/js/{core,games,editor,app}.js` (scripts classiques chargés dans cet ordre, portée globale partagée, `'use strict'` en tête ; `tests/page.test.js` vérifie syntaxe et doublons de noms globaux). Origine : artéfact Claude « Le Cahier Malin » (RZ2wxpXmNJTktuJfX1ZbL1), devenu appli serveur.

## Fichiers clés
- `server.js` : exporte `app` (écoute seulement si lancé directement, `PORT`) ; API `/api` : `GET|PUT /state`, `GET /config`, `POST /declinaisons`. Comptes parents + profils enfants : cookie de session `cm_session` (HttpOnly, 90 jours), en-tête `X-Profil` = numéro du profil (doit appartenir au compte).
- `lib/db.js` : `data/cahier.db` (`CAHIER_DATA_DIR`) ; tables `lists`, `kv` (progress, stars, settings, gradeFloors en JSON par profil), `declinaisons` (cache IA). Migrations par `PRAGMA user_version`.
- `lib/forms.js` : déclinaisons. Avec clé Gemini (réglage de l'app, modèle par défaut `gemini-2.5-flash`) : pluriel, féminin, conjugaison (5 temps), phrases d'exemple ; réponses nettoyées et mises en cache. Sans clé : règles locales pour les groupes avec article seulement.
- `public/js/*.js` : état en mémoire, copie dans `localStorage` (hors ligne), synchro serveur au démarrage puis `PUT /state` (400 ms de délai) ; les URL d'API sont relatives (la racine redirige vers `/…/`).

- `lib/conjugaison.js` : conjugaison locale (verbes réguliers en -er, liste de verbes en -ir type finir ; présent, imparfait, futur, conditionnel, passé composé avec avoir) ; le reste passe par Gemini. `POST /api/conjugaison` (syntaxe des listes), `POST /api/phrases` (phrases d'exemple, Gemini seulement).
- Syntaxe de liste : `chanter (présent)` ou `chanter (présent : je, nous)` → une forme par personne, enregistrée comme mot ordinaire avec `g` = la ligne d'origine (l'éditeur la réaffiche repliée ; progression conservée à la réouverture). Jeu « Phrase à trous » : seulement les mots dont la phrase `s` contient le mot.

- `lib/tts.js` : voix du serveur (Gemini TTS, modèle et voix par défaut réglables), son WAV en cache dans `data/tts/` (3000 fichiers max) ; `GET /api/tts?text=&slow=1`. Le front (`speak()`) l'utilise si `/api/config` annonce `tts`, sinon (ou en cas d'échec) voix du navigateur ; les sons d'une manche sont préchargés.
- Dictée-aventure (`POST /api/aventure`, Gemini seulement) : histoire en N chapitres (2-10) avec les mots du jeu + mots d'anciennes listes (réglage enfant, sans effet sur leur progression) ; chaque phrase dictée est comparée mot à mot (LCS), seuls les mots de la liste comptent pour la progression.

- Comptes : `lib/auth.js` (scrypt, sessions, déverrouillage « espace parent » 15 min par retape du mot de passe, freinage des essais), `lib/accounts.js` (requêtes), `lib/routes-account.js` (`/me`, `/setup`, `/login`, `/unlock`, `/parent/*`). Le premier compte créé via l'interface est administrateur et **reprend les profils d'avant les comptes** ; l'admin crée les autres comptes (une famille chacun, données isolées). Clés de données : `p<id>` dans `lists`/`kv`/`attempts`. Écritures API : JSON obligatoire (415 sinon). Le réglage « mots acquis après N jeux » ne se change que dans l'espace parent (`PUT /state` l'ignore).
- Suivi : le front envoie un journal d'essais (`POST /events`, table `attempts`) ; `GET /parent/profiles/:id/suivi` (14 jours, par jeu, mots à revoir, listes). Export/import JSON de listes, copie entre profils, voix au choix (`users.voice`).
- Espace parent (`app.js`, `renderParent`) : onglets Suivi (choix de l’enfant + tuiles de synthèse), Enfants, Listes (aperçu + copie), Réglages (voix, compte), Administration (clé Gemini, comptes ; administrateur seulement). Les données sont chargées une fois, `paint()` change d’onglet sans nouvel appel.
- PWA : `manifest.json`, `sw.js` (réseau d'abord, jamais l'API), icônes PNG générées. Sons de réussite en Web Audio (réglage « Sons » sur l'accueil).

- **Aucune variable d'environnement à gérer** : `lib/settings.js` (table `settings`) garde clé Gemini (chiffrée AES-256-GCM avec `data/secret.key`, créé seul — à conserver avec `data/`), modèles et voix par défaut ; l'administrateur les règle dans l'espace parent (« Réglages du serveur », bouton Tester ; `GET /parent/admin/models` liste les modèles texte et voix de la clé, proposés en listes dans les options avancées). Env et `data/gemini.key` ne servent que de repli (tests, anciennes installations) ; `GEMINI_BASE_URL` = tests.

## Commandes
- `npm run set-password -- <identifiant> <mot de passe>` : réinitialise un compte parent (ferme ses sessions).
- `npm test` (API + faux Gemini, données temporaires) · `npm start` (port 3000) · `CAHIER_DATA_DIR=<dossier> PORT=3111 node server.js` pour un essai.
- Passerelle : jonction `node-gateway/apps/cahier-malin` → ce dossier, servi sur `/cahier-malin/`.
- Installation / mise à jour sur le serveur (SSH, depuis le dossier de la passerelle) : `curl -fsSL https://raw.githubusercontent.com/Gatomlo/CahierMalin/main/scripts/install.sh | bash` (`scripts/install.sh` : clone ou `git pull --ff-only`, reprend un dossier envoyé à la main, refuse si fichiers modifiés, vérifie Node ≥ 22.5, `npm install --omit=dev`, ne touche jamais `data/`), puis redémarrer le site.
- Déploiement manuel (Infomaniak, sans git) : envoyer `server.js`, `lib/`, `public/`, `package.json`, `package-lock.json`, **jamais `data/`**, puis `npm install --omit=dev` et redémarrage. Clé Gemini : saisie par l'administrateur dans l'espace parent.

- Connexion centralisée (node-gateway) : `lib/gateway-bridge.js` (copie de `node-gateway/docs/gateway-bridge.js`) + `loadUser` dans `lib/auth.js`. Si la passerelle fournit `req.gateway` (droit sur cet outil), l'identité est rattachée au compte local **de même identifiant** (aucun compte créé) et ouvre une session locale de 2 h, renouvelée en silence ; l'espace parent reste verrouillé (mot de passe à retaper). Hors passerelle : sans effet. Test : `tests/gateway-bridge.test.js`.

## Déploiement des comptes
Au premier lancement après mise à jour la migration s'applique seule ; ouvrir l'appli, créer le compte parent (il récupère les profils existants). Sans HTTPS, le cookie n'est pas `Secure` (il l'est derrière un proxy qui envoie `X-Forwarded-Proto: https`).

## Méthode
Tester par API/`npm test` avant toute capture. Le panneau « Décliner » est dans l'éditeur de liste (limite 12 mots par demande, 20 appels/min côté serveur).

- Sécurité (branche `claude/security-fixes`) : derrière la passerelle, la création du premier compte exige le droit admin de la passerelle (plus de course au premier visiteur ; hors passerelle : inchangé, test `gateway-setup`) ; dépendances à jour (`npm audit` : 0).

- Sauvegarde : `PUT /state` porte un numéro `rev` (kv `rev`) ; si l'appareil est en retard → 409 + état courant, la page fusionne (`mergeWithServer`) et renvoie. Badge de synchro dans l'en-tête.
- Listes : colonnes `pending` (lignes de conjugaison non résolues, bouton « Relancer ») et `due` (date de dictée, compte à rebours + résumé parent). Déclinaisons et conjugaisons envoyées par lots de 12 (limite serveur).
- Listes : colonne `rule` (JSON `{nom, memo}`, facultative, absente = comportement inchangé). Affichée en carte « À retenir » sur le tableau de bord et après une erreur en phrase à trous ; `POST /api/regle` rédige le rappel (Gemini), `/api/phrases` reçoit `regle` pour des phrases qui la mettent en jeu. Migration 6. Le suivi parents (`suivi().regles`) agrège la réussite par règle via `attempts.list_name`; `ruleReminder()` (games.js) affiche le rappel après une erreur en flash, dictée, mélangé et phrase à trous.
- Réglages de l'enfant dans `settings` (synchronisés) : `streak`, `race` (records), `quizErreur`. Préférences d'appareil en localStorage : concentration, police lisible, taille du texte. Jeux : « Trouve l'erreur » (variante du quiz) et « Course contre la montre » (`race`, 60 s).

