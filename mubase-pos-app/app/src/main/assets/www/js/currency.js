/* MUBASE POS - Devises et conversions (taux, arrondis centralisés) */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;

  var C = {};

  // Taux par défaut : 1 USD = 2800 FC
  C.DEFAULT_RATE = 2800;
  C.DEFAULT_ROUNDING = 100;

  C.getSettings = function () {
    return MUBASE.DB.getSettingSync('settings') || {};
  };

  C.getRate = function () {
    var s = C.getSettings();
    var r = parseFloat(s.rate);
    return (isFinite(r) && r > 0) ? r : C.DEFAULT_RATE;
  };

  C.getRounding = function () {
    var s = C.getSettings();
    var r = parseInt(s.rounding, 10);
    return (r === 100 || r === 500 || r === 1) ? r : C.DEFAULT_ROUNDING;
  };

  // Arrondit un montant FC selon le réglage du gérant.
  C.roundFC = function (n) {
    var step = C.getRounding();
    if (step <= 1) return Math.round(n);
    return Math.round(n / step) * step;
  };

  // Conversion USD -> FC (arrondi selon réglage)
  C.usdToFC = function (usd) {
    return C.roundFC((Number(usd) || 0) * C.getRate());
  };

  // Conversion FC -> USD (2 décimales)
  C.fcToUSD = function (fc) {
    return Math.round(((Number(fc) || 0) / C.getRate()) * 100) / 100;
  };

  // Prix d'un produit dans les deux devises.
  // product.priceUSD / product.priceFC : un seul des deux est défini
  // (les produits à prix fixe FC gardent leur prix FC).
  // Retourne { usd, fc } en nombres.
  C.productPrices = function (product) {
    var usd = parseFloat(product.priceUSD);
    var fc = parseInt(product.priceFC, 10);
    var hasUSD = isFinite(usd) && product.priceUSD !== '' && product.priceUSD != null;
    var hasFC = isFinite(fc) && product.priceFC !== '' && product.priceFC != null;

    if (hasUSD && hasFC) {
      return { usd: usd, fc: fc };
    }
    if (hasUSD) {
      return { usd: usd, fc: C.usdToFC(usd) };
    }
    if (hasFC) {
      return { usd: C.fcToUSD(fc), fc: fc };
    }
    return { usd: 0, fc: 0 };
  };

  // Calcule le total d'une liste de lignes [{qty, unitUSD, unitFC}]
  C.totals = function (lines) {
    var usdCents = 0, fc = 0, i, l;
    for (i = 0; i < lines.length; i++) {
      l = lines[i];
      var q = Number(l.qty) || 0;
      usdCents += Math.round(((Number(l.unitUSD) || 0) * q) * 100);
      fc += (Number(l.unitFC) || 0) * q;
    }
    return {
      usd: Math.round(usdCents) / 100,
      fc: Math.round(fc)
    };
  };

  MUBASE.Currency = C;
})();
