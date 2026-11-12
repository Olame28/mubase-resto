# Sauvegarde et restauration — MUBASE POS

Toutes les données commerciales sont stockées **localement** dans
IndexedDB sur le terminal. Il n'y a pas de serveur : la sauvegarde est donc
essentielle et se fait par export de fichier.

## Ce qui est sauvegardé

Un export JSON contient **tout** :

- produits (catalogue + prix modifiés par le gérant)
- paramètres (taux de change, arrondi, nom du serveur)
- paniers en cours par table
- ventes (avec taux de change figé, mode de paiement, monnaie)
- clôtures Z
- journal d'audit

## Exporter (sauvegarde)

1. **Paramètres** (PIN gérant) → onglet **Sauvegarde**.
2. **Exporter (JSON)** → un fichier `mubase-pos-sauvegarde-<date>.json`
   est téléchargé.
3. **Transférez ce fichier** sur un PC, une clé USB ou un cloud
   (Google Drive, etc.).

**Fréquence conseillée :** une fois par jour (par exemple à la clôture Z),
et avant toute manipulation importante.

La date de la dernière sauvegarde est affichée dans l'onglet Sauvegarde.

### Export CSV des ventes

Bouton **Exporter ventes (CSV)** : fichier `mubase-pos-ventes-<date>.csv`
ouvrable dans Excel, avec toutes les ventes (reçu, date, table, totaux,
paiement, monnaie, statut). Utile pour la comptabilité.

## Restaurer

1. **Paramètres** (PIN) → **Sauvegarde** → **Importer (JSON)**.
2. Choisissez le fichier `.json` de sauvegarde.
3. L'application **vérifie le fichier** (format, nombre de ventes,
   doublons de numéros de reçu) et affiche un récapitulatif.
4. Confirmez : **une sauvegarde de l'état actuel est d'abord créée
   automatiquement** (téléchargée sous le nom
   `mubase-pos-AVANT-RESTAURATION-<date>.json`), puis les données sont
   remplacées.
5. L'application se recharge.

## Garanties

- Une **mise à jour de l'application** ne supprime jamais les données
  (elles sont dans IndexedDB, indépendante des fichiers du programme).
- La restauration **demande toujours confirmation** et crée une sauvegarde
  de sécurité préalable.
- Les fichiers invalides ou d'une autre application sont refusés.
- Les numéros de reçu en double sont détectés et signalés.

## En cas de perte du terminal

1. Installez l'application sur le nouveau terminal (même procédure PWA).
2. Ouvrez Paramètres → Sauvegarde → Importer le dernier fichier JSON.
3. Toutes les ventes, prix et paniers sont restaurés.

## Bonnes pratiques

- Gardez **plusieurs sauvegardes** datées (ne pas écraser l'ancienne).
- Testez une restauration sur un appareil secondaire de temps en temps.
- Ne partagez jamais les fichiers de sauvegarde publiquement : ils contiennent
  des données commerciales.
