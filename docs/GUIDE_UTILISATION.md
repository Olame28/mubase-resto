# Guide d'utilisation — MUBASE POS

## Premier démarrage

1. Ouvrir l'application (voir `INSTALLATION_PWA.md`).
2. Le catalogue officiel est chargé automatiquement.
3. **Changez le PIN gérant** : bouton **Paramètres** → saisissez le PIN `1234`
   → onglet Général → « Nouveau PIN gérant » → Enregistrer.
   Le PIN par défaut est signalé par un avertissement à l'écran.

## Faire une vente (service)

1. Touchez **Tables** pour voir l'occupation, ou sélectionnez directement la
   table dans la liste déroulante du panier (Comptoir par défaut).
2. Touchez les produits pour les ajouter. Le panier se sauvegarde
   **automatiquement** à chaque modification.
3. Utilisez **+ / −** pour les quantités, **✎** pour ajouter une note
   (ex. « sans oignon »), **✕** pour retirer une ligne.
4. Les articles **« Prix à définir »** (Assiette composé, Spaghetti bolognaise)
   sont grisés et ne peuvent pas être vendus tant que le gérant n'a pas
   renseigné leur prix dans Paramètres → Produits.
5. Les accompagnements (Riz, Frites, Foufou) sont marqués **INCLUS** et
   n'augmentent pas le total.
6. **Envoyer en cuisine** : imprime le bon de cuisine des articles pas
   encore envoyés (table, heure, quantités, notes — sans prix). Les articles
   envoyés deviennent **verrouillés** (✓cuisine, non modifiables) : si le
   client commande autre chose, ajoutez les nouveaux articles et renvoyez en
   cuisine — seul le nouveau bon s'imprimera.
7. **Encaisser** quand le client paie : le reçu final récapitule toute la
   commande (articles envoyés + derniers ajouts).

## Encaissement

- Choisissez **USD**, **FC** ou **Mixte**.
- Le montant reçu est pré-rempli avec le total exact : ajustez si le client
  paie avec d'autres coupures.
- Une **remise en FC** peut être saisie (optionnelle).
- La **monnaie à rendre** s'affiche en temps réel (FC et USD).
- **Valider la vente** n'est possible qu'une seule fois : le bouton se bloque
  pendant l'enregistrement et chaque reçu a un numéro unique.
- Le reçu s'affiche : **Imprimer** pour le ticket 80 mm, **Fermer** sinon.

> Important : pour que `window.print()` envoie vers l'imprimante intégrée du
> Citaq, configurez une fois l'impression par défaut du terminal (voir
> INSTALLATION_PWA.md § Impression).

## Tables

- Indicateur coloré : vert = libre, orange = occupée (nombre d'articles).
- Le panier de chaque table est **conservé même après fermeture/redémarrage**
  de l'application.
- **Transférer** (PIN requis) déplace toute la commande vers une autre table.
- Après encaissement, le panier de la table est vidé automatiquement.

## Rapports (PIN gérant requis)

- **Journalier** : ventes du jour avec détails.
- **Par date** : chiffre d'affaires d'une journée précise.
- **Paiements** : répartition USD / FC / Mixte.
- **Catégories** et **Produits** : quantités vendues.
- **Clôtures Z** : historique des fins de journée.

## Paramètres (PIN gérant requis)

- **Général** : taux de change (défaut 1 $ = 2800 FC), arrondi FC
  (100 / 500 / aucun), nom du serveur affiché sur les reçus, nouveau PIN,
  clôture Z, test d'impression.
- **Produits** : modifier prix, activer/désactiver, articles gratuits,
  ajouter un produit, renseigner les prix manquants.
- **Sauvegarde** : export/import JSON, export CSV des ventes.

> Le taux de change est **figé dans chaque vente** : modifier le taux ne
> recalcule jamais les anciennes ventes.

## Annulations (PIN gérant requis)

- Bouton **Annuler** dans la barre du haut : choisir une vente → motif →
  confirmer. La vente passe au statut « annulée » (elle reste visible dans
  les données et le journal d'audit, mais est exclue des rapports).

## Conseils de fiabilité

- Faites une **sauvegarde JSON régulière** (Paramètres → Sauvegarde) et
  conservez le fichier sur un PC ou une clé USB.
- En cas de panne, restaurer le fichier JSON depuis le même onglet.
- L'application fonctionne sans Internet : le badge **HORS LIGNE** est
  purement informatif, la caisse continue de fonctionner.
