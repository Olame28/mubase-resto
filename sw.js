/*
 * MUBASE POS - Service Worker
 * Mise en cache de l'application pour fonctionnement hors ligne.
 * Compatible avec les anciens navigateurs : toute erreur est silencieuse.
 */
(function () {
  'use strict';

  var CACHE_NAME = 'mubase-pos-v6'; // INCREMENTER a chaque publication

  // Liste des fichiers indispensables au démarrage hors ligne.
  var ASSETS = [
    './',
    './index.html',
    './?source=pwa',
    './manifest.json',
    './css/style.css',
    './css/responsive.css',
    './css/print.css',
    './js/utils.js',
    './js/currency.js',
    './js/database.js',
    './js/security.js',
    './js/products.js',
    './js/orders.js',
    './js/payments.js',
    './js/receipts.js',
    './js/reports.js',
    './js/settings.js',
    './js/backup.js',
    './js/sync.js',
    './js/app.js',
    './assets/icons/icon-192.png'
  ];

  self.addEventListener('install', function (event) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(function (cache) {
        // addAll échoue si UN fichier manque : on met en cache un par un
        // pour rester tolérant aux anciens navigateurs.
        var chain = Promise.resolve();
        ASSETS.forEach(function (url) {
          chain = chain.then(function () {
            return cache.add(url).catch(function () {
              // Fichier absent : on continue sans bloquer l'installation.
            });
          });
        });
        return chain;
      }).then(function () {
        return self.skipWaiting();
      })
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys().then(function (keys) {
        var jobs = [];
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] !== CACHE_NAME) {
            jobs.push(caches.delete(keys[i]));
          }
        }
        return Promise.all(jobs);
      }).then(function () {
        return self.clients.claim();
      })
    );
  });

  self.addEventListener('fetch', function (event) {
    var request = event.request;
    // Ne gérer que les GET, ne pas intercepter d'éventuels POST.
    if (request.method !== 'GET') {
      return;
    }
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) {
          // Stratégie "cache d'abord" : l'app reste disponible hors ligne.
          // On tente une mise à jour en arrière-plan.
          fetch(request).then(function (response) {
            if (response && response.ok) {
              var clone = response.clone();
              caches.open(CACHE_NAME).then(function (cache) {
                cache.put(request, clone);
              });
            }
          }).catch(function () { /* hors ligne : on garde le cache */ });
          return cached;
        }
        // Ressource non en cache : tenter le réseau, puis mettre en cache.
        return fetch(request).then(function (response) {
          if (response && response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, clone);
            });
          }
          return response;
        }).catch(function () {
          // Hors ligne : pour les navigations, on sert la page d'accueil
          // en dernier recours — jamais d'écran "no internet".
          if (request.mode === 'navigate') {
            return caches.match('./index.html').then(function (hit) {
              return hit || caches.match('./');
            });
          }
          try {
            return new Response('', { status: 404 });
          } catch (e) {
            return caches.match('./index.html');
          }
        });
      })
    );
  });
})();
