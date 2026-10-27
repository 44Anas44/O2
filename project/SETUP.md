# Centre 2 Manager — installation

Application indépendante : son propre code, son propre projet Supabase, son propre
logo et sa propre apparence. Rien n'est partagé avec une autre application.

## 1. Personnaliser (5 minutes)

| Quoi | Où |
|---|---|
| Nom du centre, nom de l'appli, initiales, slogan, identifiant d'appli | `src/brand/brands.json` |
| Couleurs, police, menu clair/sombre, arrondis, textes par défaut | `src/brand/second/theme.ts` |
| Logo (appli + PDF) | `src/brand/second/logo.png` (PNG fond transparent) |

- `appId` doit être unique et en minuscules, ex. `com.nomduclient.manager`.
- Remplacez `productName`, `name`, `initials` et `tagline` par ceux du client.
- Le logo OC (cercle blanc, croix et anneau verts) est déjà en place. Pour le changer,
  écrasez `logo.png`.

## 2. Créer le projet Supabase de ce client
1. https://supabase.com → **New project** (nom libre, région proche de Tunis, ex. Frankfurt).
   Notez le mot de passe de la base dans un gestionnaire de mots de passe — **jamais dans
   un fichier du projet**.
2. **SQL Editor → New query** : collez TOUT `supabase/full_setup.sql` → **Run**.
3. **Authentication → Users → Add user → Create new user** : e-mail + mot de passe du
   premier administrateur, cochez **Auto Confirm User**. Le tout premier compte devient
   automatiquement administrateur.
4. **Project Settings → API** : relevez *Project URL* et la clé *anon public*.

## 3. Connecter l'application
Copiez `.env.example` en `.env` et collez l'URL et la clé du projet. Ne partagez jamais `.env`.

## 4. Lancer / construire
```bash
npm install
npm run dev               # test dans le navigateur
npm run electron:dev      # test en fenêtre de bureau
npm run build             # version web (dist/)
npm run electron:build    # installateur Windows -> release/
```

## 5. Après l'installation
1. Connectez-vous avec le compte administrateur.
2. **Paramètres** : adresse, téléphone, e-mail, matricule fiscal, message de bas de reçu
   (imprimés sur les PDF). Modifiable à tout moment, sans recompiler.
3. **Équipe** : invitez les employés (Gestionnaire / Réception) ; ils créent leur compte
   avec l'e-mail invité depuis l'écran de connexion (« Première connexion ? »).
4. **Ventes**, **Agenda**, **Rapports** : reçus PDF, bons de rendez-vous, rapport d'activité.

Rôles : **Administrateur** (tout + équipe + paramètres), **Gestionnaire** (tout sauf équipe
et paramètres), **Réception** (ventes et rendez-vous ; pas de dépenses, profits, prix
d'achat ni rapports).

## 6. Sauvegarde et mise en veille (projet Supabase gratuit)
Un projet Supabase gratuit est mis en pause après 7 jours sans activité et n'a pas de
sauvegardes automatiques. Utilisez les workflows GitHub `supabase-keepalive` et
`monthly-backup` (fournis à part) avec les secrets de CE projet, ou passez au plan Pro.

## Dépannage
- **Page blanche au démarrage** : le fichier `.env` manque ou contient une mauvaise URL/clé.
- **« Accès non autorisé » après connexion** : le compte n'a pas de profil. Créez le premier
  utilisateur depuis le tableau de bord Supabase (étape 2.3), ou invitez l'e-mail depuis **Équipe**.
