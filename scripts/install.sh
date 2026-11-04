#!/usr/bin/env bash
# Installe ou met a jour le Cahier Malin depuis GitHub dans la passerelle Node.
#
#   Premiere installation (depuis le dossier de la passerelle, en SSH) :
#     curl -fsSL https://raw.githubusercontent.com/Gatomlo/CahierMalin/main/scripts/install.sh | bash
#   ou en indiquant le dossier de la passerelle :
#     curl -fsSL https://raw.githubusercontent.com/Gatomlo/CahierMalin/main/scripts/install.sh | bash -s -- /chemin/vers/node-gateway
#
#   Mise a jour : relancer la meme commande (ou "bash apps/cahier-malin/scripts/install.sh").
#
# Le dossier data/ (base, cle de chiffrement, sons) n'est jamais touche.
set -euo pipefail

REPO="${REPO:-https://github.com/Gatomlo/CahierMalin.git}"
BRANCH="${BRANCH:-main}"
GW="${1:-$PWD}"
GW="$(cd "$GW" 2>/dev/null && pwd)" || { echo "Dossier introuvable : ${1:-$PWD}" >&2; exit 1; }
APP="$GW/apps/cahier-malin"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { echo "Erreur : $*" >&2; exit 1; }

# 1. Verifications
[ -f "$GW/server.js" ] && [ -d "$GW/apps" ] || die "« $GW » n'est pas le dossier de la passerelle (server.js et apps/ attendus).
Lance la commande depuis ce dossier ou passe son chemin en argument."
command -v git  >/dev/null || die "git est introuvable sur ce serveur."
command -v node >/dev/null || die "node est introuvable sur ce serveur."
command -v npm  >/dev/null || die "npm est introuvable sur ce serveur."
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=5)?0:1)' \
  || die "Node $(node -v) est trop ancien : il faut Node 22.5 ou plus (module node:sqlite). Change la version dans le manager Infomaniak."

# 2. Code : clone, mise a jour, ou reprise d'un dossier envoye a la main (zip / SFTP)
if [ -d "$APP/.git" ]; then
  say "Mise à jour de $APP"
  cd "$APP"
  [ -z "$(git status --porcelain)" ] || die "des fichiers ont été modifiés à la main dans $APP :
$(git status --short)
Annule-les (git checkout -- .) ou sauvegarde-les, puis relance."
  git fetch --quiet origin "$BRANCH"
  git checkout --quiet "$BRANCH"
  git merge --ff-only --quiet "origin/$BRANCH"
elif [ -d "$APP" ] && [ -n "$(ls -A "$APP")" ]; then
  say "Dossier existant sans git : rattachement au dépôt (data/ conservé)"
  cd "$APP"
  git init --quiet
  git remote add origin "$REPO" 2>/dev/null || git remote set-url origin "$REPO"
  git fetch --quiet origin "$BRANCH"
  git checkout --quiet -f -B "$BRANCH" "origin/$BRANCH"
else
  say "Installation dans $APP"
  git clone --quiet --branch "$BRANCH" "$REPO" "$APP"
  cd "$APP"
fi
echo "Version : $(git log -1 --format='%h %s')"

# 3. Dependances (seulement celles de production)
say "Installation des dépendances"
npm install --omit=dev --no-audit --no-fund --loglevel=error

# 4. Suite
say "Terminé."
cat <<EOF
Reste à faire :
  1. Redémarrer le site Node.js depuis le manager Infomaniak.
  2. Ouvrir https://<ton-domaine>/cahier-malin/
     - première installation : créer le compte parent (il devient administrateur) ;
     - puis, dans « Espace parent » > « Réglages du serveur », coller la clé Gemini.
Mettre à jour plus tard : relancer cette même commande, puis redémarrer le site.
Sauvegarde : le dossier $APP/data (base + secret.key) est à conserver ensemble.
EOF
