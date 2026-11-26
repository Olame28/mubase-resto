/*
 * MUBASE POS - Synchronisation cloud (local-first)
 *
 * Principe : la caisse fonctionne TOUJOURS en local (IndexedDB).
 * Quand Internet est disponible, elle pousse les données vers le cloud
 * et récupère les données des autres appareils.
 *
 * Backend attendu : une URL qui repond en GET/PUT avec un JSON
 * { sales:[], shifts:[], settings:{}, syncedAt:"..." }.
 * Compatible avec Supabase REST, un Cloudflare Worker, ou tout endpoint PUT/GET.
 */
(function () {
  'use strict';
  var U = window.MUBASE.Utils;

  var SYNC = {
    // Backend Supabase (projet MUBASE POS)
    URL: 'https://lwgqkolimdyagscyxqxa.supabase.co/rest/v1/mubase_pos?id=eq.1',
    API_KEY: 'sb_publishable_E_YHskT74bz3cFlmmvYE1Q_MYYr71SV',
    AUTO_MS: 60000,   // tentative de synchro toutes les 60 s
    _timer: null,
    _syncing: false
  };

  function enabled() { return !!SYNC.URL; }

  function headers() {
    var h = { 'Content-Type': 'application/json' };
    if (SYNC.API_KEY) {
      h['apikey'] = SYNC.API_KEY;
      h['Authorization'] = 'Bearer ' + SYNC.API_KEY;
    }
    return h;
  }

  /* Export local -> format cloud */
  function exportLocal() {
    return Promise.all([
      MUBASE.DB.getSales(),
      MUBASE.DB.getShifts(),
      MUBASE.DB.getProducts(),
      MUBASE.DB.getAll('settings'),
      MUBASE.DB.getAllCarts ? MUBASE.DB.getAllCarts() : Promise.resolve([])
    ]).then(function (r) {
      var settings = {};
      (r[3] || []).forEach(function (s) {
        if (s && s.key) settings[s.key] = s.value !== undefined ? s.value : s;
      });
      // Jamais de secret vers le cloud : hash PIN, sel et PIN de reset
      // restent locaux (le cloud est lisible avec la cle publique).
      ['manager_pin_hash', 'pin_salt', 'reset_pin_hash'].forEach(function (k) {
        delete settings[k];
      });
      return {
        sales: r[0] || [],
        shifts: r[1] || [],
        products: r[2] || [],
        settings: settings,
        carts: r[4] || [],
        syncedAt: new Date().toISOString(),
        device: 'citaq'
      };
    });
  }

  /* Fusion : union des ventes par id unique, shifts par id, settings dernier gagne */
  function merge(remote, local) {
    function keyOf(s) { return s.receiptNo || ('id' + s.id) || s.id || JSON.stringify(s).length + '_' + (s.date || ''); }
    var merged = {};
    (local.sales || []).concat(remote.sales || []).forEach(function (s) {
      var k = keyOf(s), prev = merged[k];
      // La version la plus recente (editedAt > date) gagne, dans les deux sens
      var t = String(s.editedAt || s.date || '');
      var pt = prev ? String(prev.editedAt || prev.date || '') : '';
      if (!prev || t >= pt) merged[k] = s;
    });
    var sMerged = {};
    (local.shifts || []).concat(remote.shifts || []).forEach(function (s) {
      sMerged[(s.date || '') + '_' + (s.id || '')] = s;
    });
    var settings = {};
    var rs = remote.settings || {}, ls = local.settings || {};
    Object.keys(ls).forEach(function (k) { settings[k] = ls[k]; });
    Object.keys(rs).forEach(function (k) { settings[k] = rs[k]; }); // remote gagne
    // Tombstones des paniers : fusion par date max (le plus recent gagne)
    function tombMerge(a, b) {
      var out = {}, src;
      try { src = JSON.parse(a || '{}'); } catch (e) { src = {}; }
      Object.keys(src).forEach(function (k) { out[k] = src[k]; });
      try { src = JSON.parse(b || '{}'); } catch (e) { src = {}; }
      Object.keys(src).forEach(function (k) {
        if (!out[k] || src[k] > out[k]) out[k] = src[k];
      });
      return JSON.stringify(out);
    }
    settings['cart_tombstones'] = tombMerge(ls['cart_tombstones'], rs['cart_tombstones']);
    // Produits : union par id. Le produit avec l'updatedAt le plus recent
    // gagne ; a egalite (ou sans date), le cloud gagne — il porte les
    // corrections faites depuis la console ou un autre appareil, et les
    // editions locales portent toujours un updatedAt frais.
    var pMerged = {};
    (local.products || []).forEach(function (p) {
      if (p && p.id != null) pMerged[p.id] = p;
    });
    (remote.products || []).forEach(function (p) {
      if (!p || p.id == null) return;
      var prev = pMerged[p.id];
      if (!prev) { pMerged[p.id] = p; return; }
      var pt = p.updatedAt ? String(p.updatedAt) : '';
      var ot = prev.updatedAt ? String(prev.updatedAt) : '';
      if (pt >= ot) pMerged[p.id] = p;
    });
    var tomb = {};
    try { tomb = JSON.parse(settings['cart_tombstones'] || '{}'); } catch (e) {}
    // Paniers : union par tableId, la version la plus recente gagne,
    // sauf si une tombstone est plus recente que le panier
    var cMerged = {};
    (local.carts || []).concat(remote.carts || []).forEach(function (c) {
      var k = c.tableId || '';
      var prev = cMerged[k];
      if (!prev || String(c.updatedAt || '') >= String(prev.updatedAt || '')) cMerged[k] = c;
    });
    var cartsOut = Object.keys(cMerged).map(function (k) { return cMerged[k]; })
      .filter(function (c) {
        return !(tomb[c.tableId] && tomb[c.tableId] > (c.updatedAt || ''));
      });
    return {
      sales: Object.keys(merged).map(function (k) { return merged[k]; }),
      shifts: Object.keys(sMerged).map(function (k) { return sMerged[k]; }),
      products: Object.keys(pMerged).map(function (k) { return pMerged[k]; }),
      settings: settings,
      carts: cartsOut
    };
  }

  /* Recupere le cloud */
  function pull() {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', SYNC.URL, true);
      xhr.timeout = 10000;
      xhr.setRequestHeader('Accept', 'application/json');
      Object.keys(headers()).forEach(function (k) {
        if (k !== 'Content-Type') xhr.setRequestHeader(k, headers()[k]);
      });
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              var arr = JSON.parse(xhr.responseText);
              // Format Supabase : [{ data: {...} }] -> on renvoie le contenu
              resolve(arr && arr.length ? (arr[0].data || arr[0]) : null);
            }
            catch (e) { reject(e); }
          } else if (xhr.status === 404) { resolve(null); }
          else { reject(new Error('HTTP ' + xhr.status)); }
        }
      };
      xhr.onerror = xhr.ontimeout = function () { reject(new Error('network')); };
      xhr.send();
    });
  }

  /* Pousse le local vers le cloud */
  function push(data) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', SYNC.URL, true);
      xhr.timeout = 15000;
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (SYNC.API_KEY) {
        xhr.setRequestHeader('apikey', SYNC.API_KEY);
        xhr.setRequestHeader('Authorization', 'Bearer ' + SYNC.API_KEY);
      }
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = xhr.ontimeout = function () { reject(new Error('network')); };
      // Format Supabase : ligne id=1, colonne data
      xhr.send(JSON.stringify({ id: 1, data: data }));
    });
  }

  /* Ecrit les donnees fusionnees en base locale */
  function applyMerged(m) {
    var jobs = [];
    (m.sales || []).forEach(function (s) {
      jobs.push(MUBASE.DB.put('sales', s).catch(function () {}));
    });
    (m.shifts || []).forEach(function (s) {
      jobs.push(MUBASE.DB.add('shifts', s).catch(function () {}));
    });
    (m.carts || []).forEach(function (c) {
      jobs.push(MUBASE.DB.put('carts', c).catch(function () {}));
    });
    (m.products || []).forEach(function (p) {
      jobs.push(MUBASE.DB.put('products', p).catch(function () {}));
    });
    // Settings : on ne réécrit que les clés connues pour éviter les doublons
    return Promise.all(jobs).then(function () {
      var sk = Object.keys(m.settings || {});
      var chain = Promise.resolve();
      sk.forEach(function (k) {
        chain = chain.then(function () {
          return MUBASE.DB.setSetting(k, m.settings[k]);
        });
      });
      return chain;
    }).then(function () {
      // Registre de suppressions technicien : retire les ventes/commandes
      // visees en local. Idempotent : rejouer ne casse rien.
      return applyTechDeletions(m.settings || {});
    });
  }

  function applyTechDeletions(settings) {
    var raw = settings['tech_deletions'];
    if (!raw) return Promise.resolve();
    var del;
    try { del = typeof raw === 'string' ? JSON.parse(raw) : raw; }
    catch (e) { return Promise.resolve(); }
    var jobs = [];
    (del.sales || []).forEach(function (receiptNo) {
      jobs.push(MUBASE.DB.getSaleByReceipt(receiptNo).then(function (s) {
        if (s && s.id !== undefined) return MUBASE.DB.del('sales', s.id);
      }).catch(function () {}));
    });
    (del.carts || []).forEach(function (tableId) {
      jobs.push(MUBASE.DB.deleteCart(tableId).catch(function () {}));
    });
    (del.shifts || []).forEach(function (id) {
      jobs.push(MUBASE.DB.del('shifts', id).catch(function () {}));
    });
    (del.products || []).forEach(function (id) {
      jobs.push(MUBASE.DB.deleteProduct(id).catch(function () {}));
    });
    // Modifications technicien : applique les champs corriges sur les ventes
    var edits = {};
    try { edits = typeof settings['tech_edits'] === 'string' ? JSON.parse(settings['tech_edits']) : (settings['tech_edits'] || {}); }
    catch (e) {}
    Object.keys(edits).forEach(function (receiptNo) {
      var f = edits[receiptNo] || {};
      jobs.push(MUBASE.DB.getSaleByReceipt(receiptNo).then(function (s) {
        if (!s) return;
        if (f.totalFC !== undefined) s.totalFC = f.totalFC;
        if (f.totalUSD !== undefined) s.totalUSD = f.totalUSD;
        if (f.tableName !== undefined) s.tableName = f.tableName;
        return MUBASE.DB.updateSale(s);
      }).catch(function () {}));
    });
    // Editions de produits : { id: {priceUSD, priceFC, name, active} }
    var pedits = {};
    try { pedits = typeof settings['tech_edits_products'] === 'string' ? JSON.parse(settings['tech_edits_products']) : (settings['tech_edits_products'] || {}); }
    catch (e) {}
    Object.keys(pedits).forEach(function (pid) {
      var f = pedits[pid] || {};
      jobs.push(MUBASE.DB.getProducts().then(function (prods) {
        for (var i = 0; i < prods.length; i++) {
          if (String(prods[i].id) === String(pid)) {
            if (f.priceUSD !== undefined) prods[i].priceUSD = f.priceUSD;
            if (f.priceFC !== undefined) prods[i].priceFC = f.priceFC;
            if (f.name !== undefined) prods[i].name = f.name;
            if (f.active !== undefined) prods[i].active = f.active;
            return MUBASE.DB.saveProduct(prods[i]);
          }
        }
      }).catch(function () {}));
    });
    // Ventes ajoutees a distance (console technicien) : on les INSERE en
    // base locale -> elles deviennent de vraies ventes locales et ne sont
    // plus jamais ecrasees par une synchro.
    var adds = [];
    try { adds = typeof settings['tech_sales'] === 'string' ? JSON.parse(settings['tech_sales']) : (settings['tech_sales'] || []); }
    catch (e) {}
    (adds || []).forEach(function (sale) {
      if (!sale || !sale.receiptNo) return;
      jobs.push(MUBASE.DB.getSaleByReceipt(sale.receiptNo).then(function (exist) {
        if (!exist) return MUBASE.DB.put('sales', sale);
      }).catch(function () {}));
    });
    return Promise.all(jobs).then(function () {
      if (MUBASE.App) {
        MUBASE.App.refreshCartUI && MUBASE.App.refreshCartUI();
        MUBASE.App.refreshTablesUI && MUBASE.App.refreshTablesUI();
      }
    });
  }

  /* Synchro complete : pull -> merge -> apply -> push */
  SYNC.now = function () {
    // Pas de test navigator.onLine : sur le vieux Chrome du Citaq il peut
    // renvoyer false en permanence. On tente quand meme : en hors ligne
    // la requete echoue vite et la synchro reessaiera au prochain cycle.
    if (!enabled() || SYNC._syncing) return Promise.resolve(false);
    SYNC._syncing = true;
    return pull().then(function (remote) {
      return exportLocal().then(function (local) {
        var m = merge(remote || { sales: [], shifts: [], settings: {} }, local);
        return applyMerged(m).then(function () {
          // On repousse l'etat fusionne pour que le cloud soit a jour
          return exportLocal().then(push);
        });
      });
    }).then(function () {
      SYNC._syncing = false;
      var badge = document.getElementById('saveBadge');
      if (badge) badge.textContent = 'Synchronisé';
      return true;
    }).catch(function () {
      SYNC._syncing = false;
      return false;
    });
  };

  /* Demarrage : synchro au boot + periodique + au retour en ligne */
  SYNC.init = function () {
    if (!enabled()) return;
    setTimeout(SYNC.now, 3000);
    SYNC._timer = setInterval(SYNC.now, SYNC.AUTO_MS);
    window.addEventListener('online', function () { SYNC.now(); });
    // Synchro aussi quand l'app revient au premier plan (apres veille, etc.)
    window.addEventListener('focus', function () { SYNC.now(); });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) SYNC.now();
    });
  };

  /* Configuration runtime (depuis les parametres, PIN gere) */
  SYNC.configure = function (url, key) {
    SYNC.URL = url || '';
    SYNC.API_KEY = key || '';
    MUBASE.DB.setSetting('sync_url', SYNC.URL);
    MUBASE.DB.setSetting('sync_key', SYNC.API_KEY);
    if (SYNC._timer) { clearInterval(SYNC._timer); SYNC._timer = null; }
    SYNC.init();
  };

  SYNC.loadConfig = function () {
    // Ne remplace les valeurs par defaut que si un reglage existe vraiment
    var u = MUBASE.DB.getSettingSync('sync_url');
    var k = MUBASE.DB.getSettingSync('sync_key');
    if (u) SYNC.URL = u;
    if (k) SYNC.API_KEY = k;
  };

  MUBASE.Sync = SYNC;
})();
