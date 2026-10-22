# Exemples avancés C9

Ces fichiers proviennent de l’intégration C9 testée. Ils ne sont pas exécutés par le build ni installés automatiquement.

Lire [le guide complet](../../docs/INSTALLATION.fr.md#4-home-et-démarrage--option-avancée). Ils supposent un root fonctionnel, Homebrew Channel, la disposition de fichiers lginputhook correspondante, un service lginputhook déjà limité à `lginput2` et une configuration de touche physique vérifiée. Le script de touche Home n’écrit pas lui-même le fichier keybinds.json.

Ne pas copier ces scripts à l’aveugle sur un autre firmware. Sauvegarder les scripts existants avant toute installation. Pour neutraliser ceux-ci, retirer leur droit d’exécution ou les déplacer hors de init.d ; restaurer séparément l’ancienne entrée Home. Une bibliothèque déjà injectée reste chargée jusqu’au redémarrage du processus/de la TV.
