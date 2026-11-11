# GymBro Analytics

Plateforme web d'analyse de données de musculation et de surcharge progressive, développée sur-mesure pour exploiter les exports de l'application **Liftoff**.

## Caractéristiques & Fonctionnalités

* **Design Sobre & Épuré** : Palette feutrée Dark Mode, zéro emoji, zéro effet néon, typographie soignée avec alignement tabulaire des chiffres (`tabular-nums font-mono`).
* **Ingestion & Persistance Serveur (`data/`)** :
  * Aucune donnée personnelle n'est versionnée dans le dépôt : importez votre export Liftoff directement via glisser-déposer ou le bouton « Importer CSV ».
  * Persistance côté serveur du CSV (`data/workout_data.csv`), des objectifs (`data/goals.json`) et réglages (`data/settings.json`) synchronisés entre tous vos appareils.
* **Nettoyage & Normalisation Robuste** :
  * Filtrage automatique des séances vides.
  * Isolation des activités de plein air (`Randonnée`, `Marche`) pour ne pas fausser les métriques de musculation.
  * Détection mathématique des séries d'échauffement ($< 65\%$ du top set) avec switch d'exclusion.
  * Unification et conversion dynamique `lbs` $\leftrightarrow$ `kg` avec arrondi intelligent.
  * Inférence automatique du split (`Push`, `Pull`, `Legs`, `Upper`, `Full Body`).
* **Les 6 Espaces d'Analyse** :
  1. **Vue d'ensemble (`Overview`)** : KPIs clés (séries effectives/semaine, tonnage total, durée moyenne), calendrier interactif mensuel (avec retour en arrière et accès direct aux séances), comparateur `Bloc Reprise 2026 vs Bloc Initial 2024-2025`, aperçu des objectifs en cours et fil des records personnels (PRs).
  2. **Analyse par exercice (`Exercise Deep-Dive`)** : Courbes d'évolution (1RM estimé Epley, Top Set trié par Charge × Réps, volume), prise en compte du poids de corps pour la charge nette sur exercices assistés (`Dips`, `Tractions`), ligne de mire d'objectif, tableau des PRs par paliers de réps et notes de réglages machines.
  3. **Équilibre musculaire (`Muscle Balance`)** : Carte anatomique interactive (face & dos) colorée selon le volume hebdomadaire, radar d'équilibre musculaire (pondération $1.0$ muscle primaire / $0.5$ synergistes) et barre de ratio Push/Pull/Legs.
  4. **Surcharge & Fatigue (`Progression & Fatigue`)** : Diagnostic de surcharge progressive purement mathématique (statuts `Progression`, `Plateau`, `Baisse`), calcul de l'objectif cible pour la prochaine séance en double progression, et analyse de chute de répétitions (fatigue intra-séance).
  5. **Objectifs (`Goals`)** : Définition de cibles personnalisées (1RM ou Top Set avant une date donnée) avec suivi d'avancement en temps réel.
  6. **Journal des séances (`Workout Log`)** : Timeline chronologique détaillée avec filtres par split, détail des séries, temps de repos/secondes et notes personnelles de réglages machines.

## Lancement local

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement (port 3000)
npm run dev

# Build et lancement en production sur le port 3005 (ex: Raspberry Pi)
npm run build
npm run start:pi
```

## Déploiement Raspberry Pi (Tailscale)

Des modèles prêts à l'emploi sont fournis dans `deploy/` (`deploy/gymbro.service` configuré sur le port `3005` par défaut via `PORT=3005` et `deploy/update.sh`).
