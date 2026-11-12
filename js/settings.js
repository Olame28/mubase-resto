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

  // Clôture Z : enregistre un résumé sans supprimer les ventes
  S.closeShift = function () {
    var today = window.MUBASE.Utils.todayStr();
    return MUBASE.Reports.buildShiftSummary(today, today).then(function (sum) {
      return MUBASE.DB.addShift({
        date: new Date().toISOString(),
        day: today,
        salesCount: sum.salesCount,
        totalUSD: sum.totalUSD,
        totalFC: sum.totalFC,
        byMethod: sum.byMethod,
        closedBy: S.getServerName() || 'gérant'
      }).then(function () {
        MUBASE.Security.log('CLOTURE_Z', today + ' | ' + sum.salesCount +
          ' ventes | ' + sum.totalUSD + ' $');
        return sum;
      });
    });
  };

  MUBASE.Settings = S;
})();
