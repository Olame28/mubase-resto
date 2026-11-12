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

  // Version ticket ESC/POS (stylée) du reçu pour l'imprimante thermique.
  R.buildReceiptText = function (sale) {
    var W = 40;
    var L = [];
    function c(t) { // centré
      t = String(t);
      var pad = Math.max(0, Math.floor((W - t.length) / 2));
      return new Array(pad + 1).join(' ') + t;
    }
    function row(l, r) {
      l = String(l); r = String(r);
      var space = W - l.length - r.length;
      if (space < 1) space = 1;
      return l + new Array(space + 1).join(' ') + r;
    }
    // En-tête restaurant
    L.push(CMD.center + CMD.dblOn + CMD.boldOn + 'MUBASE');
    L.push(CMD.dblOff + CMD.boldOff + 'Coffee & Restaurant');
    L.push(CMD.left);
    L.push(c(RESTO.address));
    L.push(c(RESTO.phones.join(' / ')));
    L.push(CMD.sep);
    // Infos vente
    L.push(CMD.center + CMD.boldOn);
    L.push('RECU N° ' + sale.receiptNo);
    L.push('Date   : ' + U.fmtDateTime(sale.date));
    L.push('Table  : ' + (sale.tableName || '-'));
    L.push('Serveur: ' + (sale.server || '-'));
    L.push(CMD.boldOff + CMD.left);
    L.push('----------------------------------------');
    // Articles
    sale.items.forEach(function (it) {
      var label = it.qty + 'x ' + it.name;
      if (it.note) label += '\n     > ' + it.note;
      if (it.free) label += ' [INCLUS]';
      L.push(CMD.boldOn + label + CMD.boldOff);
      var tu = Math.round(it.qty * it.unitUSD * 100) / 100;
      L.push(row('   ' + U.fmtUSD(it.unitUSD) + ' /u', U.fmtFC(it.unitFC) + ' /u'));
      L.push(row('   Total', U.fmtUSD(tu) + ' / ' + U.fmtFC(it.unitFC * it.qty)));
    });
    L.push('========================================');
    // Totaux
    if (sale.discountFC > 0) {
      L.push(row('Remise', '-' + U.fmtFC(sale.discountFC) +
        ' / -' + U.fmtUSD(sale.discountUSD || 0)));
    }
    L.push(CMD.boldOn);
    L.push(row('TOTAL USD', U.fmtUSD(sale.totalUSD)));
    L.push(row('TOTAL FC', U.fmtFC(sale.totalFC)));
    L.push(CMD.boldOff);
    L.push('Taux applique: 1 $ = ' + Math.round(sale.rate) + ' FC');
    L.push('----------------------------------------');
    // Paiement
    var p = sale.payment || {};
    var ml = { USD: 'USD', FC: 'Francs FC', MIXED: 'Mixte USD+FC' }[p.method] || p.method;
    L.push('Paiement : ' + ml);
    if (p.usdReceived) L.push(row('  Recu USD', U.fmtUSD(p.usdReceived)));
    if (p.fcReceived) L.push(row('  Recu FC', U.fmtFC(p.fcReceived)));
    L.push(row('  Monnaie USD', U.fmtUSD(p.usdChange || 0)));
    L.push(row('  Monnaie FC', U.fmtFC(p.fcChange || 0)));
    L.push('========================================');
    L.push(CMD.center + CMD.boldOn + 'Merci de votre visite !');
    if (sale.status === 'cancelled') {
      L.push(CMD.boldOn + '*** VENTE ANNULEE ***');
    }
    L.push('');
    L.push('');
    return L.join('\n');
  };

  // Affiche l'aperçu dans la modale
  R.showReceipt = function (sale) {
    R._lastSale = sale;
    document.getElementById('receiptContainer').innerHTML = R.buildReceiptHTML(sale);
    document.getElementById('receiptModal').classList.remove('hidden');
  };

  /* ================= Commandes ESC/POS =================
   * Le service Android les transmet telles quelles a l'imprimante.
   */
  var ESCc = String.fromCharCode(0x1B);
  var GSc = String.fromCharCode(0x1D);
  var CMD = {
    center: function () { return ESCc + 'a' + String.fromCharCode(1); },
    left: function () { return ESCc + 'a' + String.fromCharCode(0); },
    boldOn: function () { return ESCc + 'E' + String.fromCharCode(1); },
    boldOff: function () { return ESCc + 'E' + String.fromCharCode(0); },
    dblOn: function () { return GSc + '!' + String.fromCharCode(0x11); },
    dblOff: function () { return GSc + '!' + String.fromCharCode(0x00); },
    sep: '========================================\n'
  };

  // ================= Bon de cuisine =================

  // Génère le ticket cuisine stylé (ESC/POS) pour l'imprimante thermique.
  R.buildKitchenTicketText = function (items, tableName) {
    var L = [];
    L.push(CMD.center + CMD.dblOn + CMD.boldOn);
    L.push('BON DE CUISINE');
    L.push(CMD.dblOff + CMD.boldOff);
    L.push(RESTO.name);
    L.push('----------------------------------------');
    L.push(CMD.left + 'Table : ' + (tableName || '-') + '   Date : ' + U.fmtDateTime(new Date()));
    L.push('----------------------------------------');
    L.push(CMD.boldOn);
    items.forEach(function (it) {
      L.push(it.qty + 'x ' + it.name);
      L.push(CMD.boldOff);
      if (it.note) L.push('     > ' + it.note);
      if (it.qty > 1) L.push(CMD.boldOn); // réactive gras pour l'article suivant
    });
    L.push(CMD.boldOff);
    L.push('----------------------------------------');
    L.push('');
    L.push('');
    return L.join('\n');
  };

  // Génère le HTML d'aperçu du bon de cuisine (secours si pas d'imprimante)
  R.buildKitchenTicketHTML = function (items, tableName) {
    var h = [];
    h.push('<div class="receipt-print">');
    h.push('<div class="r-center r-bold r-big">' + U.esc(RESTO.name) + '</div>');
    h.push('<div class="r-center r-bold">*** BON DE CUISINE ***</div>');
    h.push('<div class="r-line"></div>');
    h.push('<table>');
    h.push('<tr><td>Table</td><td class="r-right">' + U.esc(tableName || '-') + '</td></tr>');
    h.push('<tr><td>Date</td><td class="r-right">' + U.esc(U.fmtDateTime(new Date())) + '</td></tr>');
    h.push('</table>');
    h.push('<div class="r-line"></div>');
    items.forEach(function (it) {
      h.push('<div class="r-bold">' + it.qty + 'x ' + U.esc(it.name) + '</div>');
      if (it.note) h.push('<div>     &gt; ' + U.esc(it.note) + '</div>');
    });
    h.push('<div class="r-line"></div>');
    h.push('</div>');
    return h.join('\n');
  };

  /* ================= Impression directe (app compagnon) =================
   * Tente d'envoyer le texte à l'app "MUBASE Print" sur 127.0.0.1:8090.
   * Retourne true si l'impression directe a réussi, false sinon
   * (l'appelant proposera alors l'aperçu window.print() en secours).
   */
  var PRINT_URL = 'http://127.0.0.1:8090/print';

  R.printDirect = function (text, cb) {
    var done = false;
    function finish(ok) {
      if (!done) { done = true; if (cb) cb(ok); }
    }
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', PRINT_URL, true);
      xhr.timeout = 2500;
      xhr.setRequestHeader('Content-Type', 'text/plain; charset=utf-8');
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          finish(xhr.status >= 200 && xhr.status < 300);
        }
      };
      xhr.ontimeout = function () { finish(false); };
      xhr.onerror = function () { finish(false); };
      xhr.send(text);
    } catch (e) {
      finish(false);
    }
    // Filet de sécurité si aucun événement ne revient
    setTimeout(function () { finish(false); }, 4000);
  };

  // Envoie un bon de cuisine : direct si possible, sinon aperçu Android
  R.sendToKitchen = function (items, tableName, onPrinted) {
    var text = R.buildKitchenTicketText(items, tableName);
    R.printDirect(text, function (ok) {
      if (ok) {
        U.toast('Bon de cuisine imprimé.', 'ok');
        if (onPrinted) onPrinted(true);
      } else {
        // Secours : aperçu d'impression Android
        document.getElementById('printArea').innerHTML = R.buildKitchenTicketHTML(items, tableName);
        U.toast('Imprimante directe indisponible : aperçu d\'impression ouvert.', 'error');
        setTimeout(function () { window.print(); }, 100);
        if (onPrinted) onPrinted(false);
      }
    });
  };

  // Imprime : tente d'abord l'impression directe (app compagnon),
  // sinon bascule sur l'aperçu window.print() classique.
  R.printLast = function () {
    var container = document.getElementById('receiptContainer');
    if (!container || !container.innerHTML) {
      U.toast('Aucun reçu à imprimer.', 'error');
      return;
    }
    if (R._lastSale) {
      var text = R.buildReceiptText(R._lastSale);
      R.printDirect(text, function (ok) {
        if (!ok) R.printLastFallback();
      });
      return;
    }
    R.printLastFallback();
  };

  R.printLastFallback = function () {
    var container = document.getElementById('receiptContainer');
    var area = document.getElementById('printArea');
    area.innerHTML = container.innerHTML;
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
    setTimeout(function () {
      var text = '========================================\n' +
        '     TEST IMPRESSION MUBASE POS\n' +
        '========================================\n' +
        'Si vous lisez ceci, l\'imprimante\n' +
        'thermique fonctionne !\n' +
        'Date: ' + U.fmtDateTime(new Date()) + '\n\n\n';
      R.printDirect(text, function (ok) {
        if (!ok) setTimeout(R.printLast, 300);
      });
    }, 300);
  };

  // Réimpression d'une vente passée
  R.reprintSale = function (sale) {
    R.showReceipt(sale);
    setTimeout(R.printLast, 300);
  };

  MUBASE.Receipts = R;
})();
