## Objectif

Remplacer le code d'invitation unique par **4 codes distincts**, chacun donnant un niveau d'accès différent, et permettre au propriétaire de changer le niveau d'un membre à tout moment (y compris en mode personnalisé par onglet).

## Les 4 niveaux d'accès

| Niveau | Description |
|---|---|
| **Lecture seule** | Peut voir tous les onglets, ne peut rien modifier |
| **Éditeur** | Peut modifier planning, agents, paramètres, roulement, sauvegardes (comme aujourd'hui) |
| **Administrateur** | Éditeur + gestion de l'équipe, des titres, des codes, du blocage |
| **Personnalisé** | Le propriétaire choisit onglet par onglet : *Masqué* / *Lecture* / *Édition* |

Le **Propriétaire** (créateur de l'équipe) reste au-dessus, immuable.

## Onglet Équipe — refonte de la carte "Code d'invitation"

Remplacée par 4 blocs de code (un par niveau), chacun avec :
- Un code à 6 chiffres unique et distinct
- Boutons **Copier**, **Partager**, **Régénérer** (indépendants)
- Une pastille de couleur pour le niveau (lecture/éditeur/admin/perso)

Rejoindre : l'invité entre n'importe lequel de ces codes ; le niveau est déduit du code utilisé.

Pour le niveau **Personnalisé**, après approbation, le propriétaire ouvre une petite fenêtre listant les 10 onglets (Planning, Stats, Roulement, Paramètres, Agents, Modifs, Heures sup, Impression, Équipe, QR) avec pour chacun un choix Masqué / Lecture / Édition.

## Gestion des membres (liste existante)

Ajout d'un sélecteur de niveau à côté de chaque membre actif :
- Lecture seule / Éditeur / Administrateur / Personnalisé
- Le choix « Personnalisé » ouvre le panneau de permissions par onglet
- Modification appliquée en direct (le membre voit son accès changer au prochain rafraîchissement)

Le propriétaire ne peut pas être rétrogradé (protection).

## Application des droits dans l'app

- **Lecture seule** → `canEdit=false` global (déjà supporté par `PlanningProvider writable`)
- **Éditeur** → comme aujourd'hui
- **Administrateur** → comme éditeur + accès complet à l'onglet Équipe
- **Personnalisé** → chaque onglet lit sa permission :
  - *Masqué* : l'onglet disparaît de la barre de navigation
  - *Lecture* : l'onglet est visible mais tous les contrôles d'édition sont désactivés
  - *Édition* : accès normal

## Détails techniques

**Base de données**
- `workspaces` : ajout de `invite_code_viewer`, `invite_code_editor`, `invite_code_admin`, `invite_code_custom` (text, uniques). Migration copie l'`invite_code` existant vers `invite_code_editor` pour ne rien casser.
- `workspace_members` : le champ `role` passe à `enum(owner, admin, editor, viewer, custom)` ; ajout d'une colonne `tab_permissions jsonb` (utilisée uniquement quand role='custom').
- RPC `join_workspace(_code)` : cherche le code parmi les 4 colonnes, attribue le rôle correspondant, statut `pending`.
- RPC `regenerate_invite_code(_workspace, _level)` : régénère uniquement le code du niveau demandé.
- Politiques RLS mises à jour : `admin` a les mêmes droits d'écriture que `owner` sur `workspace_members` et `workspace_email_blocklist` ; `custom` et `viewer` ne peuvent que lire.

**Front**
- `workspace-context.tsx` : expose les 4 codes, `updateMemberLevel(userId, level, tabPermissions?)`, `regenerateCode(level)`.
- `TeamTab.tsx` : nouvelle section "Codes d'invitation" à 4 blocs + sélecteur de niveau par membre + dialog permissions personnalisées.
- `PlanningApp.tsx` : lit `tabPermissions` depuis le contexte et cache/désactive les onglets en conséquence ; `canEdit` devient dérivé par onglet.

## Ce qui ne change pas

- Le flux d'approbation (`pending` → `active`) et le blocage restent identiques.
- Les codes existants restent valides (migrés vers "Éditeur").
- Aucun changement sur les données de planning, agents, roulement, etc.
