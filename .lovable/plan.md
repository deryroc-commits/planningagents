# Onglet « Équipe & Partage »

Objectif : reproduire l'écran de l'image dans l'application Planning — comptes utilisateurs, workspaces (équipes) avec code d'invitation à 6 chiffres, liste des membres avec rôles (OWNER / Éditeur / Lecteur), et un planning propre à chaque workspace.

## Ce qui change pour l'utilisateur

```text
Aujourd'hui : on ouvre l'app → tout le monde voit le même planning (anonyme)
Demain      : on se connecte → on choisit/crée une équipe → on voit le planning de cette équipe
              on partage un code à 6 chiffres pour inviter d'autres membres
```

- Connexion par **email/mot de passe + Google** (page `/auth`).
- Chaque personne peut **créer une équipe** (elle en devient OWNER) ou **en rejoindre une** avec un code à 6 chiffres.
- Chaque équipe a **son propre planning** (agents, postes, roulement, heures supp., etc.), synchronisé en temps réel entre tous ses membres.
- Un onglet **Équipe** affiche : le code d'invitation (copier / partager / régénérer), le champ « Rejoindre un workspace », et la liste des membres avec leur rôle.

## Rôles

- **OWNER** : gère l'équipe, les membres et leurs rôles, régénère le code, peut tout éditer.
- **Éditeur** : modifie le planning.
- **Lecteur** : consulte uniquement.

## Étapes

### 1. Base de données (migration)
- `profiles` — nom affiché + email, créé automatiquement à l'inscription.
- `app_role` (enum : owner, editor, viewer).
- `workspaces` — nom, code d'invitation à 6 chiffres unique, propriétaire.
- `workspace_members` — lien membre ↔ workspace + rôle + date d'arrivée.
- `workspace_planning` — le planning (JSON) propre à chaque workspace (remplace l'espace unique actuel).
- Fonctions `security definer` (`is_workspace_member`, `has_workspace_role`) pour éviter la récursion RLS.
- Policies RLS : chaque membre lit/écrit le planning et voit les membres de ses équipes ; seul l'OWNER gère les membres et le code.

### 2. Authentification
- Activation Google + email/mot de passe.
- Page `/auth` (connexion / inscription) et protection des routes de l'app.
- En-tête avec l'utilisateur connecté et le bouton de déconnexion.

### 3. Sélection de workspace
- Écran « Créer une équipe / Rejoindre avec un code » quand on n'a pas encore d'équipe.
- Sélecteur d'équipe active dans l'en-tête si on appartient à plusieurs.

### 4. Onglet « Équipe »
- Carte **Code d'invitation** : affichage du code, boutons Copier / Partager / Régénérer (OWNER).
- Carte **Rejoindre un workspace** : champ code + bouton Rejoindre.
- Carte **Membres** : liste avec avatar, nom, date d'arrivée, badge de rôle, et gestion des rôles / retrait (OWNER).

### 5. Planning par équipe
- Le store de planning lit/écrit désormais `workspace_planning` de l'équipe active (au lieu de l'espace unique `main`).
- Synchronisation temps réel conservée, scoping par workspace.

### 6. Migration des données existantes
- Reprise du planning partagé actuel dans une première équipe par défaut, pour ne rien perdre.

## Points techniques
- Nouvelles tables sécurisées par RLS, scoping via `auth.uid()` et appartenance au workspace.
- Rôles stockés dans `workspace_members` (jamais sur le profil) pour éviter l'élévation de privilèges.
- Code d'invitation régénérable ; unicité garantie côté base.
- Store de planning migré de l'espace unique vers un espace par workspace, sync temps réel conservée.

Dis-moi si je valide ce plan et je commence par la base de données.