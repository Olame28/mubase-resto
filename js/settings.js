/* MUBASE POS - Paramètres applicatifs (taux, arrondi, serveur, PIN) */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var P = window.MUBASE.Products;

  var S = {};

  S.getServerName = function () {
    var s = MUBASE.Currency.getSettings();
    return s.serverName || '';
  };

  S.saveGeneral = function (data) {
    var s = MUBASE.Currency.getSettings();
    if (data.rate != null) s.rate = parseFloat(data.rate);
    if (data.rounding != null) s.rounding = parseInt(data.rounding, 10);
    if (data.serverName != null) s.serverName = String(data.serverName).slice(0, 30);
    return MUBASE.DB.setSetting('settings', s);
  };

  S.savePin = function (newPin) {
    if (!newPin) return Promise.resolve(false);
    newPin = String(newPin).replace(/\D/g, '');
    if (newPin.length < 4) return Promise.resolve(false);
    return MUBASE.Security.setPin(newPin).then(function () {
      MUBASE.Security.clearDefaultFlag();
      MUBASE.Security.log('PARAMETRES', 'PIN gérant modifié');
      return true;
    });
  };

  // Sauvegarde produit (admin, après PIN)
  S.saveProduct = function (p) {
    return MUBASE.DB.saveProduct(p).then(function () {
      MUBASE.Security.log('PRODUIT', 'Produit enregistré : ' + p.name);
    });
  };

  // Clôture Z : enregistre un résumé SANS supprimer les ventes.
  // cashCount : espèces comptées physiquement par le gérant (FC).
  // expectedCashFC : espèces attendues = Σ encaissé - monnaie rendue
  // (équivalent FC pour les ventes USD et mixtes au taux figé).
  S.closeShift = function (cashCount) {
    var today = window.MUBASE.Utils.todayStr();
    return MUBASE.Reports.buildShiftSummary(today, today).then(function (sum) {
      var rate = window.MUBASE.Currency.getRate();
      var expected = 0;
      sum.sales.forEach(function (s) {
        var p = s.payment || {};
        var r = s.rate || rate;
        if (p.method === 'FC') {
          expected += (p.fcReceived || 0) - (p.fcChange || 0);
        } else if (p.method === 'USD') {
          expected += Math.round(((p.usdReceived || 0) - (p.usdChange || 0)) * r);
        } else if (p.method === 'MIXED') {
          expected += Math.round((p.usdReceived || 0) * r) +
            (p.fcReceived || 0) - (p.fcChange || 0);
        }
      });
      var counted = parseInt(cashCount, 10);
      var diff = isNaN(counted) ? null : counted - expected;
      return MUBASE.DB.addShift({
        date: new Date().toISOString(),
        day: today,
        salesCount: sum.salesCount,
        totalUSD: sum.totalUSD,
        totalFC: sum.totalFC,
        byMethod: sum.byMethod,
        expectedCashFC: expected,
        countedCashFC: isNaN(counted) ? null : counted,
        cashDiffFC: diff,
        closedBy: S.getServerName() || 'gérant'
      }).then(function () {
        MUBASE.Security.log('CLOTURE_Z', today + ' | ' + sum.salesCount +
          ' ventes | ' + sum.totalUSD + ' $ | attendu ' + expected +
          ' FC | compté ' + (isNaN(counted) ? '?' : counted) + ' FC');
        sum.expectedCashFC = expected;
        sum.countedCashFC = isNaN(counted) ? null : counted;
        sum.cashDiffFC = diff;
        return sum;
      });
    });
  };

  MUBASE.Settings = S;
})();
