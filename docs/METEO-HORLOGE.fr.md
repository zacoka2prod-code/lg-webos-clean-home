# Météo animée et horloge — 0.0.121

## Météo

Dans les réglages, activer la météo et choisir la ville. La carte affiche les conditions actuelles et six prévisions horaires : température, symbole météo et précipitations en millimètres. Le vent actuel est affiché en km/h.

Le fond change selon les conditions et le jour ou la nuit. Les effets de pluie, soleil, nuages, neige et vent sont réalisés en CSS, sans lecteur vidéo ni son. L’animation de vent apparaît à partir de 25 km/h. La préférence système de réduction des animations est respectée.

La carte se masque en descendant dans les applications et revient à la première rangée. Les données Open-Meteo sont mises en cache, actualisées toutes les quinze minutes lorsque l’accueil est visible. Sans connexion, les dernières données peuvent être anciennes ; il ne s’agit pas d’une observation en continu.

## Fête et verset depuis Home Assistant — facultatif

La version publique ne contient aucune adresse Home Assistant ni identifiant. Cette fonction est désactivée par défaut. Elle lit seulement un fichier JSON d’affichage fourni par l’utilisateur ; elle ne contrôle aucun appareil Home Assistant.

Dans l’export JSON des réglages de Launch Home, ajouter ce bloc à la racine, en remplaçant l’adresse par celle de votre serveur, puis importer les réglages :

```json
{
  "dailyClock": {
    "enabled": true,
    "endpoint": "https://votre-serveur.example/clean-home/clock.json"
  }
}
```

Conserver toutes les autres propriétés de l’export. Pour désactiver, remettre `enabled` à `false`. L’endpoint doit répondre sans jeton intégré à l’URL. Pour une URL HTTP locale, le contenu circule sans chiffrement ; privilégier HTTPS lorsqu’il est disponible. Ne jamais publier des secrets dans ce fichier.

Contrat JSON (date et texte à renouveler quotidiennement) :

```json
{
  "date": "2026-10-23",
  "timezone": "Europe/Paris",
  "saint": "Saint Jean de Capistran",
  "saintDate": "2026-10-23",
  "verse": "Réjouissez-vous toujours dans le Seigneur ; je le répète, réjouissez-vous.",
  "reference": "Philippiens 4:4",
  "edition": "Louis Segond 1910"
}
```

L’heure affichée reste celle de la TV et de son réglage de fuseau horaire : le fichier ne règle pas l’horloge du système. Régler le même fuseau dans Home Assistant et sur la TV. Le texte est affiché avec `textContent`, jamais exécuté comme du HTML. Les réponses de plus de 64 Kio sont ignorées. Le contrôle quotidien empêche de présenter les informations de la veille comme celles du jour.

La synchronisation automatique du capteur et du verset a été réalisée sur l’installation C9 d’origine avec un export local spécifique. Ce service privé n’est pas distribué et n’est pas installé par l’IPK public. Pour votre installation, fournir cet endpoint à partir de vos propres données Home Assistant, avec un export qui ne divulgue que les champs d’affichage.
