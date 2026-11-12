# Rapport des tests — MUBASE POS

Date : 12 novembre 2026
Environnement de test : Windows, Google Chrome 156 (headless + CDP),
serveur HTTP local `python -m http.server`, IndexedDB réel.
Base de test isolée : `mubase_pos_test_db` (les données réelles ne sont
jamais modifiées par les tests).

## Résultat global

**101 tests réussis, 0 échoué** (101 assertions au total).

## Couverture des tests automatisés

| Domaine | Tests effectués | Résultat |
|---|---|---|
| Devises | taux 2800, arrondi 100, conversions USD↔FC, totaux multi-devises | OK |
| Catalogue | 70 articles chargés, prix officiaux vérifiés (Shawarma 4$, Samboussa 5000 FC, Shisha 10000 FC, Eau 2000 FC, Espresso 1,5$), 2 articles « prix à définir » bloqués, 4 accompagnements inclus | OK |
| Paiements | USD/FC/mixte, insuffisance refusée, monnaie calculée, remise FC | OK |
| Sécurité | PIN haché SHA-256+sel (jamais en clair), PIN correct/incorrect | OK |
| Commandes | ajout, fusion quantités, notes, article bloqué refusé, 8 tables, transfert Table 3 → VIP, persistance IndexedDB, rechargement après « redémarrage » | OK |
| Encaissement | 4 ventes réelles enregistrées (USD, FC, mixte), numéros uniques `MUB-AAAAMMJJ-XXXX`, taux figé à 2800, recherche par n° reçu, annulation sans suppression + journalisation | OK |
| Reçus | contenu vérifié : nom, adresse, téléphones, n°, date, table, articles, totaux, paiement, monnaie, « Merci de votre visite » | OK |
| Rapports | journalier, par date, par paiement, catégories, produits, clôtures Z | OK |
| Clôture Z | 3 ventes payées comptées (annulée exclue), totaux corrects, ventes conservées | OK |
| Sauvegarde | export JSON complet, validation fichier, détection doublons, restauration idempotente, export CSV disponible | OK |
| Démarrage app | smoke test : index.html charge, 70 cartes produits, 19 onglets, 8 tables, IndexedDB et ServiceWorker supportés | OK |

## Bugs trouvés et corrigés grâce aux tests

1. **`Currency.getSettings` / `Security.verifyPin` utilisaient une lecture
   asynchrone comme synchrone** → une Promesse était stockée dans IndexedDB
   (erreur « Promise could not be cloned ») et le PIN ne pouvait jamais être
   validé. Corrigé : utilisation du cache synchrone `getSettingSync`.
2. **Fallback `getAll` IndexedDB** pour les anciens navigateurs sans
   `IDBObjectStore.getAll` (requis pour Android 5.1.1).

## Tests NON automatisables (à faire physiquement sur le Citaq)

- [ ] Installation PWA réelle depuis Chrome Android (icône écran d'accueil)
- [ ] Démarrage hors ligne après installation (Wi-Fi coupé)
- [ ] Impression réelle sur l'imprimante thermique 80 mm intégrée
      (test d'impression depuis Paramètres)
- [ ] Performance tactile réelle (rapidité des taps, scroll)
- [ ] Persistance après extinction complète du terminal
- [ ] Comportement Chrome Android 5.1.1 (Service Worker partiellement
      supporté : l'app fonctionne en ligne même sans SW ; IndexedDB est OK)

## Commandes pour rejouer les tests

```bash
# 1) Servir le projet
cd MUBASE-POS && python -m http.server 8931

# 2) Chrome headless avec débogage (dans un autre terminal)
chrome --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/chrome-test about:blank

# 3) Lancer les tests
python tests/run_tests.py
```

Ou simplement ouvrir `tests/tests.html` dans n'importe quel navigateur.
