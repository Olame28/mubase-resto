# Installation PWA sur Citaq H10-3 (Android 5.1.1)

## Prérequis

- Le projet publié en **HTTPS** (voir `DEPLOIEMENT_GITHUB_PAGES.md`).
  HTTPS est obligatoire pour le service worker et l'installation PWA.
- Chrome (ou le navigateur du terminal) à jour autant que possible.

## Procédure d'installation

1. Allumez le Citaq, connectez-le au Wi-Fi (une seule fois suffit pour
   télécharger l'application ; ensuite tout est local).
2. Ouvrez **Chrome** et saisissez l'adresse HTTPS du projet
   (ex. `https://votre-compte.github.io/mubase-pos/`).
3. Attendez le chargement complet (icônes de catégories visibles).
4. Selon la version de Chrome :
   - menu **⋮** → **Ajouter à l'écran d'accueil** → **Ajouter** ; ou
   - une bannière « Installer l'application » apparaît en bas → **Installer**.
5. Une icône **MUBASE** apparaît sur l'écran d'accueil.
6. Lancez-la : l'application s'ouvre en plein écran, sans barre de navigation.

## Vérification du fonctionnement hors ligne

1. Une fois l'application ouverte **au moins une fois en ligne**, coupez le
   Wi-Fi du terminal.
2. Fermez puis rouvrez l'application depuis l'icône : elle doit démarrer
   normalement et afficher le badge **HORS LIGNE**.
3. Testez un panier : il doit se sauvegarder (badge « Sauvegardé »).

> Si le terminal refuse l'installation, l'application reste utilisable en
> l'ouvrant dans Chrome : IndexedDB conserve les données, mais le démarrage
> hors ligne n'est garanti qu'avec le service worker (HTTPS requis).

## Impression thermique 80 mm

L'impression utilise `window.print()` : c'est le système Android qui envoie
le ticket à l'imprimante intégrée.

1. Ouvrez l'application → **Paramètres** (PIN) → **Test d'impression**.
2. Le reçu de test s'affiche → touchez **Imprimer**.
3. À la première impression, Android demande le fournisseur : choisissez
   **Imprimante interne / Citaq** et format **80 mm**.
4. Cochez « Utiliser par défaut » pour ne plus être redemandé.
5. Vérifiez physiquement que le ticket sort correctement (coupe, largeur,
   lisibilité). Si le ticket est tronqué, ajustez les marges dans les
   options d'impression Android.

> Tant que le ticket n'a pas été vérifié sur le terminal, considérez
> l'impression comme « à tester » — les ventes et reçus restent enregistrés
> dans l'application même si l'impression échoue.

## Réimpression d'un reçu

Après chaque vente, le reçu reste affiché : **Imprimer** réimprime.
Pour réimprimer une ancienne vente : exports/rapports ou refaire la vente
test — la réimpression d'un reçu passé n'est pas encore exposée dans
l'interface (amélioration possible : bouton « Réimprimer » dans les rapports).

## Mise à jour de l'application

- Publiez la nouvelle version sur GitHub Pages (remplacer les fichiers).
- Ouvrez l'application : le service worker télécharge la mise à jour.
- Un message « Mise à jour disponible » s'affiche : fermez et rouvrez
  l'application. **Les données locales (ventes, catalogue modifié) ne sont
  jamais effacées** par une mise à jour.
