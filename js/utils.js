/* MUBASE POS - Utilitaires généraux (ES5, compatible Android 5.1) */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};

  var U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  U.fmtUSD = function (n) {
    n = Number(n) || 0;
    return n.toFixed(2) + ' $';
  };

  U.fmtFC = function (n) {
    n = Math.round(Number(n) || 0);
    // séparateur de milliers simple
    var s = String(n), out = '', i;
    for (i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      if ((s.length - 1 - i) % 3 === 2 && i > 0) out = ' ' + out;
    }
    return out + ' FC';
  };

  U.fmtDateTime = function (d) {
    d = d ? new Date(d) : new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };

  U.fmtDate = function (d) {
    d = d ? new Date(d) : new Date();
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  U.todayStr = function () {
    return U.fmtDate(new Date());
  };

  U.uid = function () {
    return 'id-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
  };

  // Debounce simple
  U.debounce = function (fn, ms) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  };

  U.downloadFile = function (filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'application/octet-stream' });
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      (window.URL || window.webkitURL).revokeObjectURL(url);
    }, 500);
  };

  U.readFileAsText = function (file, cb) {
    var reader = new FileReader();
    reader.onload = function (e) { cb(null, e.target.result); };
    reader.onerror = function () { cb(new Error('Lecture impossible')); };
    reader.readAsText(file);
  };

  U.toast = function (msg, type) {
    var old = document.querySelector('.toast');
    if (old) old.parentNode.removeChild(old);
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 3200);
  };

  // Modale de saisie texte (note article)
  U.promptText = function (title, placeholder, cb) {
    var wrap = document.createElement('div');
    wrap.className = 'note-prompt';
    wrap.innerHTML =
      '<div class="note-prompt-box">' +
      '<h3>' + U.esc(title) + '</h3>' +
      '<input type="text" maxlength="80" placeholder="' + U.esc(placeholder || '') + '">' +
      '<div class="modal-actions">' +
      '<button class="btn" data-a="cancel">Annuler</button>' +
      '<button class="btn btn-primary" data-a="ok">OK</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    var input = wrap.querySelector('input');
    input.focus();
    function close(val) {
      document.body.removeChild(wrap);
      cb(val);
    }
    wrap.querySelector('[data-a="cancel"]').onclick = function () { close(null); };
    wrap.querySelector('[data-a="ok"]').onclick = function () { close(input.value); };
    input.onkeydown = function (e) {
      if (e.keyCode === 13) close(input.value);
      if (e.keyCode === 27) close(null);
    };
  };

  U.confirm = function (msg, cb) {
    var wrap = document.createElement('div');
    wrap.className = 'note-prompt';
    wrap.innerHTML =
      '<div class="note-prompt-box">' +
      '<h3>Confirmation</h3>' +
      '<p>' + U.esc(msg) + '</p>' +
      '<div class="modal-actions">' +
      '<button class="btn" data-a="no">Non</button>' +
      '<button class="btn btn-danger" data-a="yes">Oui</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    wrap.querySelector('[data-a="no"]').onclick = function () {
      document.body.removeChild(wrap); cb(false);
    };
    wrap.querySelector('[data-a="yes"]').onclick = function () {
      document.body.removeChild(wrap); cb(true);
    };
  };

  MUBASE.Utils = U;
})();
