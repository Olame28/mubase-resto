/* MUBASE POS - Base de données locale IndexedDB
 * Stockage principal : produits, ventes, paniers, paramètres, clôtures, audit.
 * LocalStorage : préférences légères uniquement.
 */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};

  var DB_NAME = 'mubase_pos_db';
  var DB_VERSION = 1;
  var db = null;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB non disponible sur ce navigateur.'));
        return;
      }
      var name = window.__MUBASE_DB_NAME__ || DB_NAME;
      var req = indexedDB.open(name, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        if (!d.objectStoreNames.contains('products')) {
          d.createObjectStore('products', { keyPath: 'id' });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!d.objectStoreNames.contains('carts')) {
          d.createObjectStore('carts', { keyPath: 'tableId' });
        }
        if (!d.objectStoreNames.contains('sales')) {
          var s = d.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
          s.createIndex('receiptNo', 'receiptNo', { unique: true });
          s.createIndex('date', 'date', {});
          s.createIndex('tableId', 'tableId', {});
          s.createIndex('status', 'status', {});
        }
        if (!d.objectStoreNames.contains('shifts')) {
          var sh = d.createObjectStore('shifts', { keyPath: 'id', autoIncrement: true });
          sh.createIndex('date', 'date', {});
        }
        if (!d.objectStoreNames.contains('audit')) {
          var a = d.createObjectStore('audit', { keyPath: 'id', autoIncrement: true });
          a.createIndex('date', 'date', {});
        }
      };
      req.onsuccess = function (e) {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Base bloquée par un autre onglet.')); };
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getStore(storeName, mode, fn) {
    return openDB().then(function () {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode);
        var store = t.objectStore(storeName);
        var out;
        try { out = fn(store); } catch (err) { reject(err); return; }
        t.oncomplete = function () { resolve(out); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error || new Error('Transaction annulée')); };
      });
    });
  }

  var D = {};

  D.init = openDB;
  D._req = reqToPromise;

  // ---- génériques ----
  D.getAll = function (storeName) {
    return getStore(storeName, 'readonly', function (s) {
      if (s.getAll) return reqToPromise(s.getAll());
      // fallback anciens navigateurs sans getAll
      return new Promise(function (res, rej) {
        var r = s.openCursor(), arr = [];
        r.onsuccess = function () {
          var cur = r.result;
          if (cur) { arr.push(cur.value); cur.continue(); }
          else res(arr);
        };
        r.onerror = function () { rej(r.error); };
      });
    });
  };

  D.put = function (storeName, value) {
    return getStore(storeName, 'readwrite', function (s) {
      return MUBASE.DB._req(s.put(value));
    });
  };

  D.add = function (storeName, value) {
    return getStore(storeName, 'readwrite', function (s) {
      return MUBASE.DB._req(s.add(value));
    });
  };

  D.del = function (storeName, key) {
    return getStore(storeName, 'readwrite', function (s) {
      return MUBASE.DB._req(s.delete(key));
    });
  };

  D.clear = function (storeName) {
    return getStore(storeName, 'readwrite', function (s) {
      return MUBASE.DB._req(s.clear());
    });
  };

  // ---- Settings (clé/valeur) ----
  D.getSetting = function (key) {
    var val;
    return getStore('settings', 'readonly', function (s) {
      return MUBASE.DB._req(s.get(key));
    }).then(function (r) { return r ? r.value : undefined; });
  };

  // version synchrone impossible : on garde un cache mémoire des settings
  var settingsCache = {};
  var cacheLoaded = false;

  D.loadSettingsCache = function () {
    return D.getAll('settings').then(function (rows) {
      cacheLoaded = true;
      rows.forEach(function (r) { settingsCache[r.key] = r.value; });
    });
  };

  D.getSettingSync = function (key) {
    return settingsCache[key];
  };

  D.setSetting = function (key, value) {
    settingsCache[key] = value;
    return D.put('settings', { key: key, value: value });
  };

  // ---- Produits ----
  D.getProducts = function () {
    return D.getAll('products');
  };
  D.saveProduct = function (p) { return D.put('products', p); };
  D.deleteProduct = function (id) { return D.del('products', id); };

  // ---- Tables / paniers ----
  D.getCart = function (tableId) {
    return getStore('carts', 'readonly', function (s) {
      return MUBASE.DB._req(s.get(tableId));
    });
  };
  D.saveCart = function (cart) { return D.put('carts', cart); };
  D.deleteCart = function (tableId) { return D.del('carts', tableId); };
  D.getAllCarts = function () { return D.getAll('carts'); };

  // ---- Ventes ----
  D.getSales = function () { return D.getAll('sales'); };
  D.addSale = function (sale) { return D.add('sales', sale); };
  D.getSaleByReceipt = function (receiptNo) {
    return getStore('sales', 'readonly', function (s) {
      var idx = s.index('receiptNo');
      return MUBASE.DB._req(idx.get(receiptNo));
    });
  };
  D.getSalesByDate = function (dateStr) {
    return getStore('sales', 'readonly', function (s) {
      var idx = s.index('date');
      var range = IDBKeyRange.bound(dateStr, dateStr + '￿');
      if (idx.getAll) return reqToPromise(idx.getAll(range));
      return new Promise(function (res, rej) {
        var r = idx.openCursor(range), arr = [];
        r.onsuccess = function () {
          var cur = r.result;
          if (cur) { arr.push(cur.value); cur.continue(); }
          else res(arr);
        };
        r.onerror = function () { rej(r.error); };
      });
    });
  };
  D.updateSale = function (sale) { return D.put('sales', sale); };

  // ---- Clôtures Z ----
  D.getShifts = function () { return D.getAll('shifts'); };
  D.addShift = function (shift) { return D.add('shifts', shift); };

  // ---- Audit ----
  D.getAudit = function () { return D.getAll('audit'); };
  D.addAudit = function (entry) { return D.add('audit', entry); };

  // ---- Réinitialisation complète (tests / restauration) ----
  D.resetAll = function () {
    var stores = ['products', 'settings', 'carts', 'sales', 'shifts', 'audit'];
    var chain = Promise.resolve();
    stores.forEach(function (st) {
      chain = chain.then(function () { return D.clear(st); });
    });
    return chain.then(function () {
      settingsCache = {};
      cacheLoaded = false;
    });
  };

  // Export complet pour sauvegarde
  D.exportAll = function () {
    return Promise.all([
      D.getAll('products'), D.getAll('settings'), D.getAll('carts'),
      D.getAll('sales'), D.getAll('shifts'), D.getAll('audit')
    ]).then(function (r) {
      return {
        app: 'MUBASE-POS',
        version: 1,
        exportedAt: new Date().toISOString(),
        products: r[0], settings: r[1], carts: r[2],
        sales: r[3], shifts: r[4], audit: r[5]
      };
    });
  };

  // Remplace toutes les données (utilisé par la restauration, après validation)
  D.importAll = function (data) {
    var stores = ['products', 'settings', 'carts', 'sales', 'shifts', 'audit'];
    var chain = Promise.resolve();
    stores.forEach(function (st) { chain = chain.then(function () { return D.clear(st); }); });
    return chain.then(function () {
      var puts = [];
      ['products', 'settings', 'carts', 'sales', 'shifts', 'audit'].forEach(function (st) {
        (data[st] || []).forEach(function (row) {
          puts.push(D.put(st, row));
        });
      });
      return Promise.all(puts).then(function () {
        return D.loadSettingsCache();
      });
    });
  };

  MUBASE.DB = D;
})();
