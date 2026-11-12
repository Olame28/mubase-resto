# Installation de MUBASE Print sur le Citaq H10-3

Application compagnon **gratuite** qui fait le pont entre MUBASE POS (PWA)
et l'imprimante thermique intégrée (CTE-RP80, port série `/dev/ttyS1`).

## Fichier APK

`MUBASE-POS/MUBASE-Print.apk` (à la racine du projet, 16 Ko)

## Installation

1. **Transférez l'APK sur le Citaq** :
   - câble USB (copiez le fichier dans `/sdcard/Download/`), ou
   - Wi-Fi : envoyez-vous le fichier par WhatsApp/Drive et téléchargez-le
     sur le Citaq dans le dossier Téléchargements.
2. Sur le Citaq, ouvrez le **gestionnaire de fichiers** → dossier
   Téléchargements → touchez `MUBASE-Print.apk`.
3. Si Android bloque : **Paramètres → Sécurité → Sources inconnues** →
   autorisez l'installation depuis cette source (ou depuis le navigateur
   de fichiers).
4. Confirmez l'installation.

## Utilisation

1. **Ouvrez MUBASE Print** sur le Citaq (icône dans les applications).
2. L'écran affiche « En écoute sur http://127.0.0.1:8090 ».
3. **Laissez l'application ouverte** (ou minimisez-la : elle continue
   d'écouter en arrière-plan tant qu'Android ne la tue pas — pour être sûr,
   gardez-la ouverte pendant le service).
4. Touchez **TEST IMPRESSION** : un ticket de test doit sortir de
   l'imprimante.

## Test depuis MUBASE POS

1. Dans MUBASE POS → **Paramètres** → **Test d'impression**.
2. Si MUBASE Print tourne : le ticket sort **directement**, sans aperçu.
3. Sinon : l'aperçu Android s'ouvre (secours automatique).

## Bon de cuisine

Le bouton **« Envoyer en cuisine »** du panier utilise le même canal :
le bon de cuisine (sans prix) sort directement sur l'imprimante thermique.

## En cas d'échec du test d'impression

Si le bouton TEST affiche une erreur (ex. « Permission denied »,
« FileNotFoundException », « I/O error ») :

1. Notez **le message exact** affiché dans le journal de l'app.
2. Cela signifie probablement que `/dev/ttyS1` est protégé → il faudra
   **rooter le terminal** (procédure documentée dans
   `github.com/netguycode/citaq`) puis redonner les droits au port série.
3. Envoyez-moi le message d'erreur : j'adapterai l'app (root, permission,
   ou autre chemin d'accès comme l'API Citaq).

## Désinstallation / mise à jour

- Désinstaller : Paramètres → Applications → MUBASE Print → Désinstaller.
- L'app ne stocke aucune donnée : la désinstaller ne touche pas à MUBASE POS.
