/* MUBASE POS - Encaissements, conversions, numérotation des reçus */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;
  var C = window.MUBASE.Currency;

  var P = {};

  P.processing = false; // verrou anti double paiement

  /* ---------- Numérotation des reçus ----------
   * Format : MUB-AAAAMMJJ-XXXX (compteur journalier dans les settings)
   */
  P.nextReceiptNo = function () {
    var dateKey = 'receipt_counter_' + U.todayStr();
    var counter = parseInt(MUBASE.DB.getSettingSync(dateKey) || '0', 10) + 1;
    MUBASE.DB.setSetting(dateKey, String(counter));
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    var ymd = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
    var num = ('0000' + counter).slice(-4);
    return 'MUB-' + ymd + '-' + num;
  };

  /* ---------- Calcul de la monnaie ----------
   * sale : {totalUSD, totalFC}, payment : saisies utilisateur
   * Retourne { ok, error, payment } avec payment complet.
   */
  P.computePayment = function (sale, input) {
    var rate = C.getRate();
    var tUSD = Number(sale.totalUSD) || 0;
    var tFC = Number(sale.totalFC) || 0;
    var method = input.method;
    var pay = {
      method: method,
      rate: rate,
      usdReceived: 0,
      fcReceived: 0,
      usdChange: 0,
      fcChange: 0,
      discountFC: 0
    };

    // Remise optionnelle en FC (déjà arrondie)
    if (input.discountFC) {
      var d = C.roundFC(parseFloat(input.discountFC) || 0);
      if (d < 0) d = 0;
      if (d > tFC) d = tFC;
      pay.discountFC = d;
      pay.discountUSD = C.fcToUSD(d);
      tFC -= d;
      tUSD = Math.round((tUSD - pay.discountUSD) * 100) / 100;
    }

    if (method === 'USD') {
      var usd = parseFloat(input.usdReceived);
      if (isNaN(usd) || usd < 0) return { ok: false, error: 'Montant USD invalide.' };
      if (usd + 0.004 < tUSD) {
        return { ok: false, error: 'Montant insuffisant : il manque ' + U.fmtUSD(tUSD - usd) + '.' };
      }
      pay.usdReceived = usd;
      pay.usdChange = Math.round((usd - tUSD) * 100) / 100;
      pay.fcChange = C.roundFC(pay.usdChange * rate);
    } else if (method === 'FC') {
      var fc = parseInt(input.fcReceived, 10);
      if (isNaN(fc) || fc < 0) return { ok: false, error: 'Montant FC invalide.' };
      if (fc < tFC) {
        return { ok: false, error: 'Montant insuffisant : il manque ' + U.fmtFC(tFC - fc) + '.' };
      }
      pay.fcReceived = fc;
      pay.fcChange = fc - tFC;
      pay.usdChange = C.fcToUSD(pay.fcChange);
    } else if (method === 'MIXED') {
      var mu = parseFloat(input.usdReceived) || 0;
      var mf = parseInt(input.fcReceived, 10) || 0;
      if (mu < 0 || mf < 0) return { ok: false, error: 'Montants invalides.' };
      // Équivalent FC total payé
      var paidFCeq = C.roundFC(mu * rate) + mf;
      if (paidFCeq < tFC) {
        return { ok: false, error: 'Montant total insuffisant.' };
      }
      pay.usdReceived = mu;
      pay.fcReceived = mf;
      pay.fcChange = paidFCeq - tFC;
      pay.usdChange = C.fcToUSD(pay.fcChange);
      // Si la partie USD dépasse le total USD, on bascule l'excédent en FC
      // (déjà couvert par le calcul FC équivalent ci-dessus).
    } else {
      return { ok: false, error: 'Mode de paiement inconnu.' };
    }
    pay.totalUSD = tUSD;
    pay.totalFC = tFC;
    return { ok: true, payment: pay };
  };

  /* ---------- Encaissement ----------
   * Construit la vente et l'enregistre UNE SEULE FOIS.
   * Retourne Promise<{sale} | {error}>.
   */
  P.checkout = function (payment) {
    if (P.processing) {
      return Promise.resolve({ error: 'Encaissement déjà en cours.' });
    }
    P.processing = true;

    var receiptNo = P.nextReceiptNo();
    var draft = MUBASE.Orders.buildSale(receiptNo, payment);
    draft.discountUSD = payment.discountUSD || 0;
    draft.discountFC = payment.discountFC || 0;
    draft.totalUSD = payment.totalUSD;
    draft.totalFC = payment.totalFC;
    draft.status = 'paid';

    // Anti double paiement : vérifier qu'aucune vente n'a ce numéro
    return MUBASE.DB.getSaleByReceipt(receiptNo).then(function (existing) {
      if (existing) {
        throw new Error('Reçu ' + receiptNo + ' existe déjà.');
      }
      return MUBASE.DB.addSale(draft);
    }).then(function () {
      MUBASE.Security.log('VENTE', receiptNo + ' | ' + draft.tableName + ' | ' +
        U.fmtUSD(draft.totalUSD) + ' | ' + payment.method);
      return draft;
    }).catch(function (err) {
      return { error: err.message || 'Erreur d\'enregistrement.' };
    }).then(function (result) {
      P.processing = false;
      if (result && result.error) return result;
      // Vente confirmée : on vide le panier (même si le nettoyage échoue,
      // la vente est déjà enregistrée et ne doit pas être rejouée)
      return MUBASE.Orders.clearCart().catch(function () {}).then(function () {
        return result;
      });
    });
  };

  /* ---------- Annulation d'une vente (PIN gérant requis, journalisée) ---------- */
  P.cancelSale = function (saleId, reason) {
    return MUBASE.DB.getAll('sales').then(function (sales) {
      for (var i = 0; i < sales.length; i++) {
        if (String(sales[i].id) === String(saleId)) {
          sales[i].status = 'cancelled';
          sales[i].cancelledAt = new Date().toISOString();
          sales[i].cancelReason = reason || '';
          return MUBASE.DB.updateSale(sales[i]).then(function () {
            MUBASE.Security.log('ANNULATION', 'Reçu ' + sales[i].receiptNo +
              ' | ' + (reason || 'sans motif'));
            return true;
          });
        }
      }
      return false;
    });
  };

  MUBASE.Payments = P;
})();
