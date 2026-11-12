# MUBASE POS

Logiciel de caisse **100 % local et hors ligne** pour **MUBASE Coffee et Restaurant**
(Goma, Himbi 2 — Avenue Félix Tshisekedi n°82, Église Bon Berger).

Application Web Progressive (PWA) installable sur tablette tactile, pensée pour le
terminal **Citaq H10-3 (Android 5.1.1, imprimante thermique 80 mm intégrée)**.

## Fonctionnalités

- Caisse tactile avec catalogue officiel complet (repas, cafés, thés, jus, milkshakes…)
- 8 tables indépendantes (Table 1 à 6, VIP, Comptoir) avec paniers persistants
- Prix en **USD et FC** (Francs congolais), taux de change modifiable (défaut : 1 $ = 2800 FC)
- Paiements **USD, FC et mixte**, calcul de la monnaie, remises
- Reçus **80 mm** imprimés via `window.print()` (imprimante intégrée du terminal)
- Numérotation automatique des reçus, taux de change figé dans chaque vente
- Rapports : journalier, par date, par mode de paiement, par catégorie, par produit
- Clôture Z (fin de journée) **sans suppression des ventes**
- PIN gérant (haché SHA-256) pour prix, taux, rapports, annulations, clôtures, sauvegardes
- Sauvegarde / restauration JSON complète + export CSV des ventes
- Fonctionnement **hors ligne** après installation (service worker + IndexedDB)
- Journal d'audit des opérations sensibles

## Démarrage rapide (développement)

Aucune installation nécessaire. Le projet est 100 % statique.

```bash
# Option 1 : ouvrir directement index.html dans un navigateur
# Option 2 : servir le dossier (recommandé pour le service worker)
cd MUBASE-POS
python -m http.server 8000
# puis ouvrir http://localhost:8000
```

> Le service worker et IndexedDB fonctionnent mieux en HTTP(S) qu'en `file://`.

## Tests

Ouvrir `tests/tests.html` dans un navigateur : une base IndexedDB **séparée**
(`mubase_pos_test_db`) est utilisée, les données réelles ne sont jamais touchées.

Un lanceur automatique existe aussi : `tests/run_tests.py` (nécessite Chrome avec
`--remote-debugging-port=9333` et un serveur HTTP sur le port 8931).

## Structure

```
MUBASE-POS/
├── index.html          # Interface unique (SPA)
├── manifest.json       # Manifeste PWA
├── sw.js               # Service worker (hors ligne)
├── css/                # style.css, responsive.css, print.css
├── js/                 # Modules ES5 (compatibles Android 5.1)
│   ├── utils.js  currency.js  database.js  security.js
│   ├── products.js  orders.js  payments.js  receipts.js
│   ├── reports.js  settings.js  backup.js  app.js
├── assets/icons/       # Icônes PWA (72 → 512 px)
├── tests/              # tests.html, tests.js, run_tests.py, smoke.py
└── docs/               # Documentation détaillée
```

## Documentation

- `docs/GUIDE_UTILISATION.md` — mode d'emploi complet
- `docs/INSTALLATION_PWA.md` — installer sur le Citaq H10-3
- `docs/DEPLOIEMENT_GITHUB_PAGES.md` — publier gratuitement en HTTPS
- `docs/SAUVEGARDE_RESTAURATION.md` — sauvegarde et restauration
- `docs/RAPPORT_TESTS.md` — résultats des tests exécutés

## Sécurité

- PIN gérant **jamais stocké en clair** (SHA-256 + sel aléatoire)
- PIN par défaut `1234` à changer impérativement au premier accès
- Toutes les ventes sont conservées : les annulations et clôtures Z sont des
  statuts/journalisations, jamais des suppressions
- Aucune donnée ne quitte l'appareil : pas de serveur, pas de CDN, pas de tracking
