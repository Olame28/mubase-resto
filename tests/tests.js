/* MUBASE POS - Tests automatisés (navigateur, IndexedDB réel)
 * Chaque test est indépendant et le résultat est affiché dans tests.html.
 */
(function () {
  'use strict';

  var results = [];
  var currentSuite = '';

  function suite(name) { currentSuite = name; }
  function ok(cond, label) {
    results.push({ suite: currentSuite, pass: !!cond, label: label });
  }
  function eq(a, b, label) {
    ok(a === b, label + ' (attendu: ' + b + ', obtenu: ' + a + ')');
  }
  function near(a, b, eps, label) {
    ok(Math.abs(a - b) <= (eps || 0.001), label + ' (attendu≈' + b + ', obtenu: ' + a + ')');
  }

  function section(title) {
    var div = document.createElement('div');
    div.className = 'suite';
    div.innerHTML = '<h2>' + title + '</h2><div class="lines"></div>';
    document.getElementById('results').appendChild(div);
    return div.querySelector('.lines');
  }

  function render() {
    var pass = 0, fail = 0;
    results.forEach(function (r) {
      if (r.pass) pass++; else fail++;
    });
    var el = document.getElementById('summary');
    el.innerHTML = '<span class="' + (fail ? 'fail' : 'pass') + '">' +
      pass + ' réussi(s), ' + fail + ' échoué(s) sur ' + results.length + '</span>';
    // Affiche les lignes par suite
    var lastSuite = null, container = null;
    results.forEach(function (r) {
      if (r.suite !== lastSuite) {
        lastSuite = r.suite;
        container = section(r.suite);
      }
      var line = document.createElement('div');
      line.className = r.pass ? 'pass' : 'fail';
      line.textContent = (r.pass ? '✓ ' : '✗ ') + r.label;
      container.appendChild(line);
    });
  }

  /* ================= Tests ================= */

  function testCurrency() {
    suite('Devises et conversions');
    var C = MUBASE.Currency;
    eq(C.getRate(), 2800, 'Taux par défaut 2800');
    eq(C.getRounding(), 100, 'Arrondi par défaut 100 FC');
    eq(C.usdToFC(4), 11200, '4 USD -> 11200 FC');
    eq(C.usdToFC(1.5), 4200, '1.5 USD -> 4200 FC');
    near(C.fcToUSD(5000), 1.79, 0.01, '5000 FC -> ~1.79 USD');
    // produit USD
    var pUSD = { priceUSD: 4 };
    var pr = C.productPrices(pUSD);
    near(pr.usd, 4, 0.001, 'Prix USD produit = 4');
    eq(pr.fc, 11200, 'Équivalent FC = 11200');
    // produit FC fixe
    var pFC = { priceFC: 5000 };
    var pr2 = C.productPrices(pFC);
    eq(pr2.fc, 5000, 'Prix FC fixe = 5000');
    near(pr2.usd, 1.79, 0.01, 'Équivalent USD ~1.79');
    // totaux
    var t = C.totals([{ qty: 2, unitUSD: 4, unitFC: 11200 }, { qty: 1, unitUSD: 0, unitFC: 0 }]);
    eq(t.usd, 8, 'Total USD = 8');
    eq(t.fc, 22400, 'Total FC = 22400');
  }

  function testCatalog() {
    suite('Catalogue officiel');
    var CATALOG = MUBASE.Products.CATALOG;
    ok(CATALOG.length >= 60, 'Catalogue complet chargé (' + CATALOG.length + ' articles)');
    function find(name) {
      for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].name === name) return CATALOG[i];
      return null;
    }
    var shaw = find('Shawarma poulet');
    eq(shaw && shaw.usd, 4, 'Shawarma poulet = 4 USD');
    var samb = find('Samboussa (3pc)');
    eq(samb && samb.fc, 5000, 'Samboussa = 5000 FC');
    var shisha = find('Shisha');
    eq(shisha && shisha.fc, 10000, 'Shisha = 10000 FC');
    var eau = find('Eau minérale');
    eq(eau && eau.fc, 2000, 'Eau minérale = 2000 FC');
    var esp = find('Espresso');
    near(esp && esp.usd, 1.5, 0.001, 'Espresso = 1.5 USD');
    // prix à définir => bloqués
    var blocked = CATALOG.filter(function (c) { return c.undefined; });
    eq(blocked.length, 2, 'Exactement 2 articles sans prix');
    ok(blocked.every(function (c) { return c.name.indexOf('Assiette') === 0 || c.name.indexOf('Spaghetti') === 0; }),
      'Les 2 articles bloqués sont Assiette composée et Spaghetti');
    // accompagnements gratuits
    var free = CATALOG.filter(function (c) { return c.free; });
    eq(free.length, 4, '4 accompagnements marqués inclus');
    // catégories présentes
    var cats = {};
    CATALOG.forEach(function (c) { cats[c.cat] = true; });
    ok(cats['Shawarmas'] && cats['Cafés chauds'] && cats['Détox'] && cats['Crème'],
      'Toutes les catégories présentes');
  }

  function testPaymentsMath() {
    suite('Calculs de paiement');
    var P = MUBASE.Payments;
    var sale = { totalUSD: 10, totalFC: 28000 };
    // USD suffisant
    var r1 = P.computePayment(sale, { method: 'USD', usdReceived: 15 });
    ok(r1.ok, 'Paiement USD 15$ accepté pour total 10$');
    near(r1.payment.usdChange, 5, 0.001, 'Monnaie USD = 5$');
    eq(r1.payment.fcChange, 14000, 'Monnaie FC = 14000');
    // USD insuffisant
    var r2 = P.computePayment(sale, { method: 'USD', usdReceived: 9 });
    ok(!r2.ok, 'Paiement USD 9$ refusé (insuffisant)');
    // FC suffisant
    var r3 = P.computePayment(sale, { method: 'FC', fcReceived: 30000 });
    ok(r3.ok, 'Paiement FC 30000 accepté');
    eq(r3.payment.fcChange, 2000, 'Monnaie FC = 2000');
    // FC insuffisant
    var r4 = P.computePayment(sale, { method: 'FC', fcReceived: 10000 });
    ok(!r4.ok, 'Paiement FC 10000 refusé');
    // Mixte : 5$ + 14000 FC = 10$
    var r5 = P.computePayment(sale, { method: 'MIXED', usdReceived: 5, fcReceived: 14000 });
    ok(r5.ok, 'Mixte 5$ + 14000 FC accepté');
    eq(r5.payment.fcChange, 0, 'Pas de monnaie en mixte exact');
    // Mixte insuffisant
    var r6 = P.computePayment(sale, { method: 'MIXED', usdReceived: 5, fcReceived: 10000 });
    ok(!r6.ok, 'Mixte insuffisant refusé');
    // Remise
    var r7 = P.computePayment(sale, { method: 'FC', fcReceived: 26000, discountFC: 2000 });
    ok(r7.ok, 'Remise 2000 FC appliquée');
    eq(r7.payment.fcChange, 0, 'Monnaie 0 après remise');
    eq(r7.payment.discountFC, 2000, 'discountFC enregistré');
  }

  function testSecurity() {
    suite('Sécurité PIN');
    var S = MUBASE.Security;
    var p = S.setPin('9876');
    return p.then(function () {
      ok(S.verifyPin('9876'), 'PIN correct accepté');
      ok(!S.verifyPin('0000'), 'PIN incorrect refusé');
      return MUBASE.DB.getSetting('manager_pin_hash').then(function (hash) {
        ok(hash && hash !== '9876' && hash.length === 64,
          'PIN stocké haché (SHA-256, jamais en clair)');
      });
    });
  }

  /* ---------- Tests avec base de données ---------- */

  function testDB() {
    suite('Base de données et commandes');
    var DB = MUBASE.DB, O = MUBASE.Orders;
    return DB.resetAll()
      .then(function () { return DB.loadSettingsCache(); })
      .then(function () {
        var s = MUBASE.Currency.getSettings();
        if (s.rate == null) { s.rate = 2800; s.rounding = 100; return DB.setSetting('settings', s); }
      })
      .then(function () { return MUBASE.Products.seedIfEmpty(); })
      .then(function () { return DB.getProducts(); })
      .then(function (products) {
        eq(products.length, MUBASE.Products.CATALOG.length, 'Catalogue inséré (' + products.length + ' produits)');
        // panier sur Table 3
        return O.loadCart('t3').then(function () {
          var p = null;
          products.forEach(function (x) { if (x.name === 'Shawarma poulet') p = x; });
          ok(!!p, 'Produit Shawarma poulet trouvé');
          ok(O.addProduct(p), 'Ajout Shawarma au panier t3');
          ok(O.addProduct(p), 'Second ajout (fusion qté)');
          eq(O.cart[0].qty, 2, 'Quantité fusionnée = 2');
          var p2 = null;
          products.forEach(function (x) { if (x.name === 'Samboussa (3pc)') p2 = x; });
          O.addProduct(p2);
          var t = O.cartTotals();
          near(t.usd, 8 + MUBASE.Currency.fcToUSD(5000), 0.001, 'Total USD exact');
          eq(t.fc, 22400 + 5000, 'Total FC exact');
          // note article
          O.setItemNote(1, 'sans piment');
          eq(O.cart[1].note, 'sans piment', 'Note enregistrée');
          // article bloqué refusé
          var blocked = null;
          products.forEach(function (x) { if (x.name === 'Spaghetti bolognaise') blocked = x; });
          ok(blocked && blocked.active === false, 'Spaghetti marqué inactif');
          var before = O.cart.length;
          O.addProduct(blocked);
          eq(O.cart.length, before, 'Article sans prix refusé au panier');
          // sauvegarde + rechargement (persistance)
          return O.saveCart().then(function () {
            return DB.getCart('t3');
          }).then(function (cart) {
            ok(cart && cart.items.length === 2, 'Panier persisté dans IndexedDB');
            // rechargement après "redémarrage"
            return O.loadCart('t3');
          }).then(function () {
            eq(O.cart.length, 2, 'Panier récupéré après rechargement');
            eq(O.cart[0].qty, 2, 'Quantités conservées');
            // transfert vers VIP
            return O.transferCart('t3', 'vip');
          }).then(function () {
            return DB.getCart('t3');
          }).then(function (c3) {
            ok(!c3, 'Panier t3 supprimé après transfert');
            return DB.getCart('vip');
          }).then(function (cvip) {
            ok(cvip && cvip.items.length === 2, 'Panier VIP contient les articles');
            return O.loadCart('vip');
          }).then(function () {
            O.clearCart();
          });
        });
      });
  }

  function testKitchen() {
    suite('Bon de cuisine');
    var O = MUBASE.Orders, DB = MUBASE.DB;
    return O.loadCart('t4').then(function () {
      var products = null;
      return DB.getProducts().then(function (ps) {
        products = ps;
        var p = null;
        ps.forEach(function (x) { if (x.name === 'Café noir') p = x; });
        ok(!!p, 'Produit Café noir trouvé');
        O.addProduct(p);
        eq(O.unsentItems().length, 1, '1 article non envoyé en cuisine');
        // envoi cuisine
        var items = O.unsentItems();
        var text = MUBASE.Receipts.buildKitchenTicketText(items, 'Table 4');
        ok(text.indexOf('BON DE COMMANDE') !== -1, 'Ticket commande contient le titre');
        ok(text.indexOf('Café noir') !== -1, 'Ticket cuisine contient l\'article');
        ok(text.indexOf('TOTAL') === -1, 'Ticket cuisine sans prix');
        ok(O.markSentToKitchen(), 'Articles marqués envoyés');
        eq(O.unsentItems().length, 0, 'Plus d\'article non envoyé');
        ok(O.isLocked(0), 'Article envoyé verrouillé');
        // réajout du même produit : doit créer une NOUVELLE ligne non envoyée
        O.addProduct(p);
        eq(O.cart.length, 2, 'Nouvel article identique = nouvelle ligne');
        eq(O.unsentItems().length, 1, 'Seul le nouvel article est non envoyé');
        // HTML ticket
        var html = MUBASE.Receipts.buildKitchenTicketHTML(O.unsentItems(), 'Table 4');
        ok(html.indexOf('Café noir') !== -1, 'Aperçu cuisine HTML OK');
        // reçu texte pour impression directe
        O.clearCart();
      });
    });
  }

  function testCheckout() {
    suite('Encaissement et reçus');
    var O = MUBASE.Orders, P = MUBASE.Payments, DB = MUBASE.DB;
    var receiptSeen = {};
    function oneSale(tableId, method, input) {
      return O.loadCart(tableId).then(function () {
        var products = null;
        return DB.getProducts().then(function (ps) {
          products = ps;
          var p = null;
          ps.forEach(function (x) { if (x.name === 'Espresso') p = x; });
          O.addProduct(p);
          O.addProduct(p);
          var t = O.cartTotals();
          var res = P.computePayment({ totalUSD: t.usd, totalFC: t.fc },
            { method: method, usdReceived: input.usd, fcReceived: input.fc });
          ok(res.ok, 'Calcul paiement ' + method + ' pour ' + tableId);
          return P.checkout(res.payment);
        });
      }).then(function (sale) {
        ok(sale && !sale.error, 'Vente enregistrée ' + tableId + ' : ' + (sale && sale.receiptNo));
        if (sale && sale.receiptNo) {
          ok(!receiptSeen[sale.receiptNo], 'Numéro de reçu unique ' + sale.receiptNo);
          receiptSeen[sale.receiptNo] = true;
          ok(/^MUB-\d{8}-\d{4}$/.test(sale.receiptNo), 'Format reçu conforme');
        }
        return sale;
      });
    }
    var sales = [];
    return O.loadCart('t1')
      .then(function () { return oneSale('t1', 'USD', { usd: 10 }); })
      .then(function (s) { sales.push(s); return oneSale('t2', 'FC', { fc: 100000 }); })
      .then(function (s) { sales.push(s); return oneSale('t3', 'MIXED', { usd: 2, fc: 5000 }); })
      .then(function (s) { sales.push(s); return oneSale('counter', 'USD', { usd: 5 }); })
      .then(function () { return DB.getSales(); })
      .then(function (all) {
        var paid = all.filter(function (x) { return x.status === 'paid'; });
        eq(paid.length, 4, '4 ventes payées enregistrées');
        // taux figé dans la vente
        ok(paid.every(function (x) { return x.rate === 2800; }), 'Taux figé à 2800 dans chaque vente');
        // reçus
        var html = MUBASE.Receipts.buildReceiptHTML(paid[0]);
        ok(html.indexOf('MUBASE') !== -1, 'Reçu : nom restaurant');
        ok(html.indexOf(paid[0].receiptNo) !== -1, 'Reçu : numéro présent');
        ok(html.indexOf('Merci de votre visite') !== -1, 'Reçu : message de fin');
        ok(html.indexOf('+243 825 451 103') !== -1, 'Reçu : téléphone');
        ok(html.indexOf('TOTAL À PAYER') !== -1, 'Reçu : total à payer visible');
        return DB.getSaleByReceipt(paid[0].receiptNo);
      }).then(function (found) {
        ok(!!found, 'Recherche de vente par n° de reçu fonctionnelle');
        // annulation
        return DB.getSales();
      }).then(function (all) {
        var target = all.filter(function (x) { return x.status === 'paid'; })[0];
        return MUBASE.Payments.cancelSale(target.id, 'test annulation');
      }).then(function (okCancel) {
        ok(okCancel === true, 'Annulation de vente effectuée');
        return DB.getAudit();
      }).then(function (audit) {
        ok(audit.some(function (a) { return a.action === 'ANNULATION'; }),
          'Annulation journalisée dans l\'audit');
        return all2check();
      });

      function all2check() {
        return DB.getSales().then(function (all) {
          var cancelled = all.filter(function (x) { return x.status === 'cancelled'; });
          eq(cancelled.length, 1, 'Une vente annulée (statut, pas de suppression)');
        });
      }
  }

  function testReports() {
    suite('Rapports et clôture Z');
    var R = MUBASE.Reports, DB = MUBASE.DB, U = MUBASE.Utils;
    var today = U.todayStr();
    return DB.getSalesByDate(today).then(function (sales) {
      var paid = sales.filter(function (s) { return s.status !== 'cancelled'; });
      eq(paid.length, 3, '3 ventes payées du jour pour les rapports (1 annulée exclue)');
      return R.daily();
    }).then(function (html) {
      ok(html.indexOf('Rapport du ' + today) !== -1, 'Rapport journalier généré');
      ok(html.indexOf('Ventes') !== -1, 'Rapport journalier affiche le nombre de ventes');
      return R.byPayment(today);
    }).then(function (html) {
      ok(html.indexOf('USD') !== -1 && html.indexOf('FC') !== -1 && html.indexOf('MIXED') !== -1,
        'Rapport paiements : 3 modes présents');
      return R.byCategory(today, null);
    }).then(function (html) {
      ok(html.indexOf('table') !== -1, 'Rapport catégories généré');
      return R.byProduct(today);
    }).then(function (html) {
      ok(html.indexOf('Espresso') !== -1, 'Rapport produits : Espresso présent');
      return MUBASE.Settings.closeShift();
    }).then(function (sum) {
      eq(sum.salesCount, 3, 'Clôture Z : 3 ventes payées comptées');
      ok(sum.totalUSD > 0 && sum.totalFC > 0, 'Clôture Z : totaux calculés');
      return DB.getShifts();
    }).then(function (shifts) {
      ok(shifts.length >= 1, 'Clôture Z enregistrée');
      return DB.getSales();
    }).then(function (sales) {
      ok(sales.length >= 4, 'Ventes toujours présentes après clôture Z (rien supprimé)');
      return R.shifts();
    }).then(function (html) {
      ok(html.indexOf('Clôture') !== -1 || html.indexOf('202') !== -1, 'Historique clôtures affiché');
    });
  }

  function testBackup() {
    suite('Sauvegarde et restauration');
    var DB = MUBASE.DB, B = MUBASE.Backup;
    var snapshot = null;
    return DB.exportAll().then(function (data) {
      ok(data.app === 'MUBASE-POS', 'Export JSON : format reconnu');
      ok(data.sales.length >= 4, 'Export contient les ventes');
      ok(data.products.length > 50, 'Export contient le catalogue');
      snapshot = data;
      var v = B.validateImport(data);
      ok(v.ok, 'Validation fichier import OK');
      return B.detectDuplicates(data);
    }).then(function (info) {
      ok(info.fileSales >= 4, 'Détection doublons : fichier lu (' + info.fileSales + ' ventes)');
      // restaure le même snapshot (idempotent)
      return DB.importAll(snapshot);
    }).then(function () {
      return DB.getSales();
    }).then(function (sales) {
      ok(sales.length >= 4, 'Restauration : ventes préservées');
      return DB.getProducts();
    }).then(function (products) {
      ok(products.length > 50, 'Restauration : catalogue préservé');
      // CSV : vérifié côté comptage de lignes via export (non testé I/O fichier)
      ok(typeof B.exportCsv === 'function', 'Export CSV disponible');
    });
  }

  function testReceiptNumbering() {
    suite('Numérotation des reçus');
    var P = MUBASE.Payments;
    var n1 = P.nextReceiptNo();
    var n2 = P.nextReceiptNo();
    ok(n1 !== n2, 'Deux reçus consécutifs ont des numéros différents');
    ok(/^MUB-\d{8}-\d{4}$/.test(n1), 'Format ' + n1 + ' conforme');
    var counter = parseInt(n2.slice(-4), 10);
    ok(counter === parseInt(n1.slice(-4), 10) + 1, 'Compteur incrémenté');
  }

  /* ---------- Exécution ---------- */

  function run() {
    results = [];
    document.getElementById('results').innerHTML = '';
    document.getElementById('summary').textContent = 'Tests en cours...';

    var chain = Promise.resolve();
    [
      function () { testCurrency(); },
      function () { testCatalog(); },
      function () { testPaymentsMath(); },
      function () { return testSecurity(); },
      function () { return testDB(); },
      function () { return testKitchen(); },
      function () { return testCheckout(); },
      function () { return testReports(); },
      function () { return testBackup(); },
      function () { testReceiptNumbering(); }
    ].forEach(function (t) {
      chain = chain.then(function () {
        return Promise.resolve().then(t).catch(function (err) {
          ok(false, 'ERREUR dans la suite : ' + (err && err.message || err));
        });
      });
    });

    return chain.then(function () {
      render();
    });
  }

  function reset() {
    return MUBASE.DB.init()
      .then(function () { return MUBASE.DB.resetAll(); })
      .then(function () { return MUBASE.DB.loadSettingsCache(); })
      .then(function () {
        document.getElementById('summary').textContent = 'Base de test réinitialisée.';
        document.getElementById('results').innerHTML = '';
        results = [];
      });
  }

  document.getElementById('btnRun').onclick = function () {
    this.disabled = true;
    run().then(function () {
      document.getElementById('btnRun').disabled = false;
    });
  };
  document.getElementById('btnReset').onclick = reset;

  // Auto-run au chargement
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btnRun').click();
  });
})();
