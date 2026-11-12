/* MUBASE POS - Application principale : interface, parcours, sécurité */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;
  var O = window.MUBASE.Orders;
  var C = window.MUBASE.Currency;

  var APP_VERSION = '1.0.0';

  var state = {
    products: [],
    category: 'Tous',
    search: '',
    payMethod: null,
    lastSale: null,
    reportType: 'daily',
    settingsTab: 'general'
  };

  var App = {};

  /* ================= Initialisation ================= */

  App.init = function () {
    MUBASE.DB.init()
      .then(function () { return MUBASE.DB.loadSettingsCache(); })
      .then(function () {
        // Paramètres par défaut si absents
        var s = C.getSettings();
        if (s.rate == null) s.rate = C.DEFAULT_RATE;
        if (s.rounding == null) s.rounding = C.DEFAULT_ROUNDING;
        return MUBASE.DB.setSetting('settings', s);
      })
      .then(function () { return MUBASE.Products.seedIfEmpty(); })
      .then(function () { return MUBASE.DB.getProducts(); })
      .then(function (products) {
        state.products = products || [];
        // Table par défaut : comptoir si aucun panier, sinon première table occupée
        return MUBASE.DB.getAllCarts().then(function (carts) {
          if (carts && carts.length) {
            return O.loadCart(carts[0].tableId);
          }
          return O.loadCart('counter');
        });
      })
      .then(function () {
        App.renderCategories();
        App.renderProducts();
        App.refreshCartUI();
        App.refreshTablesUI();
        App.fillTableSelects();
        App.bindEvents();
        App.addCancelButton();
        App.registerSW();
        App.watchOnline();
        if (MUBASE.Security.isDefaultPin()) {
          U.toast('PIN gérant par défaut (1234) : changez-le dans Paramètres.', 'error');
        }
      })
      .catch(function (err) {
        document.body.innerHTML =
          '<div style="padding:40px;color:#f85149;font-family:sans-serif">' +
          '<h2>Erreur de démarrage</h2><p>' + U.esc(err.message || err) + '</p>' +
          '<p>Vérifiez que le navigateur supporte IndexedDB et rechargez la page.</p></div>';
      });
  };

  /* ================= Produits & catégories ================= */

  App.renderCategories = function () {
    var box = document.getElementById('categoryTabs');
    var cats = ['Tous'].concat(MUBASE.Products.CATEGORIES);
    var html = '';
    cats.forEach(function (cat) {
      var active = (state.category === cat) ? ' active' : '';
      html += '<button class="cat-tab' + active + '" data-cat="' + U.esc(cat) + '">' +
        U.esc(cat) + '</button>';
    });
    box.innerHTML = html;
    var tabs = box.querySelectorAll('.cat-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function () {
        state.category = this.getAttribute('data-cat');
        App.renderCategories();
        App.renderProducts();
      };
    }
  };

  App.filteredProducts = function () {
    var q = (state.search || '').toLowerCase();
    return state.products.filter(function (p) {
      if (state.category !== 'Tous' && p.category !== state.category) return false;
      if (q && p.name.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  };

  App.renderProducts = function () {
    var grid = document.getElementById('productGrid');
    var list = App.filteredProducts();
    var html = '';
    list.forEach(function (p) {
      var prices = C.productPrices(p);
      var priceTxt;
      if (p.free) {
        priceTxt = 'INCLUS';
      } else if (p.active === false) {
        priceTxt = 'Prix à définir';
      } else {
        // Affiche USD + équivalent FC
        priceTxt = U.fmtUSD(prices.usd) + ' <span class="product-cat">/ ' +
          U.esc(U.fmtFC(prices.fc)) + '</span>';
      }
      var cls = 'product-card' + (p.active === false ? ' inactive' : '');
      html += '<div class="' + cls + '" data-id="' + U.esc(p.id) + '">' +
        '<div class="product-name">' + U.esc(p.name) + '</div>' +
        (p.category ? '<div class="product-cat">' + U.esc(p.category) + '</div>' : '') +
        '<div class="product-price">' + priceTxt + '</div>' +
        (p.note ? '<div class="product-note">' + U.esc(p.note) + '</div>' : '') +
        '</div>';
    });
    if (!list.length) {
      html = '<div class="report-empty" style="grid-column:1/-1">Aucun produit trouvé.</div>';
    }
    grid.innerHTML = html;
    var cards = grid.querySelectorAll('.product-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].onclick = function () {
        var id = this.getAttribute('data-id');
        var p = null;
        for (var j = 0; j < state.products.length; j++) {
          if (state.products[j].id === id) { p = state.products[j]; break; }
        }
        if (p) {
          var added = O.addProduct(p);
          if (added) {
            document.getElementById('saveBadge').textContent = 'Sauvegardé';
          }
        }
      };
    }
  };

  /* ================= Panier ================= */

  App.refreshCartUI = function () {
    var box = document.getElementById('cartItems');
    var empty = document.getElementById('cartEmpty');
    var t = O.cartTotals();

    document.getElementById('totalUSD').textContent = U.fmtUSD(t.usd);
    document.getElementById('totalFC').textContent = U.fmtFC(t.fc);
    document.getElementById('totalFinal').textContent =
      U.fmtUSD(t.usd) + ' / ' + U.fmtFC(t.fc);

    if (O.currentTableId) {
      document.getElementById('tableBadge').textContent = O.tableName(O.currentTableId);
      var sel = document.getElementById('tableSelect');
      if (sel.value !== O.currentTableId) sel.value = O.currentTableId;
    }

    if (!O.cart.length) {
      box.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    var html = '';
    O.cart.forEach(function (it, idx) {
      var lineUSD = Math.round(it.qty * it.unitUSD * 100) / 100;
      var lineFC = it.unitFC * it.qty;
      html += '<div class="cart-item">' +
        '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + U.esc(it.name) + '</div>' +
        (it.note ? '<div class="cart-item-note">' + U.esc(it.note) + '</div>' : '') +
        '<div class="cart-item-price">' + U.esc(U.fmtUSD(lineUSD)) + ' / ' +
        U.esc(U.fmtFC(lineFC)) + '</div>' +
        '</div>' +
        '<div class="qty-controls">' +
        '<button class="qty-btn" data-a="dec" data-i="' + idx + '">−</button>' +
        '<span class="qty-val">' + it.qty + '</span>' +
        '<button class="qty-btn" data-a="inc" data-i="' + idx + '">+</button>' +
        '</div>' +
        '<button class="item-note-btn" data-a="note" data-i="' + idx + '" title="Note">✎</button>' +
        '<button class="item-del" data-a="del" data-i="' + idx + '">✕</button>' +
        '</div>';
    });
    box.innerHTML = html;

    var btns = box.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var a = this.getAttribute('data-a');
        var idx = parseInt(this.getAttribute('data-i'), 10);
        if (a === 'inc') O.changeQty(idx, 1);
        else if (a === 'dec') O.changeQty(idx, -1);
        else if (a === 'del') O.removeItem(idx);
        else if (a === 'note') {
          var current = O.cart[idx].note || '';
          U.promptText('Note pour « ' + O.cart[idx].name + ' »', 'Ex : sans oignon', function (val) {
            if (val !== null) O.setItemNote(idx, val);
          });
        }
      };
    }
  };

  App.refreshTablesUI = function () {
    var grid = document.getElementById('tablesGrid');
    MUBASE.DB.getAllCarts().then(function (carts) {
      var occupied = {};
      var counts = {};
      (carts || []).forEach(function (c) {
        if (c.items && c.items.length) {
          occupied[c.tableId] = true;
          var n = 0;
          c.items.forEach(function (it) { n += it.qty; });
          counts[c.tableId] = n;
        }
      });
      var html = '';
      O.TABLES.forEach(function (tb) {
        var isOcc = !!occupied[tb.id];
        var cls = 'table-card ' + (isOcc ? 'occupied' : 'free');
        html += '<div class="' + cls + '" data-tid="' + U.esc(tb.id) + '">' +
          '<div class="table-name">' + U.esc(tb.name) + '</div>' +
          '<div class="table-status">' +
          (isOcc ? 'Occupée — ' + counts[tb.id] + ' article(s)' : 'Libre') +
          '</div></div>';
      });
      grid.innerHTML = html;
      var cards = grid.querySelectorAll('.table-card');
      for (var i = 0; i < cards.length; i++) {
        cards[i].onclick = function () {
          var tid = this.getAttribute('data-tid');
          if (tid === O.currentTableId) {
            App.showView('pos');
          } else {
            O.loadCart(tid);
            App.showView('pos');
          }
        };
      }
    });
  };

  App.fillTableSelects = function () {
    var sel = document.getElementById('tableSelect');
    var html = '';
    O.TABLES.forEach(function (tb) {
      html += '<option value="' + U.esc(tb.id) + '">' + U.esc(tb.name) + '</option>';
    });
    sel.innerHTML = html;
  };

  App.showView = function (view) {
    document.getElementById('posView').classList.toggle('active', view === 'pos');
    document.getElementById('tablesView').classList.toggle('active', view === 'tables');
    document.getElementById('btnTables').classList.toggle('active', view === 'tables');
    if (view === 'tables') App.refreshTablesUI();
  };

  /* ================= PIN / sécurité ================= */

  var pinCallback = null;

  App.requirePin = function (title, onOk) {
    pinCallback = onOk;
    document.getElementById('pinTitle').textContent = title || 'Code PIN gérant';
    document.getElementById('pinHint').textContent = 'Saisissez le PIN gérant (4 chiffres).';
    document.getElementById('pinError').classList.add('hidden');
    document.getElementById('pinInput').value = '';
    document.getElementById('pinModal').classList.remove('hidden');
    setTimeout(function () { document.getElementById('pinInput').focus(); }, 100);
  };

  App.verifyPinInput = function () {
    var pin = document.getElementById('pinInput').value;
    if (MUBASE.Security.verifyPin(pin)) {
      document.getElementById('pinModal').classList.add('hidden');
      var cb = pinCallback;
      pinCallback = null;
      if (cb) cb();
    } else {
      document.getElementById('pinError').classList.remove('hidden');
      document.getElementById('pinInput').value = '';
      document.getElementById('pinInput').focus();
    }
  };

  /* ================= Paiement ================= */

  App.openPayment = function () {
    if (!O.cart.length) {
      U.toast('Le panier est vide.', 'error');
      return;
    }
    state.payMethod = null;
    var t = O.cartTotals();
    document.getElementById('paySummary').innerHTML =
      '<div class="total-line"><span>Articles</span><span>' + O.cart.length + '</span></div>' +
      '<div class="total-line"><span>Total USD</span><strong>' + U.fmtUSD(t.usd) + '</strong></div>' +
      '<div class="total-line"><span>Total FC</span><strong>' + U.fmtFC(t.fc) + '</strong></div>' +
      '<div class="total-line"><span>Table</span><span>' + U.esc(O.tableName(O.currentTableId)) + '</span></div>';
    document.getElementById('payDetails').classList.add('hidden');
    document.getElementById('payDetails').innerHTML = '';
    document.getElementById('btnPayConfirm').disabled = true;
    var methods = document.querySelectorAll('.btn-method');
    for (var i = 0; i < methods.length; i++) methods[i].classList.remove('selected');
    document.getElementById('payModal').classList.remove('hidden');
  };

  App.selectPayMethod = function (method, btn) {
    state.payMethod = method;
    var methods = document.querySelectorAll('.btn-method');
    for (var i = 0; i < methods.length; i++) methods[i].classList.remove('selected');
    btn.classList.add('selected');

    var t = O.cartTotals();
    var details = document.getElementById('payDetails');
    var html = '<label>Remise (FC, optionnel) <input type="number" id="payDiscount" min="0" step="100" value="0"></label>';
    if (method === 'USD' || method === 'MIXED') {
      html += '<label>Montant reçu USD <input type="number" id="payUsd" min="0" step="0.5"></label>';
    }
    if (method === 'FC' || method === 'MIXED') {
      html += '<label>Montant reçu FC <input type="number" id="payFc" min="0" step="100"></label>';
    }
    html += '<div id="payChange" class="pay-change"></div>';
    details.innerHTML = html;
    details.classList.remove('hidden');

    var usdIn = document.getElementById('payUsd');
    var fcIn = document.getElementById('payFc');
    var dIn = document.getElementById('payDiscount');
    var changeBox = document.getElementById('payChange');
    var confirmBtn = document.getElementById('btnPayConfirm');

    function liveCheck() {
      var input = {
        method: method,
        discountFC: dIn ? dIn.value : 0,
        usdReceived: usdIn ? usdIn.value : 0,
        fcReceived: fcIn ? fcIn.value : 0
      };
      var draft = { totalUSD: t.usd, totalFC: t.fc };
      var res = MUBASE.Payments.computePayment(draft, input);
      if (res.ok) {
        changeBox.textContent = 'Monnaie : ' + U.fmtFC(res.payment.fcChange) +
          ' / ' + U.fmtUSD(res.payment.usdChange);
        changeBox.style.color = 'var(--ok)';
        confirmBtn.disabled = false;
      } else {
        changeBox.textContent = res.error;
        changeBox.style.color = 'var(--danger)';
        confirmBtn.disabled = true;
      }
    }
    if (usdIn) usdIn.oninput = liveCheck;
    if (fcIn) fcIn.oninput = liveCheck;
    if (dIn) dIn.oninput = liveCheck;
    // Pré-remplit avec le total exact pour faciliter
    if (usdIn) usdIn.value = t.usd;
    if (fcIn) fcIn.value = t.fc;
    liveCheck();
  };

  App.confirmPayment = function () {
    if (!state.payMethod) return;
    var dIn = document.getElementById('payDiscount');
    var usdIn = document.getElementById('payUsd');
    var fcIn = document.getElementById('payFc');
    var t = O.cartTotals();
    var input = {
      method: state.payMethod,
      discountFC: dIn ? dIn.value : 0,
      usdReceived: usdIn ? usdIn.value : 0,
      fcReceived: fcIn ? fcIn.value : 0
    };
    var res = MUBASE.Payments.computePayment({ totalUSD: t.usd, totalFC: t.fc }, input);
    if (!res.ok) {
      U.toast(res.error, 'error');
      return;
    }
    var confirmBtn = document.getElementById('btnPayConfirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Enregistrement...';

    MUBASE.Payments.checkout(res.payment).then(function (sale) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Valider la vente';
      if (sale && sale.error) {
        U.toast(sale.error, 'error');
        return;
      }
      document.getElementById('payModal').classList.add('hidden');
      state.lastSale = sale;
      MUBASE.Receipts.showReceipt(sale);
      App.refreshTablesUI();
    });
  };

  /* ================= Rapports ================= */

  App.openReports = function () {
    App.requirePin('Rapports — PIN gérant', function () {
      document.getElementById('reportsModal').classList.remove('hidden');
      App.renderReport();
    });
  };

  App.renderReport = function () {
    var content = document.getElementById('reportContent');
    var dateRow = document.getElementById('reportDateRow');
    var dateVal = document.getElementById('reportDate').value || U.todayStr();
    content.innerHTML = '<div class="report-empty">Chargement...</div>';

    var needDate = ['date', 'payment', 'category', 'product'].indexOf(state.reportType) !== -1;
    dateRow.classList.toggle('hidden', !needDate);

    var promise;
    switch (state.reportType) {
      case 'date': promise = MUBASE.Reports.byDate(dateVal); break;
      case 'payment': promise = MUBASE.Reports.byPayment(dateVal); break;
      case 'category': promise = MUBASE.Reports.byCategory(dateVal, state.products); break;
      case 'product': promise = MUBASE.Reports.byProduct(dateVal); break;
      case 'shifts': promise = MUBASE.Reports.shifts(); break;
      default: promise = MUBASE.Reports.daily();
    }
    promise.then(function (html) {
      content.innerHTML = html;
    }).catch(function (err) {
      content.innerHTML = '<div class="report-empty">Erreur : ' + U.esc(err.message || err) + '</div>';
    });
  };

  /* ================= Paramètres ================= */

  App.openSettings = function () {
    App.requirePin('Paramètres — PIN gérant', function () {
      App.fillSettingsForm();
      document.getElementById('settingsModal').classList.remove('hidden');
      App.showSettingsTab('general');
    });
  };

  App.fillSettingsForm = function () {
    var s = C.getSettings();
    document.getElementById('setRate').value = s.rate || C.DEFAULT_RATE;
    document.getElementById('setRounding').value = String(s.rounding || C.DEFAULT_ROUNDING);
    document.getElementById('setPin').value = '';
    document.getElementById('setServer').value = s.serverName || '';
    var lb = document.getElementById('lastBackup');
    var last = MUBASE.Backup.lastBackupLabel();
    lb.textContent = last ? U.fmtDateTime(last) : 'jamais';
    App.renderProductAdminList();
  };

  App.showSettingsTab = function (tab) {
    state.settingsTab = tab;
    ['general', 'products', 'backup'].forEach(function (t) {
      document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1))
        .classList.toggle('hidden', t !== tab);
    });
    var btns = document.querySelectorAll('.settings-tabs .btn-tab');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-tab') === tab);
    }
    if (tab === 'backup') App.fillSettingsForm();
  };

  App.saveSettings = function () {
    var rate = parseFloat(document.getElementById('setRate').value);
    var rounding = parseInt(document.getElementById('setRounding').value, 10);
    var server = document.getElementById('setServer').value;
    var pin = document.getElementById('setPin').value;
    if (isNaN(rate) || rate <= 0) { U.toast('Taux de change invalide.', 'error'); return; }
    if (![100, 500, 1].indexOf(rounding) === -1 && rounding !== 100 && rounding !== 500 && rounding !== 1) {
      U.toast('Arrondi invalide.', 'error'); return;
    }
    MUBASE.Settings.saveGeneral({ rate: rate, rounding: rounding, serverName: server })
      .then(function () {
        if (pin) {
          return MUBASE.Settings.savePin(pin);
        }
        return true;
      })
      .then(function () {
        U.toast('Paramètres enregistrés.', 'ok');
        MUBASE.Security.log('PARAMETRES', 'Taux=' + rate + ' FC/$, arrondi=' + rounding);
      });
  };

  App.closeShift = function () {
    U.confirm('Lancer la clôture Z du jour ? (les ventes ne sont PAS supprimées)', function (yes) {
      if (!yes) return;
      MUBASE.Settings.closeShift().then(function (sum) {
        U.toast('Clôture Z enregistrée : ' + sum.salesCount + ' ventes, ' +
          U.fmtUSD(sum.totalUSD) + ' / ' + U.fmtFC(sum.totalFC), 'ok');
        App.renderReport();
      });
    });
  };

  /* ---------- Administration produits ---------- */

  App.renderProductAdminList = function () {
    var box = document.getElementById('productAdminList');
    var html = '';
    state.products.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .forEach(function (p) {
        var prices = C.productPrices(p);
        var priceTxt = p.free ? 'INCLUS' :
          (p.active === false ? 'prix à définir' :
            U.fmtUSD(prices.usd) + ' / ' + U.fmtFC(prices.fc));
        html += '<div class="pa-row">' +
          '<span>' + U.esc(p.name) + ' <small>(' + U.esc(p.category) + ')</small></span>' +
          '<span class="pa-price">' + U.esc(priceTxt) + '</span>' +
          '<button class="btn" data-edit="' + U.esc(p.id) + '">Modifier</button>' +
          '</div>';
      });
    box.innerHTML = html;
    var btns = box.querySelectorAll('[data-edit]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var id = this.getAttribute('data-edit');
        for (var j = 0; j < state.products.length; j++) {
          if (state.products[j].id === id) { App.editProduct(state.products[j]); return; }
        }
      };
    }
  };

  App.editProduct = function (p) {
    document.getElementById('productEditForm').classList.remove('hidden');
    document.getElementById('productEditTitle').textContent =
      p ? 'Modifier : ' + p.name : 'Nouveau produit';
    document.getElementById('peId').value = p ? p.id : '';
    document.getElementById('peName').value = p ? p.name : '';
    document.getElementById('pePriceUSD').value = (p && p.priceUSD != null) ? p.priceUSD : '';
    document.getElementById('pePriceFC').value = (p && p.priceFC != null) ? p.priceFC : '';
    document.getElementById('peActive').checked = p ? p.active !== false : true;
    document.getElementById('peFree').checked = p ? !!p.free : false;
    document.getElementById('peNote').value = p ? (p.note || '') : '';
    // Catégories
    var sel = document.getElementById('peCategory');
    var html = '';
    MUBASE.Products.CATEGORIES.forEach(function (c) {
      html += '<option value="' + U.esc(c) + '"' +
        (p && p.category === c ? ' selected' : '') + '>' + U.esc(c) + '</option>';
    });
    sel.innerHTML = html;
  };

  App.saveProduct = function () {
    var id = document.getElementById('peId').value;
    var name = document.getElementById('peName').value.trim();
    if (!name) { U.toast('Nom requis.', 'error'); return; }
    var p = {
      id: id || ('custom-' + U.uid()),
      name: name,
      category: document.getElementById('peCategory').value,
      active: document.getElementById('peActive').checked,
      free: document.getElementById('peFree').checked,
      note: document.getElementById('peNote').value.trim()
    };
    var usd = document.getElementById('pePriceUSD').value;
    var fc = document.getElementById('pePriceFC').value;
    if (usd !== '') p.priceUSD = parseFloat(usd);
    else delete p.priceUSD;
    if (fc !== '') p.priceFC = parseInt(fc, 10);
    else delete p.priceFC;
    // Un produit vendable doit avoir au moins un prix
    if (p.active && p.priceUSD == null && p.priceFC == null && !p.free) {
      U.toast('Définissez un prix USD ou FC.', 'error'); return;
    }
    MUBASE.Settings.saveProduct(p).then(function () {
      return MUBASE.DB.getProducts();
    }).then(function (products) {
      state.products = products;
      document.getElementById('productEditForm').classList.add('hidden');
      App.renderProductAdminList();
      App.renderProducts();
      U.toast('Produit enregistré.', 'ok');
    });
  };

  /* ---------- Transfert ---------- */

  App.openTransfer = function () {
    if (!O.cart.length) { U.toast('Rien à transférer.', 'error'); return; }
    App.requirePin('Transfert de commande — PIN gérant', function () {
      var sel = document.getElementById('transferTarget');
      var html = '';
      O.TABLES.forEach(function (tb) {
        if (tb.id === O.currentTableId) return;
        html += '<option value="' + U.esc(tb.id) + '">' + U.esc(tb.name) + '</option>';
      });
      sel.innerHTML = html;
      document.getElementById('transferInfo').textContent =
        O.cart.length + ' article(s) depuis ' + O.tableName(O.currentTableId);
      document.getElementById('transferModal').classList.remove('hidden');
    });
  };

  App.doTransfer = function () {
    var to = document.getElementById('transferTarget').value;
    var from = O.currentTableId;
    document.getElementById('transferModal').classList.add('hidden');
    O.transferCart(from, to).then(function () {
      MUBASE.Security.log('TRANSFERT', O.tableName(from) + ' -> ' + O.tableName(to));
      U.toast('Commande transférée vers ' + O.tableName(to) + '.', 'ok');
    });
  };

  /* ---------- Annulation de vente ---------- */

  App.openCancel = function () {
    App.requirePin('Annulation — PIN gérant', function () {
      MUBASE.DB.getAll('sales').then(function (sales) {
        sales = sales.filter(function (s) { return s.status !== 'cancelled'; });
        sales.sort(function (a, b) { return String(b.receiptNo).localeCompare(String(a.receiptNo)); });
        var sel = document.getElementById('cancelSale');
        var html = '<option value="">-- Choisir une vente --</option>';
        sales.slice(0, 200).forEach(function (s) {
          html += '<option value="' + s.id + '">' + U.esc(s.receiptNo) + ' | ' +
            U.esc(s.tableName || '-') + ' | ' + U.esc(U.fmtUSD(s.totalUSD)) + ' | ' +
            U.esc(U.fmtDateTime(s.date)) + '</option>';
        });
        sel.innerHTML = html;
        document.getElementById('cancelModal').classList.remove('hidden');
      });
    });
  };

  App.doCancelSale = function () {
    var id = document.getElementById('cancelSale').value;
    if (!id) { U.toast('Choisissez une vente.', 'error'); return; }
    var reason = prompt('Motif de l\'annulation (optionnel) :', '');
    if (reason === null) return;
    MUBASE.Payments.cancelSale(id, reason).then(function (ok) {
      document.getElementById('cancelModal').classList.add('hidden');
      if (ok) {
        MUBASE.Security.log('ANNULATION_CONF', 'Vente ' + id);
        U.toast('Vente annulée (journalisée).', 'ok');
      } else {
        U.toast('Vente introuvable.', 'error');
      }
    });
  };

  /* ================= Divers ================= */

  App.registerSW = function () {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
        // Mise à jour détectée : on prévient sans recharger brutalement
        reg.addEventListener('updatefound', function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              U.toast('Mise à jour disponible : fermez et rouvrez l\'application.', 'ok');
            }
          });
        });
      }).catch(function () {
        // SW non supporté (ancien Android) : l'app fonctionne quand même en ligne
      });
    }
  };

  App.watchOnline = function () {
    function update() {
      var badge = document.getElementById('offlineBadge');
      if (navigator.onLine) {
        badge.classList.add('hidden');
      } else {
        badge.classList.remove('hidden');
      }
    }
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  };

  /* ================= Événements ================= */

  App.bindEvents = function () {
    // Recherche
    document.getElementById('searchInput').oninput = function () {
      state.search = this.value;
      App.renderProducts();
    };
    // Changement de table dans le panier
    document.getElementById('tableSelect').onchange = function () {
      var tid = this.value;
      if (tid !== O.currentTableId) O.loadCart(tid);
    };
    // Boutons panier
    document.getElementById('btnClearCart').onclick = function () {
      if (!O.cart.length) return;
      U.confirm('Vider le panier de ' + O.tableName(O.currentTableId) + ' ?', function (yes) {
        if (yes) O.clearCart();
      });
    };
    document.getElementById('btnCheckout').onclick = App.openPayment;
    document.getElementById('btnTransfer').onclick = App.openTransfer;
    // Navigation
    document.getElementById('btnTables').onclick = function () {
      App.showView(document.getElementById('tablesView').classList.contains('active') ? 'pos' : 'tables');
    };
    // Modales
    document.getElementById('btnPinOk').onclick = App.verifyPinInput;
    document.getElementById('btnPinCancel').onclick = function () {
      document.getElementById('pinModal').classList.add('hidden');
      pinCallback = null;
    };
    document.getElementById('pinInput').onkeydown = function (e) {
      if (e.keyCode === 13) App.verifyPinInput();
    };
    // Paiement
    var methods = document.querySelectorAll('.btn-method');
    for (var i = 0; i < methods.length; i++) {
      methods[i].onclick = function () {
        App.selectPayMethod(this.getAttribute('data-method'), this);
      };
    }
    document.getElementById('btnPayConfirm').onclick = App.confirmPayment;
    document.getElementById('btnPayCancel').onclick = function () {
      document.getElementById('payModal').classList.add('hidden');
    };
    // Reçu
    document.getElementById('btnPrintReceipt').onclick = function () {
      MUBASE.Receipts.printLast();
    };
    document.getElementById('btnCloseReceipt').onclick = function () {
      document.getElementById('receiptModal').classList.add('hidden');
    };
    // Rapports
    document.getElementById('btnReports').onclick = App.openReports;
    document.getElementById('btnCloseReports').onclick = function () {
      document.getElementById('reportsModal').classList.add('hidden');
    };
    var rTabs = document.querySelectorAll('.report-tabs .btn-tab');
    for (var j = 0; j < rTabs.length; j++) {
      rTabs[j].onclick = function () {
        state.reportType = this.getAttribute('data-report');
        for (var k = 0; k < rTabs.length; k++) rTabs[k].classList.remove('active');
        this.classList.add('active');
        App.renderReport();
      };
    }
    document.getElementById('btnReportGo').onclick = App.renderReport;
    // Paramètres
    document.getElementById('btnSettings').onclick = App.openSettings;
    document.getElementById('btnCloseSettings').onclick = function () {
      document.getElementById('settingsModal').classList.add('hidden');
    };
    var sTabs = document.querySelectorAll('.settings-tabs .btn-tab');
    for (var m = 0; m < sTabs.length; m++) {
      sTabs[m].onclick = function () {
        App.showSettingsTab(this.getAttribute('data-tab'));
      };
    }
    document.getElementById('btnSaveSettings').onclick = App.saveSettings;
    document.getElementById('btnCloseShift').onclick = App.closeShift;
    document.getElementById('btnPrintTest').onclick = function () {
      MUBASE.Receipts.printTest();
    };
    document.getElementById('btnAddProduct').onclick = function () { App.editProduct(null); };
    document.getElementById('btnPeCancel').onclick = function () {
      document.getElementById('productEditForm').classList.add('hidden');
    };
    document.getElementById('btnPeSave').onclick = App.saveProduct;
    // Sauvegarde
    document.getElementById('btnExportJson').onclick = function () { MUBASE.Backup.exportJson(); };
    document.getElementById('btnExportCsv').onclick = function () { MUBASE.Backup.exportCsv(); };
    document.getElementById('btnImportJson').onclick = function () {
      document.getElementById('importFile').click();
    };
    document.getElementById('importFile').onchange = function () {
      if (this.files && this.files[0]) MUBASE.Backup.prepareRestore(this.files[0]);
      this.value = '';
    };
    document.getElementById('btnRestoreCancel').onclick = function () {
      document.getElementById('restoreWarning').classList.add('hidden');
    };
    document.getElementById('btnRestoreConfirm').onclick = function () {
      document.getElementById('restoreWarning').classList.add('hidden');
    };
    // Transfert
    document.getElementById('btnTransferOk').onclick = App.doTransfer;
    document.getElementById('btnTransferCancel').onclick = function () {
      document.getElementById('transferModal').classList.add('hidden');
    };
    // Annulation
    document.getElementById('btnCancelSale').onclick = App.doCancelSale;
    document.getElementById('btnCancelClose').onclick = function () {
      document.getElementById('cancelModal').classList.add('hidden');
    };
    // Verrouillage : vide l'écran (retour à l'accueil = PIN au prochain accès sensible)
    document.getElementById('btnLock').onclick = function () {
      App.showView('tables');
      U.toast('Verrouillé : les fonctions sensibles exigent le PIN.', 'ok');
    };
    // Fermeture : sauvegarde immédiate du panier
    window.onbeforeunload = function () { O.saveCart(); };
  };

  // Annulation de vente : bouton dédié (ajouté dynamiquement près de rapports)
  App.addCancelButton = function () {
    var nav = document.querySelector('.topbar-actions');
    var b = document.createElement('button');
    b.className = 'btn btn-nav';
    b.id = 'btnCancelSaleNav';
    b.textContent = 'Annuler';
    b.onclick = App.openCancel;
    nav.insertBefore(b, document.getElementById('btnLock'));
  };

  // Démarrage
  document.addEventListener('DOMContentLoaded', function () {
    App.init();
  });

  MUBASE.App = App;
})();
