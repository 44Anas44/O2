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

## 2. Préparer le projet Supabase de ce client

**Vous avez déjà un projet Supabase à réutiliser ?** (jamais celui d'un autre client !)
0. Si le projet contient quelque chose à garder, exportez-le d'abord (Table Editor → ⋯ → Export CSV).
0. SQL Editor → collez `supabase/reset_database.sql` → Run. Cela efface les tables de l'application
   et tous les comptes. Puis continuez à l'étape 2 ci-dessous.

**Nouveau projet :**
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
4. **Déclarer une vente** : un panier avec « Ajouter un produit » / « Ajouter un service » (recherche
   intégrée, quantités, modification, retrait, annulation) ; un seul reçu PDF pour toute la vente.
5. **Vente par lot** (onglet dans « Déclarer une vente ») : acheteur enregistré (nom et/ou société),
   remises par ligne ou sur tous les produits (Administrateur / Gestionnaire). Menu **Acheteurs**.
   **TVA** : fiche produit → « TVA 19 % » (prix saisi HT, client paie HT × 1,19).
6. **Ventes**, **Agenda**, **Rapports** : reçus PDF, bons de rendez-vous, rapport d'activité.
7. **Paramètres → Logo** : importez le logo du client ; il apparaît dans le menu et sur tous les PDF.

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


---

## Application de bureau et mobile
Voir `PACKAGING.md` (installateur Windows, APK Android, compilation automatique sur GitHub).


---

## Livraison au client : vider les données et garder la sauvegarde
1. Supabase → SQL Editor : ouvrez `supabase/handover_keep_backup.sql`, remplacez `BACKUP_EMAIL` par l'e-mail du
   compte de sauvegarde (Gestionnaire), puis exécutez. Toutes les données et tous les autres comptes sont supprimés ;
   la numérotation des reçus repart à REC-000001.
2. Le client ouvre l'application → « Première connexion ? Créer mon compte » : il devient administrateur et le compte
   de sauvegarde est rattaché à son centre automatiquement (la sauvegarde mensuelle continue).
3. Il renseigne **Paramètres**, puis invite son équipe depuis **Équipe**.
