# Déployer Planning Agents sur Vercel

Cette application n'est pas un site statique : c'est une app TanStack Start avec
rendu serveur (SSR) et fonctions serveur. Il faut donc un hébergeur capable
d'exécuter du code serveur — Vercel convient, GitHub Pages non (le workflow
Pages a été supprimé).

## 1. Importer le projet

1. Sur vercel.com → **Add New… → Project** → importer le dépôt GitHub.
2. Framework Preset : **Other** (la config est déjà fournie par `vercel.json`).
   - Install : `npm install`
   - Build : `npm run build:vercel`
   - Output : `.vercel/output`

## 2. Variables d'environnement (obligatoires)

À ajouter dans **Settings → Environment Variables** (Production + Preview) :

| Nom | Valeur |
| --- | --- |
| `VITE_SUPABASE_URL` | même valeur que dans le fichier `.env` du projet |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | même valeur que dans `.env` |
| `VITE_SUPABASE_PROJECT_ID` | même valeur que dans `.env` |

Ces clés sont publiques (protégées par les règles RLS de la base). La base de
données, l'authentification et le stockage restent hébergés par Lovable Cloud :
l'app déployée sur Vercel s'y connecte via ces clés.

## 3. Déployer

Cliquer sur **Deploy**. Chaque `git push` sur la branche principale relance un
déploiement automatique.

## 4. Domaine personnalisé

**Settings → Domains** → ajouter `planningdesagents.duvalericlabs.com` et suivre
les enregistrements DNS proposés. Pensez à mettre ce domaine dans les URL de
redirection d'authentification pour que la connexion Google fonctionne.

## Points d'attention

- Ne pas déployer uniquement le dossier `dist` : le build serveur complet
  (`.vercel/output`) est nécessaire, sinon Vercel renvoie une **erreur 404**.
- Le bouton **Publier** de Lovable reste la voie la plus simple : il déploie
  déjà l'app complète sans configuration.
