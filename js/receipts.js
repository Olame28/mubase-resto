/* MUBASE POS - Reçus 80 mm (aperçu + impression via window.print) */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;

  var R = {};

  var RESTO = {
    name: 'MUBASE Coffee et Restaurant',
    address: 'Goma, Himbi 2 - Avenue Félix Tshisekedi n°82 - Église Bon Berger',
    phones: ['+243 825 451 103', '+243 979 373 663']
  };

  R.RESTO = RESTO;

  // Génère le HTML du reçu (utilisé pour l'aperçu et l'impression)
  R.buildReceiptHTML = function (sale) {
    var h = [];
    h.push('<div class="receipt-print">');
    h.push('<div class="r-center r-bold r-big">' + U.esc(RESTO.name) + '</div>');
    h.push('<div class="r-center">' + U.esc(RESTO.address) + '</div>');
    h.push('<div class="r-center">' + RESTO.phones.join(' | ') + '</div>');
    h.push('<div class="r-line"></div>');
    h.push('<table>');
    h.push('<tr><td>Reçu N°</td><td class="r-right r-bold">' + U.esc(sale.receiptNo) + '</td></tr>');
    h.push('<tr><td>Date</td><td class="r-right">' + U.esc(U.fmtDateTime(sale.date)) + '</td></tr>');
    h.push('<tr><td>Table</td><td class="r-right">' + U.esc(sale.tableName || '-') + '</td></tr>');
    h.push('<tr><td>Serveur</td><td class="r-right">' + U.esc(sale.server || '-') + '</td></tr>');
    h.push('</table>');
    h.push('<div class="r-line"></div>');

    h.push('<table>');
    for (var i = 0; i < sale.items.length; i++) {
      var it = sale.items[i];
      var lineTotalUSD = Math.round(it.qty * it.unitUSD * 100) / 100;
      var lineTotalFC = it.unitFC * it.qty;
      var label = it.qty + 'x ' + it.name;
      if (it.note) label += ' (' + it.note + ')';
      if (it.free) label += ' [INCLUS]';
      h.push('<tr><td colspan="3">' + U.esc(label) + '</td></tr>');
      h.push('<tr>');
      h.push('<td></td>');
      h.push('<td class="r-right">' + U.esc(U.fmtUSD(it.unitUSD)) + '</td>');
      h.push('<td class="r-right">' + U.esc(U.fmtFC(it.unitFC)) + '</td>');
      h.push('</tr>');
      h.push('<tr>');
      h.push('<td></td>');
      h.push('<td class="r-right">Total</td>');
      h.push('<td class="r-right">' + U.esc(U.fmtUSD(lineTotalUSD)) + ' / ' +
        U.esc(U.fmtFC(lineTotalFC)) + '</td>');
      h.push('</tr>');
    }
    h.push('</table>');
    h.push('<div class="r-line"></div>');
    h.push('<table>');
    if (sale.discountFC > 0) {
      h.push('<tr><td>Remise</td><td class="r-right">-' + U.esc(U.fmtFC(sale.discountFC)) +
        ' / -' + U.esc(U.fmtUSD(sale.discountUSD || 0)) + '</td></tr>');
    }
    h.push('<tr><td class="r-bold r-big">TOTAL</td><td class="r-right r-bold r-big">' +
      U.esc(U.fmtUSD(sale.totalUSD)) + '</td></tr>');
    h.push('<tr><td class="r-bold r-big">TOTAL</td><td class="r-right r-bold r-big">' +
      U.esc(U.fmtFC(sale.totalFC)) + '</td></tr>');
    h.push('<tr><td>Taux appliqué</td><td class="r-right">1 $ = ' +
      U.esc(U.fmtFC(sale.rate).replace(' FC', '')) + ' FC</td></tr>');
    h.push('</table>');
    h.push('<div class="r-line"></div>');

    var p = sale.payment || {};
    var methodLabel = { USD: 'USD', FC: 'FC (Francs)', MIXED: 'Mixte USD + FC' }[p.method] || p.method;
    h.push('<table>');
    h.push('<tr><td>Paiement</td><td class="r-right">' + U.esc(methodLabel) + '</td></tr>');
    if (p.method === 'USD' || p.method === 'MIXED') {
      h.push('<tr><td>Reçu USD</td><td class="r-right">' + U.esc(U.fmtUSD(p.usdReceived || 0)) + '</td></tr>');
    }
    if (p.method === 'FC' || p.method === 'MIXED') {
      h.push('<tr><td>Reçu FC</td><td class="r-right">' + U.esc(U.fmtFC(p.fcReceived || 0)) + '</td></tr>');
    }
    h.push('<tr><td>Monnaie USD</td><td class="r-right">' + U.esc(U.fmtUSD(p.usdChange || 0)) + '</td></tr>');
    h.push('<tr><td>Monnaie FC</td><td class="r-right">' + U.esc(U.fmtFC(p.fcChange || 0)) + '</td></tr>');
    h.push('</table>');
    h.push('<div class="r-line"></div>');
    h.push('<div class="r-center">Merci de votre visite !</div>');
    h.push('<div class="r-center">' + U.esc(RESTO.name) + '</div>');
    if (sale.status === 'cancelled') {
      h.push('<div class="r-center r-bold">*** VENTE ANNULÉE ***</div>');
    }
    h.push('</div>');
    return h.join('\n');
  };

  // Affiche l'aperçu dans la modale
  R.showReceipt = function (sale) {
    document.getElementById('receiptContainer').innerHTML = R.buildReceiptHTML(sale);
    document.getElementById('receiptModal').classList.remove('hidden');
  };

  // Imprime le dernier reçu affiché via window.print()
  R.printLast = function () {
    var container = document.getElementById('receiptContainer');
    if (!container || !container.innerHTML) {
      U.toast('Aucun reçu à imprimer.', 'error');
      return;
    }
    var area = document.getElementById('printArea');
    area.innerHTML = container.innerHTML;
    // Petit délai pour laisser le DOM se mettre à jour
    setTimeout(function () {
      window.print();
    }, 100);
  };

  // Test d'impression : génère un reçu factice
  R.printTest = function () {
    var fake = {
      receiptNo: 'TEST-0000',
      date: new Date().toISOString(),
      tableName: 'Comptoir',
      server: 'TEST',
      rate: MUBASE.Currency.getRate(),
      items: [
        { name: 'Test impression 80mm', qty: 1, unitUSD: 1, unitFC: MUBASE.Currency.usdToFC(1) },
        { name: 'Ligne de test 2', qty: 2, unitUSD: 0.5, unitFC: MUBASE.Currency.usdToFC(0.5) }
      ],
      totalUSD: 2,
      totalFC: MUBASE.Currency.usdToFC(2),
      discountFC: 0,
      payment: { method: 'FC', fcReceived: MUBASE.Currency.usdToFC(2) + 1000, fcChange: 1000, usdReceived: 0, usdChange: 0 }
    };
    R.showReceipt(fake);
    setTimeout(R.printLast, 300);
  };

  // Réimpression d'une vente passée
  R.reprintSale = function (sale) {
    R.showReceipt(sale);
    setTimeout(R.printLast, 300);
  };

  MUBASE.Receipts = R;
})();
