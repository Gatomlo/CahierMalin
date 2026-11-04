// Reinitialise le mot de passe d'un compte parent (oubli) :
//   npm run set-password -- <identifiant> <nouveau mot de passe>
// Deconnecte aussi toutes les sessions du compte. A lancer sur le serveur, la ou
// se trouve data/ (ou avec CAHIER_DATA_DIR).
const { db } = require('../lib/db');
const auth = require('../lib/auth');
const acc = require('../lib/accounts');

(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage : npm run set-password -- <identifiant> <nouveau mot de passe>');
    process.exit(1);
  }
  const u = acc.userByName(username);
  if (!u) {
    console.error(`Compte « ${username} » introuvable. Comptes existants : ${acc.listUsers().map((x) => x.username).join(', ') || '(aucun)'}`);
    process.exit(1);
  }
  if (password.length < 8 || password.length > 100) {
    console.error('Mot de passe : 8 caractères au minimum.');
    process.exit(1);
  }
  acc.setPassword(u.id, await auth.hashPassword(password));
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
  console.log(`Mot de passe de « ${u.username} » modifié, sessions fermées.`);
})();
