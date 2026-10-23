# Installation sur LG webOS

## 1. Choisir la méthode adaptée

| Fonction | Developer Mode seul | Root + Homebrew Channel |
| --- | --- | --- |
| Installer et ouvrir l’IPK | Oui, selon compatibilité du modèle | Oui |
| Catalogue complet et icônes natives | Peut être limité par les permissions | Méthode utilisée sur la C9 testée |
| Remplacer la touche Home / démarrage | Non fourni par une simple installation IPK | Intégration supplémentaire à adapter et tester |

Relever le modèle exact, firmware, version webOS et IP locale. Vérifier qu’une vidéo se lit déjà dans les applications habituelles. Exporter les paramètres de Launch Home existant et sauvegarder localement les fichiers que l’on compte modifier.

Le root modifie les protections du système. Il ne doit être entrepris qu’avec l’accord explicite du propriétaire et une méthode actuellement compatible. Ce dépôt ne contient pas d’exploit.

Références : [Developer Mode LG](https://webostv.developer.lge.com/develop/getting-started/developer-mode-app), [guide webOSbrew](https://www.webosbrew.org/devmode/), [compatibilité root](https://cani.rootmy.tv/), [faultmanager-autoroot](https://github.com/throwaway96/faultmanager-autoroot), [Homebrew Channel](https://github.com/webosbrew/webos-homebrew-channel).

## 2. Compiler ou télécharger

```sh
git clone https://github.com/zacoka2prod-code/lg-webos-clean-home.git
cd lg-webos-clean-home
npm ci
npm test
npm run pack
```

Sinon, télécharger [l’IPK préparé dans packages/](../packages/org.webosbrew.lounge.launcher_0.0.121_all.ipk) et [son SHA-256](../packages/SHA256SUMS), ou récupérer un artefact d’un workflow de construction réussi. Comparer le SHA-256 téléchargé à celui publié. Ne pas installer un paquet d’une source inconnue.

## 3. Installer l’application seule

### TV sans root

Installer Developer Mode depuis le LG Content Store. Le propriétaire se connecte lui-même à son compte LG directement sur la TV. Activer Dev Mode, attendre le redémarrage, puis activer Key Server. Ajouter la TV dans [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) et installer l’IPK. Garder les codes et clés privés.

Developer Mode est temporaire : consulter le guide webOSbrew pour la durée et le renouvellement. L’expiration peut supprimer les applications installées en mode développeur. Ne pas promettre le remappage de Home avec cette seule méthode.

### TV déjà rootée

Vérifier d’abord l’accès root et Homebrew Channel. Utiliser le mécanisme d’installation local compatible avec cette TV. Sur la C9 testée, `ares-install` avec le profil root a échoué ; l’installation a fonctionné via le service Luna exécuté en root.

Exemple **sur la TV, dans un shell root**, après transfert d’un IPK vérifié vers `/tmp/clean-home.ipk` :

```sh
sleep 5 | luna-send -n 1 luna://com.webos.appInstallService/install '{"id":"/tmp/clean-home.ipk","subscribe":true}'
```

Vérifier la réponse du service et la présence de l’application ; un envoi sans réponse ne prouve pas l’installation. Dans une session SSH non interactive, conserver stdin ouvert quelques secondes évite une sortie prématurée de `luna-send`. Si l’API diffère, lire la documentation du modèle avant de poursuivre.

**Cas faultmanager :** suivre son README actuel. Il exige de désinstaller l’application LG Developer Mode avant le redémarrage, après installation et élévation de Homebrew Channel. Ne pas la réinstaller pendant que la TV est rootée. Avant cette suppression, sauvegarder les applications personnelles et leurs données, vérifier l’accès root et demander l’accord explicite du propriétaire. Ne pas appliquer cette séquence à un autre procédé sans vérifier ses propres instructions.

Ouvrir le nouvel accueil via la liste d’applications. Contrôler les applications présentes, le défilement et la sélection à la télécommande. Configurer la ville météo dans les réglages.

## 4. Home et démarrage — option avancée

Une installation IPK ne suffit pas à modifier la touche Home. Sur la C9 testée, l’intégration utilise [lginputhook](https://github.com/Simon34545/lginputhook), avec une adaptation locale qui limite l’injection au seul processus `lginput2`.

Les exemples dans `integration/c9/` sont **spécifiques à la C9 testée**, désactivés tant qu’ils ne sont pas copiés sur la TV. Ils ne sont pas un installateur universel.

1. Vérifier la compatibilité de lginputhook, sa version, ses chemins et la présence de `lginput2`. Sauvegarder ses fichiers et hooks existants, sans écraser de raccourcis.
2. Ne pas exécuter son autostart standard s’il injecte aussi `RELEASE`, `tvservice`, `micomservice` ou d’autres services. Sur l’installation testée, le tableau `targetNames` du service a été limité à `['lginput2']` et seul le hook dédié démarre l’injection. Relire le code de la version réellement installée avant adaptation.
3. Observer le code de la touche Home **physique** à l’aide des journaux/outils lginputhook. `773` a été observé sur cette C9 ; ce n’est pas une constante garantie pour tous les modèles.
4. Fusionner uniquement cette touche dans `/home/root/.config/lginputhook/keybinds.json`, après sauvegarde. Exemple C9 :

```json
{
  "773": {
    "action": "exec",
    "command": "/usr/bin/luna-send-pub -n 1 luna://com.webos.applicationManager/launch '{\"id\":\"org.webosbrew.lounge.launcher\"}'"
  }
}
```

5. Préserver tous les autres raccourcis et vérifier le JSON. Désactiver uniquement les anciens hooks concurrents de cet accueil après sauvegarde ; pas les services multimédias LG.
6. Adapter puis copier éventuellement `integration/c9/50-clean-home-key.sh` et `60-clean-home-boot.sh` dans `/var/lib/webosbrew/init.d/`, avec droit d’exécution. Le second ne lance l’accueil qu’une fois, sans surveillance permanente.
7. Tester Home depuis les applications et vérifier une vraie vidéo avec image et son. Tester ensuite un redémarrage complet, puis de nouveau la lecture.

Ne jamais injecter directement dans `tvservice` pour reproduire cette configuration. Ne pas activer en parallèle le watcher Home ou l’assistant vocal hérités de Launch Home.

## 5. Validation obligatoire

- Toutes les applications visibles de l’inventaire sont présentes dans la grille ; les entrées système masquées sont exclues.
- Les dernières lignes restent accessibles avec les flèches ; chaque tuile ouvre le bon identifiant.
- Tester une vidéo YouTube et une vidéo protégée (Netflix, CANAL+ ou équivalent) : **image et son réellement constatés par une personne**.
- Vérifier Home depuis ces applications et après redémarrage.
- Vérifier la météo de la ville choisie et l’absence de musique/vidéo en fond.
- Garder un accès à l’accueil LG et un moyen de désactiver les hooks.

Une capture noire d’un contenu DRM n’est pas une preuve de panne ou de bon fonctionnement. Ne pas publier de clés, jetons, identifiants, cookies ou sauvegardes de comptes avec les journaux.

## Retour arrière

1. Avec l’accès root existant, retirer le droit d’exécution **uniquement des deux hooks ajoutés pour ce projet**, ou les déplacer hors de `init.d`. Conserver les sauvegardes.
2. Restaurer l’ancienne entrée Home depuis la sauvegarde, en préservant les autres touches. Si lginputhook avait été adapté, restaurer sa configuration selon l’état exact sauvegardé et désactiver son lancement avant le redémarrage. Ne pas réactiver automatiquement une injection dans les services TV.
3. Fermer cet accueil et utiliser l’accueil LG. Si un ancien Launch Home doit être réinstallé, obtenir l’accord du propriétaire et utiliser son IPK et son export sauvegardés.
4. Après les vérifications propres à la méthode de root, redémarrer complètement et vérifier la lecture. Le changement des fichiers n’enlève pas immédiatement une bibliothèque déjà injectée d’un processus vivant.

Ne jamais effacer les applications de streaming, leurs données, les certificats DRM ou remettre la TV à zéro pour retirer un thème.

## Si les vidéos restent bloquées

Arrêter les changements visuels. Comparer une application protégée et YouTube, fermer l’accueil et neutraliser les hooks ajoutés après sauvegarde. Relever les erreurs sans modifier réseau, DRM ou comptes. Sur la C9 d’origine, des relances de services audio/vidéo n’ont pas suffi ; après retrait autorisé de Developer Mode conformément à faultmanager et un redémarrage complet, la lecture est revenue. **La cause initiale exacte n’a pas été établie.** Ce constat ne garantit pas que toute panne vidéo ait la même cause.
