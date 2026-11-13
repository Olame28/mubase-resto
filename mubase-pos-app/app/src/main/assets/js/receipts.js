/* MUBASE POS - Reçus 80 mm (aperçu + impression via window.print) */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;

  var R = {};

  var RESTO = {
    name: 'MUBASE',
    subtitle: 'COFFEE, RESTAURANT & PATISSERIE',
    address: 'Goma, Himbi 2 - Av. Felix Tshisekedi n82',
    phones: ['+243 825 451 103', '+243 979 373 663']
  };

  R.RESTO = RESTO;

  // Génère le HTML du reçu (utilisé pour l'aperçu et l'impression navigateur)
  R.buildReceiptHTML = function (sale) {
    var h = [];
    h.push('<div class="receipt-print">');
    h.push('<div class="r-center r-bold r-big">' + U.esc(RESTO.name) + '</div>');
    h.push('<div class="r-center r-bold">' + U.esc(RESTO.subtitle) + '</div>');
    h.push('<div class="r-center">' + U.esc(RESTO.address) + '</div>');
    h.push('<div class="r-center">' + RESTO.phones.join(' | ') + '</div>');
    h.push('<div class="r-space"></div>');
    h.push('<table>');
    h.push('<tr><td>Reçu N°</td><td class="r-right r-bold">' + U.esc(sale.receiptNo) + '</td></tr>');
    h.push('<tr><td>Date</td><td class="r-right">' + U.esc(U.fmtDateTime(sale.date)) + '</td></tr>');
    h.push('</table>');
    h.push('<div class="r-space"></div>');

    h.push('<table class="r-items">');
    h.push('<tr><th>Qté</th><th>Désignation</th><th class="r-right">P.U.</th><th class="r-right">Total</th></tr>');
    for (var i = 0; i < sale.items.length; i++) {
      var it = sale.items[i];
      var lineTotalUSD = Math.round(it.qty * it.unitUSD * 100) / 100;
      var label = it.name;
      if (it.note) label += ' (' + it.note + ')';
      if (it.free) label += ' [inclus]';
      h.push('<tr>');
      h.push('<td class="r-nowrap">' + U.esc(it.qty) + '</td>');
      h.push('<td>' + U.esc(label) + '</td>');
      h.push('<td class="r-right r-nowrap">' + U.esc(U.fmtUSD(it.unitUSD)) + '</td>');
      h.push('<td class="r-right r-nowrap">' + U.esc(U.fmtUSD(lineTotalUSD)) + '</td>');
      h.push('</tr>');
    }
    h.push('</table>');
    h.push('<div class="r-space"></div>');
    h.push('<table>');
    if (sale.discountFC > 0) {
      h.push('<tr><td>Remise</td><td class="r-right">-' + U.esc(U.fmtFC(sale.discountFC)) +
        ' (-' + U.esc(U.fmtUSD(sale.discountUSD || 0)) + ')</td></tr>');
    }
    h.push('</table>');
    h.push('<div class="r-total-box">');
    h.push('<div class="r-center r-bold">TOTAL À PAYER</div>');
    h.push('<div class="r-center r-bold r-big">' + U.esc(U.fmtFC(sale.totalFC)) + '</div>');
    h.push('<div class="r-center">(' + U.esc(U.fmtUSD(sale.totalUSD)) + ' US)</div>');
    h.push('</div>');
    h.push('<div class="r-center">Taux : 1 $ = ' +
      U.esc(U.fmtFC(sale.rate).replace(' FC', '')) + ' FC</div>');
    h.push('<div class="r-space"></div>');

    var p = sale.payment || {};
    var methodLabel = { USD: 'USD', FC: 'Francs FC', MIXED: 'Mixte USD+FC' }[p.method] || p.method;
    h.push('<table>');
    h.push('<tr><td>Paiement</td><td class="r-right">' + U.esc(methodLabel) + '</td></tr>');
    if (p.usdReceived) {
      h.push('<tr><td>Reçu USD</td><td class="r-right">' + U.esc(U.fmtUSD(p.usdReceived)) + '</td></tr>');
    }
    if (p.fcReceived) {
      h.push('<tr><td>Reçu FC</td><td class="r-right">' + U.esc(U.fmtFC(p.fcReceived)) + '</td></tr>');
    }
    if (p.usdChange > 0) {
      h.push('<tr><td>Monnaie USD</td><td class="r-right">' + U.esc(U.fmtUSD(p.usdChange)) + '</td></tr>');
    }
    if (p.fcChange > 0) {
      h.push('<tr><td>Monnaie FC</td><td class="r-right">' + U.esc(U.fmtFC(p.fcChange)) + '</td></tr>');
    }
    if (!p.usdChange && !p.fcChange) {
      h.push('<tr><td>Monnaie</td><td class="r-right">aucune</td></tr>');
    }
    h.push('</table>');
    h.push('<div class="r-space"></div>');
    h.push('<div class="r-center">Merci de votre visite !</div>');
    if (sale.status === 'cancelled') {
      h.push('<div class="r-center r-bold">*** VENTE ANNULÉE ***</div>');
    }
    h.push('</div>');
    return h.join('\n');
  };

  // Reçu client minimaliste 80mm (48 colonnes) — texte brut, sans bordures.
  // Sections : identité / n° et date / articles en colonnes / TOTAL À PAYER /
  // paiement / merci. Pas de serveur, table ni référence cuisine (usage interne).
  R.buildReceiptText = function (sale) {
    var W = 48;
    var ESC = '';
    // ESC/POS : Font A, double hauteur+largeur, gras, double frappe
    function fontA() { return ESC + 'M' + String.fromCharCode(0); }
    function dbl(t) { return ESC + '!' + String.fromCharCode(0x30) + t + ESC + '!' + String.fromCharCode(0); }
    function fat(t) { return ESC + 'G' + t + ESC + 'H'; }          // double frappe = plus gras
    function bld(t) { return ESC + 'E' + String.fromCharCode(1) + t + ESC + 'E' + String.fromCharCode(0); }
    function pe(t, w) { t = String(t); while (t.length < w) t += ' '; return t; }
    function ps(t, w) { t = String(t); while (t.length < w) t = ' ' + t; return t; }
    function ctr(t) {
      t = String(t);
      if (t.length > W) t = t.substring(0, W);
      return pe('', Math.floor((W - t.length) / 2)) + t;
    }
    // Texte tres grand et tres gras, centre (double frappe + double taille)
    function hero(t) {
      var pad = Math.max(0, Math.floor((W - String(t).length * 2) / 2));
      return pe('', pad) + fat(dbl(t));
    }
    function row2(l, r) { return pe(l, W - String(r).length) + r; }
    function sep() { return new Array(W + 1).join('-'); }
    function wrapWords(text, width) {
      var words = String(text).split(' '), lines = [], cur = '';
      words.forEach(function (wd) {
        if ((cur + ' ' + wd).trim().length > width) {
          if (cur) lines.push(cur);
          cur = wd;
        } else {
          cur = (cur ? cur + ' ' : '') + wd;
        }
      });
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    }
    // Ligne article : Qté(3) + Désignation(22) + P.U.(10) + Total(10) = 48
    var QW = 3, DW = 22, PW = 10, TW = 10;
    function itemRow(qty, name, pu, tot) {
      return pe(qty, QW) + ' ' + pe(name, DW) + ' ' + ps(pu, PW) + ' ' + ps(tot, TW);
    }

    var L = [];
    // 1. Identité — titre MUBASE très grand et très gras
    L.push(fontA() + hero('MUBASE'));
    L.push(bld(ctr('COFFEE, RESTAURANT & PATISSERIE')));
    L.push(ctr('Goma, Himbi 2'));
    L.push(ctr('Av. Felix Tshisekedi n82'));
    L.push(ctr('+243 825 451 103'));
    L.push(ctr('+243 979 373 663'));
    L.push(sep());
    // 2. Informations du reçu
    L.push(ctr('REÇU N° ' + sale.receiptNo));
    L.push(ctr(U.fmtDateTime(sale.date)));
    L.push(sep());
    // 3. Articles
    L.push(pe('Qté', QW) + ' ' + pe('Désignation', DW) + ' ' + ps('P.U.', PW) + ' ' + ps('Total', TW));
    L.push(sep());
    sale.items.forEach(function (it) {
      var tu = Math.round(it.qty * it.unitUSD * 100) / 100;
      var name = it.name + (it.note ? ' (' + it.note + ')' : '') + (it.free ? ' [inclus]' : '');
      var lines = wrapWords(name, DW);
      L.push(itemRow(it.qty, lines[0], U.fmtUSD(it.unitUSD), U.fmtUSD(tu)));
      for (var i = 1; i < lines.length; i++) {
        L.push(pe('', QW) + ' ' + pe(lines[i], DW) + ' ' + ps('', PW) + ' ' + ps('', TW));
      }
      L.push('');
    });
    L.push(sep());
    // 4. Total à payer — harmonisé : libellé gras + montant très grand et gras
    if (sale.discountFC > 0) {
      L.push(row2('Remise', '-' + U.fmtFC(sale.discountFC) + ' (-' + U.fmtUSD(sale.discountUSD || 0) + ')'));
    }
    L.push('');
    L.push(bld(ctr('TOTAL À PAYER')));
    L.push(hero(U.fmtFC(sale.totalFC)));
    L.push('');
    L.push(ctr('(' + U.fmtUSD(sale.totalUSD) + ' US)'));
    L.push(ctr('Taux : 1 $ = ' + Math.round(sale.rate) + ' FC'));
    L.push(sep());
    // 5. Paiement
    var p = sale.payment || {};
    var ml = { USD: 'USD', FC: 'Francs FC', MIXED: 'Mixte USD+FC' }[p.method] || p.method;
    L.push(row2('Paiement', ml));
    if (p.usdReceived) L.push(row2('  Reçu USD', U.fmtUSD(p.usdReceived)));
    if (p.fcReceived) L.push(row2('  Reçu FC', U.fmtFC(p.fcReceived)));
    if (p.usdChange > 0) L.push(row2('  Monnaie USD', U.fmtUSD(p.usdChange)));
    if (p.fcChange > 0) L.push(row2('  Monnaie FC', U.fmtFC(p.fcChange)));
    if (!p.usdChange && !p.fcChange) L.push(row2('  Monnaie', 'aucune'));
    L.push(sep());
    // 6. Pied de page
    L.push('');
    L.push(bld(ctr('Merci de votre visite, revenez demain !')));
    if (sale.status === 'cancelled') {
      L.push(ctr('*** VENTE ANNULEE ***'));
    }
    L.push('');
    return L.join('\n');
  };

  /* ================= Menu / tarif ================= */

  // Ticket "menu" : la carte complète avec prix, groupée par catégorie.
  // Utilisable pour imprimer le tarif client ou la carte cuisine.
  R.buildMenuText = function (products) {
    var prods = (products || []).filter(function (p) { return p.active !== false; });
    var byCat = {};
    var order = MUBASE.Products.CATEGORIES.slice();
    prods.forEach(function (p) {
      var cat = p.category || 'Autres';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(p);
    });
    function priceOf(p) {
      if (p.free) return 'INCLUS';
      var pr = MUBASE.Currency.productPrices(p);
      return U.fmtUSD(pr.usd);
    }
    var L = [];
    L.push(TICKET_SEP);
    L.push(tLine(tCenter('MUBASE Coffee & Restaurant')));
    L.push(tLine(tCenter('*** NOTRE MENU ***')));
    L.push(tLine(tCenter('Goma, Himbi 2')));
    L.push(tLine(tCenter('+243 825 451 103 / +243 979 373 663')));
    L.push(TICKET_DASH);
    order.forEach(function (cat) {
      var list = byCat[cat];
      if (!list || !list.length) return;
      L.push(tLine(tCenter(cat.toUpperCase())));
      L.push(TICKET_DASH);
      list.forEach(function (p) {
        var name = p.name;
        var price = priceOf(p);
        // nom long : on coupe proprement
        if (name.length > TICKET_W - price.length - 2) {
          L.push(tLine(name.substring(0, TICKET_W)));
          L.push(tLine(tRow('', price)));
        } else {
          L.push(tLine(tRow(name, price)));
        }
      });
      L.push('');
    });
    // Catégories éventuelles non listées
    Object.keys(byCat).forEach(function (cat) {
      if (order.indexOf(cat) !== -1) return;
      L.push(tLine(tCenter(cat.toUpperCase())));
      byCat[cat].forEach(function (p) {
        var name = p.name, price = priceOf(p);
        L.push(tLine(name.length > TICKET_W - price.length - 2 ?
          name.substring(0, TICKET_W) : tRow(name, price)));
        if (name.length > TICKET_W - price.length - 2) {
          L.push(tLine(tRow('', price)));
        }
      });
      L.push('');
    });
    L.push(TICKET_DASH);
    L.push(tLine(tCenter('Taux indicatif : 1 $ = ' + Math.round(MUBASE.Currency.getRate()) + ' FC')));
    L.push(tLine(tCenter('Prix susceptibles de changer')));
    L.push(TICKET_BOT);
    L.push(tBlank());
    L.push(tBlank());
    return L.join('\n');
  };

  // Aperçu HTML du menu (secours sans imprimante directe)
  R.buildMenuHTML = function (products) {
    var prods = (products || []).filter(function (p) { return p.active !== false; });
    var byCat = {};
    MUBASE.Products.CATEGORIES.forEach(function (c) { byCat[c] = []; });
    byCat['Autres'] = [];
    prods.forEach(function (p) { (byCat[p.category] || byCat['Autres']).push(p); });
    var h = [];
    h.push('<div class="receipt-print">');
    h.push('<div class="r-center r-bold r-big">MUBASE Coffee &amp; Restaurant</div>');
    h.push('<div class="r-center r-bold">*** NOTRE MENU ***</div>');
    h.push('<div class="r-center">' + U.esc(RESTO.address) + '</div>');
    h.push('<div class="r-center">' + RESTO.phones.join(' / ') + '</div>');
    h.push('<div class="r-line"></div>');
    MUBASE.Products.CATEGORIES.forEach(function (cat) {
      var list = byCat[cat];
      if (!list.length) return;
      h.push('<div class="r-center r-bold">' + U.esc(cat.toUpperCase()) + '</div>');
      list.forEach(function (p) {
        var price = p.free ? 'INCLUS' : U.fmtUSD(MUBASE.Currency.productPrices(p).usd);
        h.push('<div>' + U.esc(p.name) + '</div>');
        h.push('<div class="r-right">' + U.esc(price) + '</div>');
      });
      h.push('<div class="r-line"></div>');
    });
    h.push('<div class="r-center">Prix susceptibles de changer</div>');
    h.push('</div>');
    return h.join('\n');
  };

  // Imprime le menu : direct si possible, sinon aperçu
  R.printMenu = function (products, cb) {
    var text = R.buildMenuText(products);
    R.printDirect(text, function (ok) {
      if (!ok) {
        document.getElementById('printArea').innerHTML = R.buildMenuHTML(products);
        U.toast('Imprimante directe indisponible : aperçu d\'impression ouvert.', 'error');
        setTimeout(function () { window.print(); }, 100);
      } else {
        U.toast('Menu imprimé.', 'ok');
      }
      if (cb) cb(ok);
    });
  };

  // Affiche l'aperçu dans la modale
  R.showReceipt = function (sale) {
    R._lastSale = sale;
    document.getElementById('receiptContainer').innerHTML = R.buildReceiptHTML(sale);
    document.getElementById('receiptModal').classList.remove('hidden');
  };

  // Ticket texte avec cadre propre : bordures '*', séparateurs '-'.
  // Papier 80mm = 48 caracteres par ligne.
  // Contenu utile = 44 car. + 1 marge de chaque cote = 46 + 2 bordures = 48.
  var TICKET_W = 44;
  var TICKET_SEP = '************************************************';
  var TICKET_DASH = '*----------------------------------------------*';
  var TICKET_BOT = '************************************************';

  function tPadEnd(t, w) {
    t = String(t);
    while (t.length < w) t += ' ';
    return t;
  }
  function tCenter(t) {
    t = String(t);
    if (t.length > TICKET_W) t = t.substring(0, TICKET_W);
    var pad = Math.max(0, Math.floor((TICKET_W - t.length) / 2));
    return new Array(pad + 1).join(' ') + t;
  }
  function tRow(l, r) {
    l = String(l); r = String(r);
    var space = TICKET_W - l.length - r.length;
    if (space < 1) space = 1;
    return l + new Array(space).join(' ') + r;
  }
  // Ligne encadrée : '*' + marge + contenu(36) + marge + '*'
  function tLine(content) {
    content = String(content);
    if (content.length > TICKET_W) content = content.substring(0, TICKET_W);
    return '*' + ' ' + tPadEnd(content, TICKET_W) + ' ' + '*';
  }
  // Ligne vide à l'intérieur du cadre
  function tBlank() { return '*' + new Array(TICKET_W + 3).join(' ') + '*'; }

  // ================= Bon de cuisine =================

  // Génère le texte du bon de cuisine (envoyé à l'imprimante thermique
  // via l'app compagnon, ou affiché en aperçu). Pas de prix : cuisine only.
  R.buildKitchenTicketText = function (items, tableName, ticketNo) {
    var L = [];
    L.push(TICKET_SEP);
    L.push(tLine(tCenter('MUBASE Coffee & Restaurant')));
    L.push(tLine(tCenter('*** BON DE COMMANDE ***')));
    L.push(tLine(tCenter(ticketNo || '')));
    L.push(tLine(tCenter('Goma, Himbi 2')));
    L.push(tLine(tCenter('Av. Felix Tshisekedi n82')));
    L.push(tLine(tCenter('+243 825 451 103 / +243 979 373 663')));
    L.push(TICKET_DASH);
    L.push(tLine('Table : ' + (tableName || '-')));
    L.push(tLine('Date  : ' + U.fmtDateTime(new Date())));
    L.push(TICKET_DASH);
    items.forEach(function (it) {
      var label = it.qty + 'x ' + it.name;
      if (label.length > TICKET_W) label = label.substring(0, TICKET_W);
      L.push(tLine(label));
      if (it.note) {
        var n = '> ' + it.note;
        if (n.length > TICKET_W) n = n.substring(0, TICKET_W);
        L.push(tLine('   ' + n));
      }
    });
    L.push(TICKET_BOT);
    L.push(tBlank());
    L.push(tBlank());
    return L.join('\n');
  };

  // Génère le HTML d'aperçu du bon de cuisine (secours si pas d'imprimante)
  R.buildKitchenTicketHTML = function (items, tableName) {
    var h = [];
    h.push('<div class="receipt-print">');
    h.push('<div class="r-center r-bold r-big">' + U.esc(RESTO.name) + '</div>');
    h.push('<div class="r-center r-bold">*** BON DE COMMANDE ***</div>');
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

  /* ---------- Numérotation des bons de cuisine (traçabilité) ----------
   * Format : KC-AAAAMMJJ-NNNN — imprimé sur le bon cuisine ET sur le reçu
   * final : on peut toujours rapprocher une commande cuisine d'une vente.
   */
  R.nextKitchenNo = function () {
    var dateKey = 'kitchen_counter_' + U.todayStr();
    var counter = parseInt(MUBASE.DB.getSettingSync(dateKey) || '0', 10) + 1;
    MUBASE.DB.setSetting(dateKey, String(counter));
    var d = new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    var ymd = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
    var num = ('0000' + counter).slice(-4);
    return 'KC-' + ymd + '-' + num;
  };

  R.printDirect = function (text, cb) {
    var done = false;
    function finish(ok) {
      if (!done) { done = true; if (cb) cb(ok); }
    }
    // Pont natif (APK Android) : impression thermique directe, synchrone
    try {
      if (window.MUBASEPrint && typeof window.MUBASEPrint.printTicket === 'function') {
        var okNative = window.MUBASEPrint.printTicket(text);
        finish(!!okNative);
        return;
      }
    } catch (e) {
      finish(false);
      return;
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
  R.sendToKitchen = function (items, tableName, ticketNo, onPrinted) {
    var text = R.buildKitchenTicketText(items, tableName, ticketNo);
    R.printDirect(text, function (ok) {
      if (ok) {
        U.toast('Bon de commande imprimé.', 'ok');
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
