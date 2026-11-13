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
    // A REMPLIR apres creation du backend (voir docs/SYNC.md)
    URL: '',          // ex: 'https://xxx.supabase.co/rest/v1/mubase_pos?id=eq.1'
    API_KEY: '',      // cle API publique (anon) si requise
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
      MUBASE.DB.getAll('settings')
    ]).then(function (r) {
      var settings = {};
      (r[3] || []).forEach(function (s) {
        if (s && s.key) settings[s.key] = s.value !== undefined ? s.value : s;
      });
      return {
        sales: r[0] || [],
        shifts: r[1] || [],
        products: r[2] || [],
        settings: settings,
        syncedAt: new Date().toISOString(),
        device: 'citaq'
      };
    });
  }

  /* Fusion : union des ventes par id unique, shifts par id, settings dernier gagne */
  function merge(remote, local) {
    function keyOf(s) { return s.id || s.receiptNo || JSON.stringify(s).length + '_' + (s.date || ''); }
    var merged = {};
    (local.sales || []).concat(remote.sales || []).forEach(function (s) {
      merged[keyOf(s)] = s;
    });
    var sMerged = {};
    (local.shifts || []).concat(remote.shifts || []).forEach(function (s) {
      sMerged[s.id || s.date + '_' + s.day] = s;
    });
    var settings = {};
    var rs = remote.settings || {}, ls = local.settings || {};
    Object.keys(ls).forEach(function (k) { settings[k] = ls[k]; });
    Object.keys(rs).forEach(function (k) { settings[k] = rs[k]; }); // remote gagne
    return {
      sales: Object.keys(merged).map(function (k) { return merged[k]; }),
      shifts: Object.keys(sMerged).map(function (k) { return sMerged[k]; }),
      settings: settings
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
            try { resolve(JSON.parse(xhr.responseText)); }
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
      xhr.send(JSON.stringify(data));
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
    });
  }

  /* Synchro complete : pull -> merge -> apply -> push */
  SYNC.now = function () {
    if (!enabled() || SYNC._syncing || !navigator.onLine) return Promise.resolve(false);
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
      if (MUBASE.App) MUBASE.App.refreshSaveBadge && MUBASE.App.refreshSaveBadge('Synchronisé');
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
    SYNC.URL = MUBASE.DB.getSettingSync('sync_url') || '';
    SYNC.API_KEY = MUBASE.DB.getSettingSync('sync_key') || '';
  };

  MUBASE.Sync = SYNC;
})();
