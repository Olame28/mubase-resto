/* MUBASE POS - Tables et commandes (paniers persistants) */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;
  var C = window.MUBASE.Currency;

  var O = {};

  O.TABLES = [
    { id: 't1', name: 'Table 1' },
    { id: 't2', name: 'Table 2' },
    { id: 't3', name: 'Table 3' },
    { id: 't4', name: 'Table 4' },
    { id: 't5', name: 'Table 5' },
    { id: 't6', name: 'Table 6' },
    { id: 'vip', name: 'VIP' },
    { id: 'counter', name: 'Comptoir' }
  ];

  // État courant
  O.currentTableId = null;
  O.cart = []; // [{productId,name,qty,note,unitUSD,unitFC}]
  O.cartLoadedFor = null;

  O.tableName = function (id) {
    for (var i = 0; i < O.TABLES.length; i++) {
      if (O.TABLES[i].id === id) return O.TABLES[i].name;
    }
    return id || '-';
  };

  O.getTable = function (id) {
    for (var i = 0; i < O.TABLES.length; i++) {
      if (O.TABLES[i].id === id) return O.TABLES[i];
    }
    return null;
  };

  // Charge le panier d'une table depuis IndexedDB (récupération après crash)
  O.loadCart = function (tableId) {
    return MUBASE.DB.getCart(tableId).then(function (cart) {
      O.currentTableId = tableId;
      O.cart = (cart && cart.items) ? cart.items.slice() : [];
      O.cartLoadedFor = tableId;
      if (MUBASE.App) MUBASE.App.refreshCartUI();
      if (MUBASE.App) MUBASE.App.refreshTablesUI();
    });
  };

  // Sauvegarde automatique du panier courant (debounce côté app.js)
  O.saveCart = function () {
    if (!O.currentTableId) return Promise.resolve();
    if (O.cart.length === 0) {
      // Panier vide : on supprime l'enregistrement pour ne pas garder de table "occupée"
      return MUBASE.DB.deleteCart(O.currentTableId);
    }
    return MUBASE.DB.saveCart({
      tableId: O.currentTableId,
      items: O.cart,
      updatedAt: new Date().toISOString()
    });
  };

  // Ajoute un produit au panier courant.
  // product : objet produit complet (avec prix). Les articles inactifs
  // ("prix à définir") sont refusés.
  O.addProduct = function (product) {
    if (!product || product.active === false) {
      U.toast('Produit non disponible (prix à définir).', 'error');
      return false;
    }
    if (!O.currentTableId) {
      // Sélection automatique de la première table si rien n'est choisi
      O.currentTableId = O.TABLES[0].id;
    }
    var prices = C.productPrices(product);
    var line = {
      productId: product.id,
      name: product.name,
      qty: 1,
      note: '',
      unitUSD: prices.usd,
      unitFC: prices.fc,
      free: !!product.free
    };
    // Regroupe les articles identiques sans note
    for (var i = 0; i < O.cart.length; i++) {
      if (O.cart[i].productId === line.productId && !O.cart[i].note) {
        O.cart[i].qty += 1;
        O.saveCart();
        if (MUBASE.App) MUBASE.App.refreshCartUI();
        return true;
      }
    }
    O.cart.push(line);
    O.saveCart();
    if (MUBASE.App) MUBASE.App.refreshCartUI();
    return true;
  };

  O.setQty = function (index, qty) {
    if (index < 0 || index >= O.cart.length) return;
    qty = parseInt(qty, 10);
    if (isNaN(qty) || qty <= 0) {
      O.cart.splice(index, 1);
    } else {
      O.cart[index].qty = qty;
    }
    O.saveCart();
    if (MUBASE.App) MUBASE.App.refreshCartUI();
  };

  O.changeQty = function (index, delta) {
    if (index < 0 || index >= O.cart.length) return;
    var q = (O.cart[index].qty || 1) + delta;
    if (q <= 0) O.cart.splice(index, 1);
    else O.cart[index].qty = q;
    O.saveCart();
    if (MUBASE.App) MUBASE.App.refreshCartUI();
  };

  O.removeItem = function (index) {
    if (index < 0 || index >= O.cart.length) return;
    O.cart.splice(index, 1);
    O.saveCart();
    if (MUBASE.App) MUBASE.App.refreshCartUI();
  };

  O.setItemNote = function (index, note) {
    if (index < 0 || index >= O.cart.length) return;
    O.cart[index].note = note || '';
    O.saveCart();
    if (MUBASE.App) MUBASE.App.refreshCartUI();
  };

  // Transfert d'un panier complet vers une autre table
  O.transferCart = function (fromTableId, toTableId) {
    if (fromTableId === toTableId) return Promise.resolve(false);
    return MUBASE.DB.getCart(fromTableId).then(function (cart) {
      if (cart && cart.items && cart.items.length) {
        // Fusion si la table cible a déjà un panier
        return MUBASE.DB.getCart(toTableId).then(function (target) {
          var items = cart.items.slice();
          if (target && target.items) {
            items = target.items.concat(items);
          }
          return MUBASE.DB.saveCart({
            tableId: toTableId,
            items: items,
            updatedAt: new Date().toISOString()
          });
        }).then(function () {
          return MUBASE.DB.deleteCart(fromTableId);
        });
      }
      return MUBASE.DB.deleteCart(fromTableId);
    }).then(function () {
      if (O.currentTableId === fromTableId) {
        return O.loadCart(toTableId);
      }
      if (MUBASE.App) MUBASE.App.refreshTablesUI();
      return true;
    });
  };

  // Totaux du panier courant (figés : prix unitaires stockés dans les lignes)
  O.cartTotals = function (cart) {
    cart = cart || O.cart;
    var lines = cart.map(function (it) {
      return { qty: it.qty, unitUSD: it.unitUSD, unitFC: it.unitFC };
    });
    return C.totals(lines);
  };

  // Construit l'objet vente (brouillon) pour le paiement.
  // Ne persiste rien : c'est Payments qui valide et écrit une seule fois.
  O.buildSale = function (receiptNo, payment) {
    var t = O.cartTotals();
    return {
      receiptNo: receiptNo,
      date: new Date().toISOString(),
      tableId: O.currentTableId,
      tableName: O.tableName(O.currentTableId),
      server: MUBASE.Settings.getServerName(),
      rate: C.getRate(),
      items: O.cart.map(function (it) {
        return {
          productId: it.productId,
          name: it.name,
          qty: it.qty,
          note: it.note || '',
          unitUSD: it.unitUSD,
          unitFC: it.unitFC,
          free: !!it.free
        };
      }),
      totalUSD: t.usd,
      totalFC: t.fc,
      discountUSD: 0,
      discountFC: 0,
      payment: payment,
      status: 'paid'
    };
  };

  // Vide le panier après encaissement confirmé
  O.clearCart = function () {
    O.cart = [];
    return O.saveCart().then(function () {
      if (MUBASE.App) MUBASE.App.refreshCartUI();
      if (MUBASE.App) MUBASE.App.refreshTablesUI();
    });
  };

  MUBASE.Orders = O;
})();
