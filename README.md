# Planning Agents

Crée une application web complète de gestion de planning des agents inspirée d’un fichier Excel complexe (format XLSB) utilisé pour la planification annuelle UCPA.

🎯 Objectif

Reproduire fidèlement le fonctionnement du fichier Excel :

gestion d’un planning annuel (janvier → décembre)

saisie contrôlée des postes et absences

calcul automatique des heures

contrôle des erreurs

visualisation claire type tableau Excel

export et impression

🧱 Structure de l’application

1. Gestion des données

Import d’un fichier Excel .xlsb

Parsing complet :

feuilles (planning, base agents, paramètres, impression…)

données, formules, listes déroulantes

Stockage interne (JSON ou base de données)

2. Onglets à reproduire

✅ Onglet “Planning”

Grille annuelle avec :

lignes = agents

colonnes = jours (1 → 365/366)

affichage des jours (L, M, Me, J, V, S, D)

Saisie des valeurs uniquement via liste contrôlée (comme validation Excel)

✅ Onglet “Paramètres”

Liste des codes autorisés :

Exemples :

T = Travail (7.5h)

CA = Congé annuel

RH = Repos hebdomadaire

CM = Maladie

MP = Maladie professionnelle

CH = Congé hiver

etc.

Chaque code contient :

libellé

nombre d’heures (ex: 7.5 ou 0)

✅ Onglet “Base agents”

Liste des agents

Possibilité d’ajout / modification / suppression

✅ Onglet “Impression”

Vue formatée du planning mensuel

Mise en page imprimable

⚙️ Règles métier à implémenter

✅ Saisie limitée aux valeurs définies dans “paramètres”

✅ Calcul automatique des heures par agent

✅ Total mensuel et annuel

✅ Détection d’erreurs :

cellules invalides

incohérences de planning

✅ Mise en évidence visuelle (équivalent cellules rouges Excel)

📊 Calculs à gérer

Total heures par agent

Total par mois

Total global

Conversion automatique selon le code (ex: T = 7.5h)

🧠 Logique spécifique à reproduire

Fonctionnement basé sur cycles :

“5 semaines de base avec 1 week-end sur 5”

Gestion des récupérations :

RHS, RF, RC…

Gestion des absences multiples

Gestion des postes (A1, A2, M1, M2, PL, etc.)

🎨 UI / UX

Interface type Excel :

tableau scrollable horizontal + vertical

gel des colonnes (noms agents)

gel des lignes (jours)

Saisie rapide :

dropdown sur chaque cellule

Couleurs :

rouge = erreur

gris = repos

vert = travail

Navigation par mois

📤 Export / Import

Import fichier .xlsb

Export :

Excel (.xlsx)

PDF (planning mensuel)

Impression directe

🔐 Contraintes techniques

Gérer les fichiers Excel binaires (.xlsb)

Reproduire les validations de données Excel

Remplacer les formules Excel par logique backend/frontend

💡 Bonus (optionnel mais recommandé)

Historique des modifications

Multi-utilisateurs

Sauvegarde automatique

Filtres (par agent, poste, absence)

Statistiques visuelles (graphiques)

🧩 Stack suggérée

Frontend : React / Next.js

Backend : Node.js ou Supabase

Parsing Excel : SheetJS (compatible XLSB)

UI : grille type Airtable / Excel

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://planningagents.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d08711b7-5453-4ef5-bcaf-c0701341420a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
