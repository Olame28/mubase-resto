/* MUBASE POS - Rapports : journalier, par date, paiements, catégories,
 * produits, clôtures Z. Lecture seule des ventes (jamais de suppression).
 */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};
  var U = window.MUBASE.Utils;

  var R = {};

  function escTable(headers, rows) {
    var h = '<table><tr>';
    headers.forEach(function (x) { h += '<th>' + U.esc(x) + '</th>'; });
    h += '</tr>';
    rows.forEach(function (r) {
      h += '<tr>';
      r.forEach(function (c) { h += '<td class="num">' + c + '</td>'; });
      h += '</tr>';
    });
    h += '</table>';
    return h;
  }

  function onlyPaid(sales) {
    return sales.filter(function (s) { return s.status !== 'cancelled'; });
  }

  function sumSales(sales) {
    var usd = 0, fc = 0, i;
    for (i = 0; i < sales.length; i++) {
      usd += Number(sales[i].totalUSD) || 0;
      fc += Number(sales[i].totalFC) || 0;
    }
    return { usd: Math.round(usd * 100) / 100, fc: Math.round(fc) };
  }

  /* ---------- Journalier (jour courant) ---------- */
  R.daily = function () {
    var today = U.todayStr();
    return MUBASE.DB.getSalesByDate(today).then(function (sales) {
      sales = onlyPaid(sales);
      var t = sumSales(sales);
      var html = '<h4>Rapport du ' + U.esc(today) + '</h4>';
      html += '<p>Ventes : <strong>' + sales.length + '</strong> &nbsp;|&nbsp; ' +
        'Total : <strong>' + U.esc(U.fmtUSD(t.usd)) + '</strong> / ' +
        '<strong>' + U.esc(U.fmtFC(t.fc)) + '</strong></p>';
      if (!sales.length) return html + '<div class="report-empty">Aucune vente aujourd\'hui.</div>';
      var rows = sales.map(function (s) {
        return [U.esc(s.receiptNo), U.esc(s.tableName || '-'),
          U.esc(U.fmtDateTime(s.date).substr(11)),
          U.esc(U.fmtUSD(s.totalUSD)), U.esc(U.fmtFC(s.totalFC)),
          U.esc((s.payment && s.payment.method) || '-')];
      });
      return html + escTable(['Reçu', 'Table', 'Heure', 'USD', 'FC', 'Paiement'], rows);
    });
  };

  /* ---------- Par date ---------- */
  R.byDate = function (dateStr) {
    return MUBASE.DB.getSalesByDate(dateStr || U.todayStr()).then(function (sales) {
      sales = onlyPaid(sales);
      var t = sumSales(sales);
      var html = '<h4>Ventes du ' + U.esc(dateStr) + '</h4>';
      html += '<p>Total : <strong>' + U.esc(U.fmtUSD(t.usd)) + '</strong> / ' +
        '<strong>' + U.esc(U.fmtFC(t.fc)) + '</strong> (' + sales.length + ' ventes)</p>';
      var byMethod = {};
      sales.forEach(function (s) {
        var m = (s.payment && s.payment.method) || 'AUTRE';
        byMethod[m] = (byMethod[m] || 0) + 1;
      });
      html += '<p>Paiements : ' + Object.keys(byMethod).map(function (k) {
        return U.esc(k) + ' ×' + byMethod[k];
      }).join(' | ') + '</p>';
      var rows = sales.map(function (s) {
        return [U.esc(s.receiptNo), U.esc(s.tableName || '-'),
          U.esc(U.fmtUSD(s.totalUSD)), U.esc(U.fmtFC(s.totalFC))];
      });
      return html + (rows.length ? escTable(['Reçu', 'Table', 'USD', 'FC'], rows)
        : '<div class="report-empty">Aucune vente.</div>');
    });
  };

  /* ---------- Par mode de paiement (sur une date) ---------- */
  R.byPayment = function (dateStr) {
    return MUBASE.DB.getSalesByDate(dateStr || U.todayStr()).then(function (sales) {
      sales = onlyPaid(sales);
      var agg = {};
      sales.forEach(function (s) {
        var m = (s.payment && s.payment.method) || 'AUTRE';
        if (!agg[m]) agg[m] = { count: 0, usd: 0, fc: 0 };
        agg[m].count++;
        agg[m].usd += Number(s.totalUSD) || 0;
        agg[m].fc += Number(s.totalFC) || 0;
      });
      var html = '<h4>Paiements du ' + U.esc(dateStr || U.todayStr()) + '</h4>';
      var rows = Object.keys(agg).map(function (k) {
        return [U.esc(k), String(agg[k].count),
          U.esc(U.fmtUSD(Math.round(agg[k].usd * 100) / 100)),
          U.esc(U.fmtFC(agg[k].fc))];
      });
      return html + (rows.length ? escTable(['Mode', 'Ventes', 'USD', 'FC'], rows)
        : '<div class="report-empty">Aucune vente.</div>');
    });
  };

  /* ---------- Par catégorie (sur une date) ---------- */
  R.byCategory = function (dateStr, products) {
    return MUBASE.DB.getSalesByDate(dateStr || U.todayStr()).then(function (sales) {
      sales = onlyPaid(sales);
      var catOf = {};
      (products || []).forEach(function (p) { catOf[p.id] = p.category || 'Autres'; });
      var agg = {};
      sales.forEach(function (s) {
        s.items.forEach(function (it) {
          var cat = catOf[it.productId] || 'Autres';
          if (!agg[cat]) agg[cat] = { qty: 0, usd: 0, fc: 0 };
          agg[cat].qty += it.qty;
          agg[cat].usd += it.qty * (Number(it.unitUSD) || 0);
          agg[cat].fc += it.qty * (Number(it.unitFC) || 0);
        });
      });
      var html = '<h4>Catégories du ' + U.esc(dateStr || U.todayStr()) + '</h4>';
      var rows = Object.keys(agg).sort().map(function (k) {
        return [U.esc(k), String(agg[k].qty),
          U.esc(U.fmtUSD(Math.round(agg[k].usd * 100) / 100)),
          U.esc(U.fmtFC(agg[k].fc))];
      });
      return html + (rows.length ? escTable(['Catégorie', 'Qté', 'USD', 'FC'], rows)
        : '<div class="report-empty">Aucune vente.</div>');
    });
  };

  /* ---------- Par produit (sur une date) ---------- */
  R.byProduct = function (dateStr) {
    return MUBASE.DB.getSalesByDate(dateStr || U.todayStr()).then(function (sales) {
      sales = onlyPaid(sales);
      var agg = {};
      sales.forEach(function (s) {
        s.items.forEach(function (it) {
          if (!agg[it.name]) agg[it.name] = { qty: 0, usd: 0, fc: 0 };
          agg[it.name].qty += it.qty;
          agg[it.name].usd += it.qty * (Number(it.unitUSD) || 0);
          agg[it.name].fc += it.qty * (Number(it.unitFC) || 0);
        });
      });
      var html = '<h4>Produits du ' + U.esc(dateStr || U.todayStr()) + '</h4>';
      var rows = Object.keys(agg).sort().map(function (k) {
        return [U.esc(k), String(agg[k].qty),
          U.esc(U.fmtUSD(Math.round(agg[k].usd * 100) / 100)),
          U.esc(U.fmtFC(agg[k].fc))];
      });
      return html + (rows.length ? escTable(['Produit', 'Qté', 'USD', 'FC'], rows)
        : '<div class="report-empty">Aucune vente.</div>');
    });
  };

  /* ---------- Annulations & remises (contrôle anti-fraude) ---------- */
  R.cancellations = function (dateStr) {
    return MUBASE.DB.getSalesByDate(dateStr || U.todayStr()).then(function (sales) {
      var cancelled = sales.filter(function (s) { return s.status === 'cancelled'; });
      var discounts = onlyPaid(sales).filter(function (s) {
        return (s.discountFC || 0) > 0;
      });
      var html = '<h4>Annulations & remises du ' + U.esc(dateStr || U.todayStr()) + '</h4>';
      html += '<p><strong>' + cancelled.length + '</strong> vente(s) annulée(s), ' +
        '<strong>' + discounts.length + '</strong> remise(s) accordée(s)</p>';
      if (!cancelled.length && !discounts.length) {
        return html + '<div class="report-empty">Aucune anomalie.</div>';
      }
      var rows = [];
      cancelled.forEach(function (s) {
        rows.push([U.esc(s.receiptNo), U.esc(s.tableName || '-'),
          U.esc(U.fmtUSD(s.totalUSD)), U.esc(U.fmtFC(s.totalFC)),
          U.esc(s.cancelReason || '-'), U.esc(U.fmtDateTime(s.cancelledAt))]);
      });
      discounts.forEach(function (s) {
        rows.push([U.esc(s.receiptNo) + ' (remise)', U.esc(s.tableName || '-'),
          U.esc(U.fmtUSD(s.totalUSD)), U.esc('-' + U.fmtFC(s.discountFC)),
          'remise', U.esc(U.fmtDateTime(s.date))]);
      });
      return html + escTable(['Reçu', 'Table', 'Total USD', 'FC', 'Motif', 'Date'], rows);
    });
  };

  /* ---------- Journal d'audit (qui a fait quoi) ---------- */
  R.auditLog = function () {
    return MUBASE.DB.getAudit().then(function (entries) {
      entries.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var html = '<h4>Journal des opérations (100 dernières)</h4>';
      var rows = entries.slice(0, 100).map(function (e) {
        return [U.esc(U.fmtDateTime(e.date)), U.esc(e.action || '-'), U.esc(e.detail || '')];
      });
      return html + (rows.length ? escTable(['Date', 'Action', 'Détail'], rows)
        : '<div class="report-empty">Journal vide.</div>');
    });
  };

  /* ---------- Clôtures Z ---------- */
  R.shifts = function () {
    return MUBASE.DB.getShifts().then(function (shifts) {
      shifts.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      var html = '<h4>Clôtures Z</h4>';
      var rows = shifts.map(function (s) {
        return [U.esc(U.fmtDateTime(s.date)),
          U.esc(String(s.salesCount)),
          U.esc(U.fmtUSD(s.totalUSD || 0)),
          U.esc(U.fmtFC(s.totalFC || 0)),
          U.esc(s.closedBy || '-')];
      });
      return html + (rows.length ? escTable(['Date', 'Ventes', 'USD', 'FC', 'Par'], rows)
        : '<div class="report-empty">Aucune clôture.</div>');
    });
  };

  /* ---------- Clôture Z : calcule le résumé d'une période SANS supprimer ---------- */
  R.buildShiftSummary = function (fromDate, toDate) {
    var from = fromDate || U.todayStr();
    var to = toDate || from;
    var dates = [];
    var d = new Date(from + 'T00:00:00');
    var end = new Date(to + 'T00:00:00');
    while (d <= end) {
      dates.push(U.fmtDate(d));
      d.setDate(d.getDate() + 1);
    }
    return Promise.all(dates.map(function (ds) {
      return MUBASE.DB.getSalesByDate(ds).then(function (sales) {
        return { date: ds, sales: onlyPaid(sales) };
      });
    })).then(function (groups) {
      var all = [];
      groups.forEach(function (g) { all = all.concat(g.sales); });
      var t = sumSales(all);
      var byMethod = {};
      all.forEach(function (s) {
        var m = (s.payment && s.payment.method) || 'AUTRE';
        if (!byMethod[m]) byMethod[m] = { count: 0, usd: 0, fc: 0 };
        byMethod[m].count++;
        byMethod[m].usd += Number(s.totalUSD) || 0;
        byMethod[m].fc += Number(s.totalFC) || 0;
      });
      return {
        from: from, to: to,
        salesCount: all.length,
        totalUSD: t.usd, totalFC: t.fc,
        byMethod: byMethod,
        sales: all
      };
    });
  };

  MUBASE.Reports = R;
})();
