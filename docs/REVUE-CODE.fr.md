# Revue de la version 0.0.121 — 23 octobre 2026

## Vérifications réalisées

- 40 tests automatisés réussis, dont le retour de la météo après un défilement natif différé, le changement de date du bloc fête/verset et l’affichage de textes non fiables sans interprétation HTML.
- Construction du lanceur et de la carte vocale, puis contrôle de l’IPK : identifiant, version et dates des archives.
- Dépendances de test et de compilation actualisées ; CI configurée sur Node 24.
- Valeurs privées de la TV, sauvegardes, clefs et adresse Home Assistant exclues de la distribution. Le bloc Home Assistant est facultatif et désactivé par défaut.
- Ancien paquet retiré du répertoire de téléchargement actuel, conservé dans l’historique Git pour retour arrière.

## Résultat de l’audit des dépendances

`npm audit --omit=dev` ne signale aucune vulnérabilité connue à la date du contrôle.

L’audit complet conserve **trois alertes dans les dépendances de développement du CLI LG 3.2.6** : `brace-expansion` (haute), `proxy-addr` (critique), `qs` (modérée). La version publiée par LG utilise un shrinkwrap qui conserve ces versions malgré les overrides demandés. Les mises à jour standard ont réduit les 19 alertes initiales à ces trois alertes. Elles sont déclarées ici, pas considérées comme corrigées.

Ces bibliothèques appartiennent aux outils Node utilisés sur l’ordinateur et ne sont pas embarquées dans le JavaScript du lanceur. La construction utilise le CLI local pour empaqueter les fichiers. Ne pas exposer de serveur de développement ou d’inspection fourni par ce CLI à un réseau non fiable. Une nouvelle version du CLI devra être auditée et la construction revalidée lorsqu’un correctif amont sera disponible.

L’audit de dépendances et les tests ne constituent pas un audit exhaustif de sécurité. Les fonctions historiques d’administration et de lancement de commandes de Launch Home existent encore ; elles sont sensibles sur une TV rootée et leurs conditions d’installation restent celles du guide.

## Limites de validation

La lecture Netflix, CANAL+, Free TV et la touche Home ont été validées par le propriétaire sur l’installation C9 d’origine. Les nouveaux visuels météo ont été contrôlés sur cette installation ; la dernière vérification physique du retour à l’accueil après les ajouts de l’horloge attend encore le retour du propriétaire. L’IPK public générique 0.0.121 a été compilé et contrôlé, mais n’a pas été réinstallé sur une autre TV. Aucun autre modèle ni démarrage à froid supplémentaire n’est déclaré validé.
