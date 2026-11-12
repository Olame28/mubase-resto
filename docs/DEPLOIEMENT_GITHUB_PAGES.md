# Déploiement gratuit sur GitHub Pages (HTTPS)

GitHub Pages est **uniquement le moyen de distribution** : après installation,
l'application fonctionne sans Internet. Aucun serveur ni nom de domaine payant
n'est nécessaire.

## 1. Créer le dépôt

1. Créez un compte GitHub (gratuit) si besoin.
2. Créez un nouveau dépôt public, par exemple `mubase-pos`.
3. Récupérez l'URL : `https://github.com/VOTRE-COMPTE/mubase-pos`

## 2. Publier les fichiers

### Option A — depuis GitHub web (simple)

1. Déposez le **ZIP** `MUBASE-POS.zip` sur votre ordinateur.
2. Extrayez-le : vous obtenez le dossier `MUBASE-POS/`.
3. Sur GitHub : **Add file → Upload files**.
4. Glissez **le contenu du dossier MUBASE-POS** (index.html, manifest.json,
   sw.js, css/, js/, assets/, docs/, tests/) — pas le dossier parent.
5. Commit.

> Important : les fichiers doivent être à la **racine** du dépôt pour que
> `https://VOTRE-COMPTE.github.io/mubase-pos/` fonctionne.

### Option B — en ligne de commande

```bash
git init
cd MUBASE-POS
git add .
git commit -m "MUBASE POS v1"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/mubase-pos.git
git push -u origin main
```

## 3. Activer GitHub Pages

1. Dépôt → **Settings → Pages**.
2. Source : **Deploy from a branch** → branche `main`, dossier `/ (root)`.
3. Save. L'adresse est :
   `https://VOTRE-COMPTE.github.io/mubase-pos/`
4. Attendez 1–2 minutes, puis ouvrez l'adresse dans Chrome sur le Citaq.

## 4. Vérifications

- Le cadenas HTTPS doit être présent dans la barre d'adresse.
- `manifest.json` et `sw.js` doivent être accessibles en HTTPS.
- Testez l'installation PWA (voir `INSTALLATION_PWA.md`).

## Fichier .nojekyll

Le fichier `.nojekyll` (déjà inclus) désactive le traitement Jekyll de
GitHub Pages : sans lui, certains dossiers commençant par `_` seraient ignorés.
Nos dossiers (`css`, `js`, `assets`) ne posent pas de problème, mais le fichier
est conservé par sécurité.

## Limites connues

- GitHub Pages est statique : aucune base de données serveur (c'est voulu,
  toutes les données sont locales sur le terminal).
- Si le dépôt est **privé**, GitHub Pages nécessite un compte payant :
  gardez le dépôt **public** (le code ne contient aucun secret).
- Pages régénère le site à chaque push : comptez ~1 minute de propagation.
