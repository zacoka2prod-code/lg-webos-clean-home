# ZKP Clean Home — LG webOS

Un accueil pour TV LG webOS avec grandes tuiles, éclairage de fond qui suit l’application sélectionnée, navigation à la télécommande et météo facultative. Adaptation de [Launch Home](https://github.com/gprot42/webos-launch-home), inspirée visuellement de [CleanYourTV](https://github.com/Gathin23/cleanyourtv).

**Toutes les applications visibles installées sont accessibles dans la grille défilante**, sans passer par « All apps ». Les raccourcis épinglés passent en premier, puis les autres applications. Les applications système masquées restent masquées.

## Ce qui a été testé

| Élément | Résultat |
| --- | --- |
| Téléviseur | LG OLED55C9PLA, firmware 05.50.00, webOS 4.10.2-31 |
| Interface | 4 grandes tuiles par ligne, défilement, focus, horloge et date françaises |
| Catalogue | 28 applications visibles, aucune manquante lors du contrôle |
| Lecture réelle | Netflix, CANAL+ et Free TV : image et son confirmés par le propriétaire |
| Touche Home physique | Retour au nouvel accueil confirmé depuis ces applications |
| Autres modèles / autres firmwares | Non testés |
| Démarrage automatique | Scripts préparés ; démarrage à froid final non confirmé |

Ces observations concernent l’installation C9 à l’origine de ce dépôt. La version distribuée conserve le code de cette interface, avec des valeurs par défaut génériques : météo désactivée et icônes privées retirées. Elle doit être validée sur chaque nouvelle TV.

## Installation

1. Lire [le guide d’installation](docs/INSTALLATION.fr.md), en particulier les différences entre Developer Mode et root.
2. Utiliser [le prompt complet à copier dans un agent](PROMPT-INSTALLATION.fr.md) pour une installation accompagnée, adaptée au modèle réel.
3. Compiler le paquet ou récupérer l’artefact IPK d’un workflow GitHub Actions réussi.
4. Installer et tester d’abord l’application seule. Configurer Home et le démarrage seulement après vérification de la lecture vidéo.

**Ce projet ne transforme pas une C9 en webOS 10.** Il s’agit d’une application d’accueil pour webOS. Les scripts Android/ADB de CleanYourTV ne s’appliquent pas à LG webOS.

### Construire

Node.js 22 recommandé pour cette configuration de dépendances.

```sh
npm ci
npm test
npm run pack
```

Le paquet est produit dans `dist/org.webosbrew.lounge.launcher_0.0.120_all.ipk`. `npm run pack` vérifie également les dates des fichiers contenus dans l’IPK. Les workflows CI construisent le paquet et publient un artefact téléchargeable ; un tag `v*` crée une release avec IPK et SHA-256.

### Identifiant d’application

L’identifiant reste `org.webosbrew.lounge.launcher`, pour conserver les interfaces et scripts hérités. **Installer cette variante remplace donc Launch Home s’il est déjà présent.** Exporter sa configuration et conserver son IPK avant installation. Ne pas essayer d’installer les deux comme deux applications distinctes.

### Météo et confidentialité

Activer la météo et choisir sa ville dans les réglages. La météo est désactivée à la première installation. L’API Open-Meteo reçoit la localisation choisie lors des requêtes météo ; consulter sa [politique de confidentialité](https://open-meteo.com/en/terms). Aucune adresse IP de TV, clé SSH, compte LG, sauvegarde de TV ou application personnelle n’est incluse dans ce dépôt.

Les fonctions avancées de Launch Home sont encore présentes dans le code source. Cette interface désactive la musique d’ambiance et les anciens watchers Home ; ne pas activer un second mécanisme de Home ou d’assistant vocal pendant l’installation.

## Retour arrière et dépannage

Voir [le guide](docs/INSTALLATION.fr.md#retour-arrière) et [le compte rendu technique](docs/TESTED-C9.fr.md). Ne pas réinitialiser la TV ou désinstaller ses services de streaming pour changer un accueil.

## Origines et licences

- Base : [gprot42/webos-launch-home](https://github.com/gprot42/webos-launch-home), commit `51b901508dfc69e6fed492d61c2aeb1d4ef5f595`, MIT. Licence conservée dans [LICENSE](LICENSE), documentation originale dans [docs/UPSTREAM-README.md](docs/UPSTREAM-README.md).
- Inspiration : [Gathin23/cleanyourtv](https://github.com/Gathin23/cleanyourtv), MIT. Notice conservée dans `assets/fonts/CleanYourTV-LICENSE.txt`. Aucune compatibilité avec son installateur Android n’est revendiquée.
- Police Outfit : SIL Open Font License, notice dans `assets/fonts/Outfit-LICENSE-OFL.txt`.
- Les noms et logos des applications appartiennent à leurs titulaires ; voir [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Projet communautaire, sans affiliation à LG, Apple, Netflix ou CleanYourTV.
