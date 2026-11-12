/* MUBASE POS - Sauvegarde et restauration JSON/CSV */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;

  var B = {};
  var pendingImport = null;

  B.exportJson = function () {
    return MUBASE.DB.exportAll().then(function (data) {
      var stamp = U.fmtDateTime(new Date()).replace(/[: ]/g, '-');
      U.downloadFile('mubase-pos-sauvegarde-' + stamp + '.json',
        JSON.stringify(data, null, 2), 'application/json');
      MUBASE.DB.setSetting('last_backup', new Date().toISOString());
      MUBASE.Security.log('SAUVEGARDE', 'Export JSON');
      U.toast('Sauvegarde exportée.', 'ok');
    });
  };

  B.lastBackupLabel = function () {
    return MUBASE.DB.getSettingSync('last_backup') || null;
  };

  /* ---------- Import avec vérification ---------- */
  B.validateImport = function (data) {
    if (!data || typeof data !== 'object') return { ok: false, error: 'Fichier invalide.' };
    if (data.app !== 'MUBASE-POS') return { ok: false, error: 'Ce fichier n\'est pas une sauvegarde MUBASE POS.' };
    ['products', 'settings', 'carts', 'sales', 'shifts', 'audit'].forEach(function (k) {
      if (!Array.isArray(data[k])) data[k] = [];
    });
    return { ok: true, data: data };
  };

  // Détecte les doublons de numéros de reçu entre le fichier et la base actuelle
  B.detectDuplicates = function (data) {
    return MUBASE.DB.getAll('sales').then(function (current) {
      var currentNos = {};
      current.forEach(function (s) { if (s.receiptNo) currentNos[s.receiptNo] = true; });
      var dupInFile = {};
      var overlap = 0;
      (data.sales || []).forEach(function (s) {
        if (s.receiptNo) {
          if (currentNos[s.receiptNo]) overlap++;
          if (dupInFile[s.receiptNo]) overlap++; // doublon interne
          dupInFile[s.receiptNo] = true;
        }
      });
      return { overlap: overlap, fileSales: (data.sales || []).length, currentSales: current.length };
    });
  };

  // Prépare une restauration : valide puis attend confirmation UI
  B.prepareRestore = function (file) {
    return U.readFileAsText(file, function (err, text) {
      if (err) { U.toast('Impossible de lire le fichier.', 'error'); return; }
      var data;
      try { data = JSON.parse(text); } catch (e) {
        U.toast('Fichier JSON invalide.', 'error'); return;
      }
      var v = B.validateImport(data);
      if (!v.ok) { U.toast(v.error, 'error'); return; }
      B.detectDuplicates(v.data).then(function (info) {
        pendingImport = v.data;
        var msg = 'Ventes dans le fichier : ' + info.fileSales +
          ' | ventes actuelles : ' + info.currentSales +
          (info.overlap ? ' | chevauchements détectés : ' + info.overlap : '');
        U.confirm('Restaurer cette sauvegarde ?\n' + msg +
          '\n\nUne sauvegarde de sécurité sera créée automatiquement avant.', function (yes) {
            if (!yes) { pendingImport = null; return; }
            B.restore(v.data);
          });
      });
    });
  };

  // Restaure : sauvegarde d'abord l'état actuel, puis remplace
  B.restore = function (data) {
    return MUBASE.DB.exportAll().then(function (current) {
      var stamp = U.fmtDateTime(new Date()).replace(/[: ]/g, '-');
      U.downloadFile('mubase-pos-AVANT-RESTAURATION-' + stamp + '.json',
        JSON.stringify(current, null, 2), 'application/json');
      return MUBASE.DB.importAll(data);
    }).then(function () {
      MUBASE.Security.log('RESTAURATION', 'Restauration JSON effectuée');
      U.toast('Restauration terminée. Rechargez la page.', 'ok');
      setTimeout(function () { location.reload(); }, 1500);
    }).catch(function (err) {
      U.toast('Erreur de restauration : ' + (err.message || err), 'error');
    });
  };

  /* ---------- Export CSV des ventes ---------- */
  B.exportCsv = function () {
    return MUBASE.DB.getAll('sales').then(function (sales) {
      var rows = ['recu;date;table;serveur;taux;total_usd;total_fc;remise_fc;mode;usd_recu;fc_recu;monnaie_usd;monnaie_fc;statut'];
      sales.forEach(function (s) {
        var p = s.payment || {};
        rows.push([
          s.receiptNo, s.date, s.tableName || '', s.server || '', s.rate,
          s.totalUSD, s.totalFC, s.discountFC || 0,
          p.method || '', p.usdReceived || 0, p.fcReceived || 0,
          p.usdChange || 0, p.fcChange || 0, s.status || 'paid'
        ].join(';'));
      });
      var stamp = U.fmtDate(new Date());
      U.downloadFile('mubase-pos-ventes-' + stamp + '.csv',
        rows.join('\r\n'), 'text/csv');
      U.toast('Export CSV créé.', 'ok');
    });
  };

  MUBASE.Backup = B;
})();
