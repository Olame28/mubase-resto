/* MUBASE POS - Sécurité : hachage PIN (SHA-256), sessions, journal d'audit */
(function () {
  'use strict';
  window.MUBASE = window.MUBASE || {};

  var S = {};

  /* ---------- SHA-256 compact (implémentation publique, ES5) ---------- */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var maxWord = Math.pow(2, 32);
    var result = '';
    var words = [];
    var asciiBitLength = ascii.length * 8;
    var hash = sha256.h = sha256.h || [];
    var k = sha256.k = sha256.k || [];
    var primeCounter = k.length;
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (var i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) {
      var j = ascii.charCodeAt(i);
      if (j >> 8) return ''; // UTF-8 non supporté : PIN numérique uniquement
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
            ) | 0);
        var temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  /* ---------- PIN gérant ---------- */
  var SALT_KEY = 'pin_salt';

  S.hashPin = function (pin, salt) {
    return sha256(String(salt || '') + ':' + String(pin));
  };

  S.getSalt = function () {
    var s = MUBASE.DB.getSettingSync(SALT_KEY);
    if (!s) {
      s = MUBASE.Utils.uid();
      MUBASE.DB.setSetting(SALT_KEY, s);
    }
    return s;
  };

  // Définit le PIN (stocké haché + salé, jamais en clair)
  S.setPin = function (pin) {
    var salt = S.getSalt();
    return MUBASE.DB.setSetting('manager_pin_hash', S.hashPin(pin, salt));
  };

  // Vérifie un PIN. Au premier démarrage, définit le PIN par défaut "1234"
  // et oblige à le changer (voir app.js).
  S.verifyPin = function (pin) {
    var hash = MUBASE.DB.getSettingSync('manager_pin_hash');
    if (!hash) {
      // PIN par défaut initial
      S.setPin('1234');
      MUBASE.DB.setSetting('pin_default', '1');
      return String(pin) === '1234';
    }
    var salt = S.getSalt();
    return S.hashPin(pin, salt) === hash;
  };

  S.isDefaultPin = function () {
    return MUBASE.DB.getSettingSync('pin_default') === '1';
  };

  S.clearDefaultFlag = function () {
    MUBASE.DB.setSetting('pin_default', '0');
  };

  /* ---------- Journal d'audit ---------- */
  S.log = function (action, detail) {
    MUBASE.DB.addAudit({
      date: new Date().toISOString(),
      action: action,
      detail: detail || ''
    });
  };

  MUBASE.Security = S;
})();
