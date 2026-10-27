# Application de bureau (Windows) et application mobile (Android) — Centre 2 Manager

Un seul code source produit **trois choses** : le site web, l'installateur Windows et l'APK Android.
Les trois se connectent au même projet Supabase (via `.env` ou les secrets GitHub).

| Version | Fichier obtenu | Comment |
|---|---|---|
| Windows | `Centre 2 Manager-Setup-1.0.0.exe` | `npm run electron:build` (sur Windows) ou GitHub |
| Android | `application-android.apk` | GitHub (recommandé) ou Android Studio |
| iPhone | — | non inclus (voir plus bas) |

---

## Méthode recommandée : compilation automatique sur GitHub (aucun outil à installer)

1. Créez un dépôt GitHub **privé** (ex. `centre2-manager-app`) et envoyez-y le contenu de ce dossier
   (le fichier `.gitignore` exclut déjà `.env`, `node_modules`, etc.) :
   ```bash
   git init
   git add .
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/VOTRE-COMPTE/centre2-manager-app.git
   git push -u origin main
   ```
2. Dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret** :
   - `VITE_SUPABASE_URL` : l'URL du projet Supabase de CETTE application
   - `VITE_SUPABASE_ANON_KEY` : la clé « anon public » du même projet
3. Onglet **Actions → Build apps → Run workflow**. Comptez 5 à 10 minutes.
4. Ouvrez l'exécution terminée : en bas, section **Artifacts**, téléchargez
   `installateur-windows` (le `.exe`) et `application-android` (l'`.apk`).

### Installer sur Windows
Double-cliquez sur le `.exe`. Windows peut afficher « Windows a protégé votre ordinateur » (l'installateur
n'est pas signé par un certificat payant) : **Informations complémentaires → Exécuter quand même**.
Les données sont dans le cloud : désinstaller/réinstaller ne perd rien.

### Installer sur Android
Envoyez l'`.apk` sur le téléphone (WhatsApp, câble, e-mail), ouvrez-le et autorisez
« Installer des applis inconnues » pour l'application utilisée. Au premier lancement : écran de connexion.

---

## Signature Android (indispensable pour les mises à jour)
Sans clé de signature, le workflow produit un APK de **test** ; chaque nouvelle compilation est signée
différemment et **Android refuse de l'installer par-dessus la précédente**. Pour un usage réel :

1. Créez la clé **une seule fois** (sur n'importe quel PC avec Java) et **sauvegardez-la en lieu sûr** :
   si elle est perdue, plus aucune mise à jour possible.
   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias centre2-manager -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Encodez-la en texte (PowerShell) :
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) | Set-Clipboard
   ```
3. Ajoutez 4 secrets GitHub : `ANDROID_KEYSTORE_BASE64` (le texte copié), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`centre2-manager`), `ANDROID_KEY_PASSWORD`.
4. Relancez le workflow : l'APK est maintenant signé (fichier `application-android.apk`).
   Chaque compilation reçoit un numéro de version croissant automatiquement.

---

## Méthode locale (sans GitHub)
**Windows** (sur un PC Windows avec Node 20+) :
```bash
npm install
# créez .env (voir .env.example)
npm run electron:build      # -> release/Centre 2 Manager-Setup-1.0.0.exe
```
**Android** (Android Studio + Java 17 installés) :
```bash
npm install
npm run build
npx cap sync android
npx cap open android        # Android Studio : Build > Build Bundle(s) / APK(s) > Build APK(s)
```
La compilation Windows doit se faire **sur Windows** (ou sur GitHub) : elle ne peut pas être faite sous Linux/Mac sans Wine.

---

## Mises à jour
1. Modifiez le code, puis incrémentez `"version"` dans `package.json` (ex. `1.0.1`).
2. Relancez le workflow, redistribuez le `.exe` / l'`.apk`. Il n'y a pas de mise à jour automatique.
3. Si la base de données a changé, exécutez d'abord la migration SQL correspondante.

## Particularités de la version mobile
- **PDF (reçus, rapports)** : ils s'ouvrent dans la feuille de partage d'Android (Enregistrer, WhatsApp, Imprimer, e-mail…).
- Connexion Internet obligatoire (comme sur ordinateur).
- Le bouton « retour » d'Android revient à l'écran précédent ; à l'accueil il quitte l'application.
- La sauvegarde automatique Android vers le cloud Google est désactivée (données de patients).

## Google Play et iPhone (plus tard)
- **Google Play** : compte développeur (25 $, une fois), puis `./gradlew bundleRelease` (fichier `.aab`) avec la même clé de signature.
- **iPhone** : nécessite un Mac (ou un exécuteur macOS GitHub) et un compte Apple Developer (99 $/an). Non inclus.

## Ce qui a été vérifié
- Application de bureau empaquetée (Linux) lancée pour de vrai : s'ouvre, charge l'interface, navigation, dossier de données propre à l'application.
- Interface mobile contrôlée en largeur de téléphone (390 px) : listes, panier, vente par lot.
- **Non vérifié ici** (pas d'outils Windows/Android dans l'environnement de préparation) : la compilation de l'installateur `.exe` et de l'`.apk`, et leur exécution sur un vrai appareil. Le workflow GitHub est là pour cela ; en cas d'erreur, envoyez-moi le journal de l'étape en échec.
