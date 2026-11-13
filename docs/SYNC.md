# Synchronisation cloud MUBASE POS

La caisse fonctionne **100 % en local** (IndexedDB). Quand Internet est
disponible, `js/sync.js` pousse les ventes/clôtures/paramètres vers un
backend et fusionne les données des autres appareils.

## Backend requis (gratuit)

Recommandé : **Supabase** (compte gratuit, 2 min)

1. Créer un compte sur https://supabase.com
2. New project → créer une table `mubase_pos` avec une colonne `data` (jsonb)
   et une ligne `id=1`
3. Récupérer l'URL REST + la clé `anon` (Settings → API)
4. Donner l'URL au technicien : elle sera configurée dans `js/sync.js`
   (`SYNC.URL`, `SYNC.API_KEY`)

L'endpoint doit répondre :
- `GET URL` → JSON `{ sales:[], shifts:[], settings:{}, syncedAt }`
- `PUT URL` → accepte le même JSON en body

## Dashboard boss

`dashboard.html` (même dossier) : le boss colle l'URL de synchro une fois,
puis voit les ventes du jour en temps réel (rafraîchi toutes les 60 s).
URL publique : `https://olame28.github.io/mubase-resto/dashboard.html`

## Sécurité

- La clé `anon` est publique par design (visible dans le JS) : elle ne
  donne accès qu'à la lecture/écriture de CETTE table — pas aux autres
  données Supabase. Pour plus de protection : activer Row Level Security
  et limiter la table à une seule ligne.
- Les données de vente transitent en HTTPS (chiffré).
