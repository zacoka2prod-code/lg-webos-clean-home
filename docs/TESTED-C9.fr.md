# Retour d’expérience — C9

Configuration d’origine : OLED55C9PLA, firmware 05.50.00, webOS 4.10.2-31. Interface dérivée de Launch Home 0.0.120, testée avec Homebrew Channel et accès root.

## Interface

Le catalogue complet a été comparé aux applications visibles : 28 applications autres que le lanceur, aucune manquante. Défilement jusqu’à la dernière ligne, navigation du focus et icônes contrôlés. Les noms, applications personnelles et icônes récupérées de cette TV ne font pas partie du paquet public.

## Lecture vidéo

Une panne de lecture a touché Netflix, CANAL+, Free TV et YouTube pendant les travaux. Fermer le lanceur et relancer les services audio/vidéo n’a pas suffi. Après sauvegarde, désinstallation explicitement autorisée de Developer Mode conformément aux instructions faultmanager, et redémarrage complet, Netflix a retrouvé image et son. La cause initiale exacte n’a pas été établie.

L’intégration Home a ensuite été restreinte à une injection lginputhook dans `lginput2` seulement ; aucun watcher permanent et aucune injection dans `tvservice`. Le propriétaire a finalement confirmé : **Netflix, CANAL+ et Free TV lisent les vidéos, et Home revient au nouvel accueil**. Ce résultat ne permet pas d’attribuer avec certitude la panne antérieure à un composant précis.

## Limites

Les scripts de démarrage ont été configurés ; le démarrage à froid final n’a pas fait l’objet d’une confirmation séparée. Le paquet générique supprime les valeurs et icônes privées de l’installation d’origine. Aucune autre TV n’a été validée. Tester chaque nouvelle installation avant de remplacer durablement Home.
