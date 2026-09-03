import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Table2,
  BarChart3,
  CalendarClock,
  Settings2,
  Users,
  PencilLine,
  Clock,
  Printer,
  QrCode,
  Download,
  Trash2,
  HelpCircle,
  Keyboard,
  Smartphone,
  ArrowRight,
  Copy,
  MousePointer2,
  WifiOff,
  ShieldCheck,
  Type,
  CalendarRange,
  Save,
  FileSpreadsheet,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Section = {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  intro: string;
  steps: { title: string; text: string }[];
  tips?: string[];
};

const SECTIONS: Section[] = [
  {
    id: "demarrage",
    title: "Démarrage rapide",
    icon: HelpCircle,
    intro:
      "L'application permet de planifier l'année des agents, de suivre les heures et d'imprimer les plannings. Chaque équipe (workspace) est indépendante.",
    steps: [
      {
        title: "Se connecter ou créer un compte",
        text: "À l'ouverture, la page de connexion s'affiche automatiquement. Créez un compte par e-mail + mot de passe, ou connectez-vous en un clic via Google, Microsoft ou Apple.",
      },
      {
        title: "Connexion Google, Microsoft ou Apple",
        text: "Cliquez sur le bouton du fournisseur de votre choix : une fenêtre sécurisée s'ouvre pour valider votre identité. Aucun mot de passe à créer dans l'application. Si votre compte a été créé via l'un de ces fournisseurs, vous pouvez définir un mot de passe secondaire depuis la carte « Mon mot de passe » (onglet Équipe) pour aussi vous connecter par e-mail.",
      },
      {
        title: "Rejoindre une équipe ou en créer une",
        text: "Avec un code d'invitation à 6 chiffres fourni par un administrateur, vous rejoignez une équipe existante (accès validé manuellement). Sans code, vous créez votre propre planning vierge dont vous devenez administrateur.",
      },
      {
        title: "Personnaliser les titres",
        text: "À la création d'une équipe, choisissez le titre principal, le sous-titre et le titre d'impression. Ils sont modifiables ensuite dans Paramètres.",
      },
      {
        title: "Choisir l'année",
        text: "En haut à droite, sélectionnez l'année à planifier. Toutes les données (planning, roulement, paramètres) sont enregistrées par année et conservées d'une année à l'autre.",
      },
    ],
    tips: [
      "Les données sont sauvegardées automatiquement dans le cloud pour toute votre équipe.",
      "Le mode hors-ligne permet de continuer à travailler sans connexion : les modifications se synchronisent au retour du réseau.",
    ],
  },
  {
    id: "acces",
    title: "Accès & sécurité (4 codes d'invitation)",
    icon: ShieldCheck,
    intro:
      "Chaque équipe dispose de 4 codes d'invitation distincts à 6 chiffres, un par niveau d'accès. Le code utilisé détermine automatiquement les droits accordés au nouveau membre.",
    steps: [
      {
        title: "Les 4 niveaux",
        text: "Lecteur (consultation seule), Éditeur (modification classique), Administrateur (édition + gestion des membres et des codes), Personnalisé (droits choisis onglet par onglet par le propriétaire).",
      },
      {
        title: "Obtenir un code",
        text: "Depuis l'onglet Équipe & partage, chaque niveau a son propre bloc avec les boutons Copier / Partager / Régénérer. Le propriétaire ou un administrateur transmet le code correspondant au niveau voulu.",
      },
      {
        title: "Utiliser le code",
        text: "Lors de la création du compte, saisissez n'importe lequel des 4 codes : le rôle est déduit automatiquement. La demande passe en statut « en attente » jusqu'à validation.",
      },
      {
        title: "Suivre son statut",
        text: "L'onglet Équipe affiche la bannière « Mon statut d'accès » : en attente, actif ou refusé (avec la raison le cas échéant).",
      },
      {
        title: "Créer un planning indépendant",
        text: "Sans code, votre compte crée un nouveau planning entièrement vierge. Vous en devenez automatiquement le propriétaire, avec vos 4 codes générés.",
      },
    ],
    tips: [
      "Régénérer un code n'invalide que celui-ci : les 3 autres restent actifs.",
      "Chaque planning est totalement isolé : aucune donnée n'est partagée entre équipes.",
    ],
  },
  {
    id: "comptes",
    title: "Comptes & connexions multiples",
    icon: Users,
    intro:
      "Vos plannings ne sont pas attachés à une méthode de connexion (Google, Microsoft, Apple ou e-mail), mais à votre compte utilisateur et à l'équipe (workspace).",
    steps: [
      {
        title: "Même adresse e-mail = même compte",
        text: "Si vous vous connectez avec Google puis avec Microsoft en utilisant la même adresse e-mail, Supabase reconnaît un seul et même compte. Vous retrouvez exactement les mêmes équipes, plannings et paramètres.",
      },
      {
        title: "E-mail différent = compte différent",
        text: "Une nouvelle adresse e-mail crée un nouveau compte et donc un nouveau workspace vierge. Pour rejoindre un planning existant, utilisez le code d'invitation fourni par l'administrateur avec cette nouvelle adresse.",
      },
      {
        title: "Synchronisation automatique",
        text: "Toute modification faite depuis n'importe quel appareil ou méthode de connexion est synchronisée en temps réel dans le cloud pour tous les membres de l'équipe (selon leurs droits).",
      },
      {
        title: "Adresse de secours (redirection automatique)",
        text: "Si votre domaine personnel (erick-duvall-app.fr) est bloqué par le réseau professionnel, la page de connexion détecte le blocage et vous redirige automatiquement vers l'adresse de secours planningagentsucpa.lovable.app. Vous y retrouvez les mêmes comptes et données ; l'accès reste soumis à l'autorisation de l'administrateur (code d'invitation).",
      },
    ],
    tips: [
      "Vous pouvez définir un mot de passe secondaire depuis l'onglet Équipe pour aussi vous connecter par e-mail.",
      "L'adresse de secours est identique quel que soit le fournisseur utilisé (Google, Microsoft, Apple, e-mail).",
    ],
  },
  {
    id: "mot-de-passe",
    title: "Mot de passe (changement & réinitialisation)",
    icon: ShieldCheck,
    intro:
      "Deux options permettent de gérer votre mot de passe : le changement direct depuis l'application et la réinitialisation par e-mail depuis la page de connexion.",
    steps: [
      {
        title: "Changer son mot de passe (connecté)",
        text: "Onglet Équipe & partage → carte « Mon mot de passe » : saisissez le nouveau mot de passe (6 caractères minimum) et sa confirmation, puis validez. Le changement est immédiat.",
      },
      {
        title: "Mot de passe oublié",
        text: "Sur la page de connexion, cliquez « Mot de passe oublié ? », saisissez votre e-mail : un lien de réinitialisation vous est envoyé. Ce lien rouvre l'application sur un écran dédié pour choisir un nouveau mot de passe.",
      },
      {
        title: "Comptes créés via Google, Microsoft ou Apple",
        text: "Si votre compte a été créé avec Google, Microsoft ou Apple, définissez un mot de passe depuis la carte « Mon mot de passe » : vous pourrez ensuite aussi vous connecter par e-mail + mot de passe.",
      },
    ],
    tips: [
      "Le nouveau mot de passe est actif immédiatement sur tous vos appareils.",
      "Le lien de réinitialisation est à usage unique : redemandez-le s'il a expiré.",
    ],
  },
  {
    id: "planning",
    title: "Planning Général",
    icon: Table2,
    intro:
      "Le planning affiche un mois complet avec un agent par ligne et un jour par colonne. Vous saisissez un code par cellule (ex : M pour matin, R pour repos).",
    steps: [
      {
        title: "Sélectionner un mois",
        text: "Utilisez le menu déroulant ou les flèches gauche/droite. L'option « Transition » affiche décembre + les premières semaines de janvier de l'année suivante.",
      },
      {
        title: "Saisir un code",
        text: "Cliquez sur une cellule pour ouvrir la palette des codes autorisés. Choisissez le code : il s'affiche avec la couleur associée.",
      },
      {
        title: "Défiler horizontalement (mobile)",
        text: "Sur téléphone, faites glisser le tableau vers la gauche/droite. La colonne « Agent » reste toujours visible à gauche.",
      },
      {
        title: "Repérer les erreurs",
        text: "Les valeurs non reconnues apparaissent en rouge. Le compteur en haut à droite indique combien de corrections sont nécessaires.",
      },
    ],
    tips: [
      "Les lignes d'agents vides ou nommés « 0 » sont automatiquement masquées partout (planning, stats, impression).",
      "Les week-ends et jours fériés sont pré-coloriés pour vous repérer rapidement.",
    ],
  },
  {
    id: "copier-coller",
    title: "Sélection, copier-coller & recopie",
    icon: Copy,
    intro:
      "Le planning fonctionne comme un tableur : sélection de plages, copier-coller et poignée de recopie (fill handle) sont disponibles.",
    steps: [
      {
        title: "Sélectionner une plage",
        text: "Cliquez sur une cellule puis glissez avec la souris (ou le doigt) pour étendre la sélection à un rectangle de cellules.",
      },
      {
        title: "Copier / coller",
        text: "Utilisez Ctrl+C (Cmd+C) pour copier la plage puis Ctrl+V (Cmd+V) pour coller à partir de la cellule sélectionnée. Le motif copié se répète si la zone de destination est plus grande.",
      },
      {
        title: "Poignée de recopie (glisser-déposer)",
        text: "Un petit carré bleu en bas à droite de la cellule active permet de tirer verticalement ou horizontalement pour recopier la valeur, comme dans Excel.",
      },
    ],
    tips: [
      "La sélection fonctionne aussi au clavier : maintenez Shift et cliquez sur une autre cellule pour étendre la plage.",
      "Le copier-coller respecte les codes autorisés : une valeur invalide s'affiche en rouge.",
    ],
  },
  {
    id: "stats",
    title: "Statistiques",
    icon: BarChart3,
    intro:
      "Vue analytique des heures effectuées par chaque agent, par mois et par semaine.",
    steps: [
      {
        title: "Consulter les totaux",
        text: "Chaque ligne agent affiche le cumul d'heures et de postes selon les codes saisis dans le planning.",
      },
      {
        title: "Comparer les mois",
        text: "Le tableau affiche les 12 mois côte à côte : vous voyez immédiatement les écarts et pouvez équilibrer la charge.",
      },
    ],
    tips: ["La colonne agent reste sticky lors du défilement horizontal."],
  },
  {
    id: "rotation",
    title: "Roulement week-ends",
    icon: CalendarClock,
    intro:
      "Génère automatiquement un cycle « 1 week-end travaillé sur N » pour chaque agent, avec un roulement propre à chaque année.",
    steps: [
      {
        title: "Choisir l'année cible",
        text: "Le sélecteur d'année en haut de l'onglet permet de définir un roulement différent chaque année sans écraser l'historique.",
      },
      {
        title: "Définir la base",
        text: "Renseignez le premier week-end travaillé de chaque agent : le cycle est projeté sur l'année complète.",
      },
      {
        title: "Limiter dans le temps",
        text: "Une date de début et de fin optionnelles permettent d'appliquer un roulement seulement sur une période (ex : de septembre à décembre) tout en gardant l'historique précédent.",
      },
      {
        title: "Sauvegarder",
        text: "L'onglet Roulement dispose de sa propre barre de sauvegardes nommées, indépendante des sauvegardes de Planning et Paramètres.",
      },
    ],
  },
  {
    id: "params",
    title: "Paramètres",
    icon: Settings2,
    intro:
      "Personnalisez la liste des codes (libellés, heures, catégories), leurs couleurs et les titres du planning.",
    steps: [
      {
        title: "Ajouter / modifier un code",
        text: "Créez un code (ex : « M »), donnez-lui un libellé (« Matin »), un nombre d'heures et une catégorie (travail, repos, congé, absence…).",
      },
      {
        title: "Choisir une couleur",
        text: "Chaque catégorie dispose d'une palette. La couleur est reprise dans le planning, les statistiques et les exports.",
      },
      {
        title: "Titres du planning",
        text: "La carte « Titres du planning » (propriétaire uniquement) permet de modifier le titre principal, le sous-titre et le titre d'impression à tout moment.",
      },
    ],
    tips: [
      "Seuls les codes définis ici sont autorisés dans le planning.",
      "Lors de l'import d'un fichier Excel, vos codes personnalisés sont conservés et fusionnés avec ceux du fichier.",
    ],
  },
  {
    id: "titres",
    title: "Titres personnalisés",
    icon: Type,
    intro:
      "Chaque équipe peut personnaliser trois titres qui apparaissent dans l'application, à l'impression et dans l'export Excel.",
    steps: [
      {
        title: "À la création",
        text: "Lors de la création d'une nouvelle équipe, un formulaire propose de saisir le titre principal, le sous-titre et le titre d'impression.",
      },
      {
        title: "Modifier plus tard",
        text: "L'onglet Paramètres → « Titres du planning » permet au propriétaire de modifier ces trois valeurs à tout moment.",
      },
      {
        title: "Où apparaissent-ils ?",
        text: "Titre principal + sous-titre : page d'accueil et en-tête de l'application. Titre d'impression : bandeau des impressions et export Excel.",
      },
    ],
  },
  {
    id: "agents",
    title: "Base Agents",
    icon: Users,
    intro:
      "Gestion des agents : ajout, modification, ordre d'affichage, dates d'arrivée et de départ, tri global.",
    steps: [
      {
        title: "Ajouter un agent",
        text: "Cliquez sur « Ajouter un agent » et renseignez son nom, son équipe, sa date d'arrivée et éventuellement de départ.",
      },
      {
        title: "Modifier les dates directement",
        text: "Sur chaque ligne, cochez « Date d'arrivée » ou « Date de départ » pour afficher les sélecteurs mois/année et les modifier sans rouvrir de dialogue.",
      },
      {
        title: "Tri global",
        text: "Un sélecteur en haut de l'onglet propose 4 modes : Personnalisé (drag & drop), Alphabétique, Par équipe, Équipe + alphabétique. Ce tri s'applique partout dans l'application.",
      },
      {
        title: "Réorganiser (mode personnalisé)",
        text: "Utilisez les flèches ↑ ↓ ou glissez la poignée pour changer l'ordre. Cet ordre est repris dans tous les onglets.",
      },
    ],
    tips: [
      "Toutes les lignes et colonnes suivent l'agent : les correspondances (planning, stats, roulement, heures sup.) restent alignées quel que soit le tri.",
      "Un agent avec une date de départ n'apparaît plus dans les mois postérieurs, mais l'historique est conservé.",
    ],
  },
  {
    id: "lifecycle",
    title: "Arrivées / départs d'agents",
    icon: CalendarRange,
    intro:
      "Les modifications de la base agents peuvent être appliquées à partir d'un mois précis, jusqu'à un mois donné, ou définitivement, sans écraser les mois passés.",
    steps: [
      {
        title: "Ajouter avec date d'arrivée",
        text: "Choisissez le mois/année d'arrivée : l'agent n'apparaît que dans le planning à partir de cette date.",
      },
      {
        title: "Départ à une date donnée",
        text: "Renseignez la date de fin (ex : fin novembre) : les mois précédents restent inchangés, l'agent disparaît des mois suivants.",
      },
      {
        title: "Modification définitive",
        text: "Sans date de fin, la modification s'applique de la date d'arrivée jusqu'à aujourd'hui et pour l'avenir.",
      },
    ],
    tips: [
      "L'historique complet du planning est préservé même si un agent quitte l'équipe.",
    ],
  },
  {
    id: "mods",
    title: "Modifications",
    icon: PencilLine,
    intro:
      "Historique des changements récents sur le planning : qui a modifié quoi et quand.",
    steps: [
      {
        title: "Consulter le journal",
        text: "Chaque ligne indique la date, l'agent concerné, l'ancienne et la nouvelle valeur.",
      },
    ],
  },
  {
    id: "overtime",
    title: "Heures supplémentaires",
    icon: Clock,
    intro:
      "Suivi des heures supplémentaires cumulées par agent, avec seuils d'alerte.",
    steps: [
      {
        title: "Consulter le cumul",
        text: "Le tableau récapitule les heures supp. par mois et l'année en cours.",
      },
      {
        title: "Exporter",
        text: "Utilisez le bouton d'export pour récupérer le tableau au format Excel.",
      },
    ],
  },
  {
    id: "print",
    title: "Impression",
    icon: Printer,
    intro:
      "Aperçu du planning mois par mois, ajusté automatiquement au format A4, prêt à imprimer ou à enregistrer en PDF.",
    steps: [
      {
        title: "Choisir le mois",
        text: "Le sélecteur affiche l'aperçu exact tel qu'il sera imprimé.",
      },
      {
        title: "Imprimer",
        text: "Utilisez Ctrl+P (Cmd+P sur Mac). Le planning s'adapte à la page même sur petit écran (plus de mini-vignette).",
      },
      {
        title: "Titre affiché",
        text: "Le bandeau reprend le « Titre d'impression » défini dans Paramètres.",
      },
      {
        title: "Choisir l'imprimante",
        text: "Un sélecteur d'imprimante est disponible en haut de l'onglet Impression : il reprend les imprimantes enregistrées dans Paramètres → Imprimantes (système, Bluetooth, réseau IP).",
      },
      {
        title: "Ticket du jour",
        text: "Avec une imprimante Bluetooth ou réseau, le bouton « Ticket du jour » imprime un résumé compact des agents et de leurs codes pour la journée sélectionnée, sans passer par le PDF.",
      },
    ],
  },
  {
    id: "imprimantes",
    title: "Imprimantes (système, Bluetooth, réseau)",
    icon: Printer,
    intro:
      "La carte « Imprimantes » dans Paramètres permet d'enregistrer plusieurs imprimantes : la boîte de dialogue du navigateur, des imprimantes d'étiquettes Bluetooth et des imprimantes réseau IP. La liste est mémorisée dans le navigateur de l'appareil.",
    steps: [
      {
        title: "Système (navigateur)",
        text: "Imprimante par défaut toujours présente : elle ouvre la boîte de dialogue d'impression du navigateur (planning A4/A3, export PDF). Fonctionne sur tous les appareils.",
      },
      {
        title: "Bluetooth (ESC/POS ou TSPL)",
        text: "Cliquez sur « Bluetooth », puis « Appairer » pour choisir l'imprimante d'étiquettes. Sélectionnez le langage : ESC/POS pour les tickets, TSPL pour les étiquettes. Nécessite Chrome ou Edge en https (Web Bluetooth n'existe pas sur iPhone ni Firefox).",
      },
      {
        title: "Réseau IP",
        text: "Renseignez l'adresse IP et le port (9100 par défaut). Le navigateur ne peut pas ouvrir un port TCP brut : choisissez le transport HTTP si l'imprimante expose un service web, sinon passez par un agent local qui relaie vers le port 9100.",
      },
      {
        title: "Imprimante par défaut et étiquettes",
        text: "Chaque imprimante peut être marquée « Par défaut » (documents, planning) et/ou « Étiquettes par défaut » (tickets et étiquettes agents). Les deux réglages sont indépendants.",
      },
      {
        title: "Tester et supprimer",
        text: "Le bouton « Test impression » / « Test étiquette » envoie un ticket de contrôle. Les imprimantes ajoutées peuvent être renommées directement dans la liste ou supprimées ; l'imprimante système ne peut pas être retirée.",
      },
    ],
    tips: [
      "Les imprimantes sont propres à chaque navigateur/appareil : reconfigurez-les sur un nouveau téléphone ou PC.",
      "Si l'appairage échoue, vérifiez que l'imprimante est allumée, en mode Bluetooth et pas déjà connectée à un autre appareil.",
      "Pour un ticket lisible, préférez ESC/POS sur les imprimantes à rouleau et TSPL sur les imprimantes d'étiquettes prédécoupées.",
    ],
  },
  {
    id: "depannage-imprimantes",
    title: "Dépannage imprimantes",
    icon: Printer,
    intro:
      "Solutions aux problèmes courants rencontrés avec les imprimantes Bluetooth, réseau et les autorisations du navigateur.",
    steps: [
      {
        title: "Web Bluetooth non disponible",
        text: "L'appairage Bluetooth nécessite Chrome ou Edge sur Windows, macOS ou Android, avec une connexion sécurisée (https). Web Bluetooth n'existe pas sur iPhone/iPad, ni sur Firefox ni Safari. Utilisez un autre navigateur ou basculez sur une imprimante réseau IP.",
      },
      {
        title: "L'imprimante Bluetooth n'apparaît pas",
        text: "Vérifiez que l'imprimante est allumée, en mode jumelage (non connectée à un autre téléphone/PC) et proche de l'appareil. Si le navigateur laisse apparaître une liste vide, éteignez puis rallumez l'imprimante et recommencez.",
      },
      {
        title: "Erreur « Aucune caractéristique d'écriture trouvée »",
        text: "L'imprimante n'expose pas le service série Bluetooth attendu. Essayez le mode « receive text »/SPP si l'imprimante le propose, ou utilisez une application constructeur pour préparer l'appairage. Si le problème persiste, basculez sur une imprimante réseau.",
      },
      {
        title: "Ticket Bluetooth non imprimé",
        text: "Après appairage, le bouton « Test étiquette » doit imprimer un ticket de contrôle. Si rien ne sort, vérifiez le langage (ESC/POS pour rouleau, TSPL pour étiquettes prédécoupées), l'ouverture du capot et la présence du papier. Réappairez l'imprimante si nécessaire.",
      },
      {
        title: "Erreur réseau « Impossible d'ouvrir un port TCP brut »",
        text: "Un navigateur web ne peut pas se connecter directement au port 9100 TCP. Deux solutions : choisissez le transport HTTP si l'imprimante expose un service web, ou installez un agent local sur un PC du réseau qui relaie les requêtes HTTP vers le port 9100 de l'imprimante.",
      },
      {
        title: "Imprimante réseau HTTP : erreur 4xx/5xx",
        text: "L'imprimante a bien reçu la requête mais n'a pas pu la traiter. Vérifiez l'adresse IP, le port, le chemin du service et le format accepté (ESC/POS ou TSPL). Consultez la documentation de l'imprimante pour le endpoint d'impression brut.",
      },
      {
        title: "Autorisation de la caméra ou du Bluetooth refusée",
        text: "Chrome/Edge demande une autorisation utilisateur lors du premier appairage Bluetooth. Si vous avez cliqué sur « Refuser », ouvrez l'icône de cadenas à gauche de l'adresse, puis Sites → Bluetooth → Autoriser. Pour l'APK, assurez-vous que les permissions Bluetooth et localisation sont activées dans les paramètres Android.",
      },
      {
        title: "L'imprimante système (navigateur) ne fonctionne pas",
        text: "L'imprimante système repose sur la boîte de dialogue Ctrl+P du navigateur. Si rien n'apparaît, désactivez les bloqueurs de pop-up, vérifiez que l'imprimante est configurée dans le système et essayez un autre navigateur.",
      },
    ],
    tips: [
      "Notez le modèle de l'imprimante et le langage requis (ESC/POS ou TSPL) avant de contacter le support.",
      "Testez toujours avec le bouton « Test étiquette » avant d'imprimer un ticket réel.",
    ],
  },
  {
    id: "sauvegardes",
    title: "Sauvegardes nommées",
    icon: Save,
    intro:
      "Trois barres de sauvegarde indépendantes : Planning, Paramètres et Roulement. Chacune vous permet d'enregistrer des versions nommées et de les restaurer.",
    steps: [
      {
        title: "Créer une sauvegarde",
        text: "Dans la barre de sauvegarde de l'onglet concerné, cliquez sur « Sauvegarder », donnez un nom (ex : « Avant congés été 2026 »).",
      },
      {
        title: "Restaurer",
        text: "Sélectionnez une sauvegarde dans la liste et cliquez sur « Restaurer » : uniquement les données de cet onglet sont remplacées.",
      },
      {
        title: "Indépendance",
        text: "Une restauration de Planning n'affecte pas les Paramètres ni le Roulement, et inversement.",
      },
    ],
  },
  {
    id: "team",
    title: "Équipe & partage",
    icon: Users,
    intro:
      "Gérez les membres, changez leur niveau d'accès à tout moment et validez les demandes en attente. Les 4 codes d'invitation se trouvent en haut de l'onglet.",
    steps: [
      {
        title: "Inviter un membre",
        text: "Utilisez le bloc de code correspondant au niveau souhaité (Lecteur, Éditeur, Administrateur, Personnalisé) et transmettez-le. Chaque bloc dispose de Copier / Partager / Régénérer indépendants.",
      },
      {
        title: "Valider les demandes",
        text: "Les demandes en attente apparaissent dans une liste : approuvez, refusez (avec motif) ou révoquez un accès existant.",
      },
      {
        title: "Les 4 rôles",
        text: "Propriétaire (contrôle total, immuable), Administrateur (édition + gestion équipe/codes/blocage), Éditeur (édition des données), Lecteur (consultation seule), Personnalisé (droits par onglet).",
      },
      {
        title: "Changer le niveau d'un membre",
        text: "Un sélecteur à côté de chaque membre actif permet de basculer entre Lecteur / Éditeur / Administrateur / Personnalisé. Le changement est appliqué au prochain rafraîchissement côté membre.",
      },
      {
        title: "Bouton « Droits » (mode personnalisé)",
        text: "Le bouton Droits est toujours visible pour chaque membre non-propriétaire. Il ouvre une fenêtre listant tous les onglets (Planning, Stats, Roulement, Paramètres, Agents, Modifs, Heures sup, Impression, Équipe, QR) avec, pour chacun, 3 choix : Modifier, Lecture seule, Masqué.",
      },
      {
        title: "Effet des permissions personnalisées",
        text: "Onglet Masqué → disparaît de la barre de navigation du membre. Onglet Lecture seule → visible avec un bandeau, toutes les interactions d'édition sont bloquées. Onglet Modifier → accès normal. Enregistrer bascule automatiquement le membre en mode Personnalisé.",
      },
    ],
    tips: [
      "Le propriétaire ne peut pas être rétrogradé (protection).",
      "Un administrateur a les mêmes droits que le propriétaire sur la gestion des membres, des codes et du blocage.",
    ],
  },
  {
    id: "qr",
    title: "QR codes",
    icon: QrCode,
    intro:
      "Générez des QR codes pour permettre à un agent de consulter son planning depuis son téléphone.",
    steps: [
      {
        title: "Générer",
        text: "Sélectionnez un agent et affichez son QR code : il pointe vers une vue lecture seule de son planning.",
      },
      {
        title: "Partager",
        text: "Imprimez ou affichez le QR code ; l'agent le scanne avec son appareil photo.",
      },
      {
        title: "Lecteur de QR code intégré",
        text: "Le bouton « Scanner un QR code » en haut de l'onglet ouvre un lecteur intégré à l'application : utile sur les smartphones, tablettes ou ordinateurs qui n'ont pas de lecteur de QR code. Il utilise la caméra arrière de l'appareil et ouvre directement le planning dès que le code est reconnu.",
      },
      {
        title: "Sans caméra : import d'une image",
        text: "Si la caméra est absente, refusée ou indisponible, cliquez sur « Importer une image » et choisissez une photo ou une capture du QR code : le lien est décodé puis ouvert (ou copié s'il ne s'agit pas d'une adresse web). Le bouton « Scanner à nouveau » relance la caméra.",
      },
    ],
    tips: [
      "L'accès à la caméra nécessite une connexion sécurisée (https) et une autorisation du navigateur.",
      "Après un changement de domaine, régénérez les QR codes pour qu'ils pointent vers la bonne adresse.",
    ],
  },

  {
    id: "import-export",
    title: "Import / Export Excel",
    icon: FileSpreadsheet,
    intro:
      "Échangez vos données avec Excel pour archiver, migrer ou charger un ancien planning.",
    steps: [
      {
        title: "Menu Exporter (7 options)",
        text: "Le bouton « Exporter » ouvre un menu avec plusieurs choix : toute l'application, l'année complète, un mois spécifique, la base des agents, les codes & paramètres, le roulement WE, ou les heures supplémentaires. Chaque fichier reprend les couleurs et la mise en forme de l'écran.",
      },
      {
        title: "Toute l'application",
        text: "Génère un classeur unique regroupant tous les onglets (planning mensuel, agents, codes, roulement, heures sup.) prêt à être archivé ou partagé.",
      },
      {
        title: "Année ou mois spécifique",
        text: "Exportez l'année entière (12 feuilles mensuelles) ou uniquement le mois affiché — idéal pour transmettre un planning ponctuel.",
      },
      {
        title: "Exports ciblés",
        text: "Base agents (avec équipes et dates), codes & paramètres (avec les couleurs), roulement WE (par année) et heures supplémentaires : chaque onglet peut être exporté seul.",
      },
      {
        title: "Importer (dialogue dédié)",
        text: "Cliquez sur « Importer » pour ouvrir la fenêtre dédiée : sélectionnez le fichier, une barre de progression avec pourcentage s'affiche, puis un état clair (réussite ou échec).",
      },
      {
        title: "Fusion intelligente",
        text: "L'import reconcilie les agents par nom (l'historique est conservé) et fusionne vos codes personnalisés avec ceux du fichier : vos libellés, heures et couleurs restent intacts.",
      },
    ],
    tips: [
      "L'import écrase les cellules de l'année importée : faites d'abord un export ou une sauvegarde nommée par sécurité.",
      "Sur Android (APK), le dialogue d'import est stabilisé pour éviter les problèmes de focus.",
      "Une procédure PDF complète et illustrée est téléchargeable depuis la section « Procédure complète » de cette aide.",
    ],
  },
  {
    id: "offline",
    title: "Mode hors-ligne",
    icon: WifiOff,
    intro:
      "L'application fonctionne même sans connexion : consultation et modifications sont possibles, la synchronisation reprend automatiquement.",
    steps: [
      {
        title: "Installation PWA",
        text: "Depuis le navigateur, ajoutez l'application à l'écran d'accueil. Sur Android, une APK est disponible.",
      },
      {
        title: "Bandeau « Mode hors ligne »",
        text: "Dès que la connexion est perdue (ou bloquée par le réseau d'entreprise), un bandeau rouge s'affiche en haut de l'écran. Il confirme que les données locales de l'appareil sont utilisées et disparaît automatiquement au retour du réseau.",
      },
      {
        title: "Données toujours préservées",
        text: "L'application ne recharge jamais la page de force et n'efface jamais le cache hors-ligne, même si un fichier échoue à charger. Votre dernier planning reste consultable en permanence.",
      },
      {
        title: "Bouton « Synchroniser »",
        text: "Sur la page de connexion, une carte « Modifications en attente » indique le nombre de changements locaux non envoyés. Le bouton « Synchroniser » les envoie au cloud manuellement, avec une barre de progression.",
      },
      {
        title: "Retour en ligne",
        text: "Dès qu'Internet revient, les changements locaux sont envoyés au cloud automatiquement après connexion, sans aucune action de votre part.",
      },
    ],
  },
  {
    id: "aide-recherche",
    title: "Recherche dans l'aide",
    icon: Search,
    intro:
      "La barre de recherche filtre les sections en temps réel, surligne les termes trouvés et permet de naviguer d'une occurrence à l'autre.",
    steps: [
      {
        title: "Filtrer les sections",
        text: "Tapez un mot-clé (ex : « import », « code », « sauvegarde ») : seules les sections concernées restent affichées et le lecteur PDF est masqué pour laisser la place aux résultats.",
      },
      {
        title: "Surlignage des correspondances",
        text: "Les termes trouvés sont surlignés en jaune dans les titres, intros, étapes et astuces. L'occurrence active est mise en évidence en orange.",
      },
      {
        title: "Boutons Précédent / Suivant",
        text: "Un compteur « (n/total) » indique l'occurrence courante. Les boutons ↑ / ↓ à droite du compteur défilent automatiquement jusqu'à la correspondance suivante ou précédente.",
      },
      {
        title: "Navigation clavier",
        text: "Depuis la barre de recherche : ↓ ou Entrée pour l'occurrence suivante, ↑ ou Maj+Entrée pour la précédente. Aucun besoin de lâcher le clavier.",
      },
      {
        title: "Effacer la recherche",
        text: "Le bouton « Effacer » à droite du champ réaffiche le lecteur PDF et la liste complète des sections.",
      },
    ],
    tips: [
      "La recherche est insensible à la casse et aux accents partiels.",
      "Le compteur affiche à la fois le nombre de sections filtrées et le nombre total d'occurrences.",
    ],
  },
  {
    id: "reset",
    title: "Réinitialiser",
    icon: Trash2,
    intro: "Effacer une année ou remettre l'application à zéro (sans toucher aux autres équipes).",
    steps: [
      {
        title: "Effacer une année",
        text: "Efface uniquement les valeurs saisies pour l'année en cours. Agents, codes et paramètres sont conservés.",
      },
      {
        title: "Tout réinitialiser",
        text: "Remet TOUT aux valeurs par défaut pour votre équipe : plannings, agents, codes, couleurs, roulement, paramètres. Action irréversible.",
      },
    ],
    tips: [
      "Faites toujours un export Excel ou une sauvegarde nommée avant une réinitialisation.",
      "La réinitialisation n'affecte QUE votre équipe : les autres plannings restent intacts.",
    ],
  },
  {
    id: "mobile",
    title: "Utilisation sur mobile",
    icon: Smartphone,
    intro:
      "L'application est optimisée pour smartphone : boutons tactiles, tableaux scrollables, colonne agent figée.",
    steps: [
      {
        title: "Défiler les tableaux",
        text: "Faites glisser horizontalement avec un doigt. La première colonne (agent) reste visible.",
      },
      {
        title: "Sélection tactile",
        text: "Appui long puis glissement pour sélectionner une plage de cellules dans le planning.",
      },
      {
        title: "Ouvrir le menu",
        text: "Le menu utilisateur (en haut à droite) donne accès à Équipe & partage et à la déconnexion.",
      },
    ],
  },
  {
    id: "raccourcis",
    title: "Astuces & raccourcis",
    icon: Keyboard,
    intro: "Gestes et raccourcis utiles au quotidien.",
    steps: [
      {
        title: "Copier / coller",
        text: "Ctrl+C / Ctrl+V (Cmd sur Mac) sur une plage sélectionnée dans le planning.",
      },
      {
        title: "Sélection étendue",
        text: "Shift + clic pour étendre une sélection jusqu'à une autre cellule.",
      },
      {
        title: "Impression PDF",
        text: "Ctrl+P (Cmd+P sur Mac) depuis l'onglet Impression, puis « Enregistrer au format PDF ».",
      },
      {
        title: "Navigation mois",
        text: "Utilisez les flèches ← → à côté du sélecteur de mois pour avancer rapidement.",
      },
      {
        title: "Poignée de recopie",
        text: "Tirer le carré bleu en bas à droite d'une cellule pour recopier sa valeur.",
      },
      {
        title: "Recherche dans l'aide",
        text: "Dans le champ de recherche : ↓/Entrée = occurrence suivante, ↑/Maj+Entrée = précédente. Compteur (n/total) et surlignage orange sur l'occurrence active.",
      },
    ],
  },
];

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            data-help-match=""
            className="help-mark rounded px-0.5 bg-yellow-200 text-yellow-950 dark:bg-yellow-400/40 dark:text-yellow-50"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function HelpTab() {
  const [query, setQuery] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatch, setActiveMatch] = useState(0);

  // Recompute matches after each render when query changes
  useLayoutEffect(() => {
    if (!query.trim() || !resultsRef.current) {
      setMatchCount(0);
      setActiveMatch(0);
      return;
    }
    const marks = resultsRef.current.querySelectorAll<HTMLElement>("mark[data-help-match]");
    setMatchCount(marks.length);
    setActiveMatch(marks.length > 0 ? 0 : 0);
  }, [query]);

  // Scroll to & highlight active match
  useEffect(() => {
    if (!resultsRef.current || matchCount === 0) return;
    const marks = resultsRef.current.querySelectorAll<HTMLElement>("mark[data-help-match]");
    marks.forEach((m, i) => {
      if (i === activeMatch) {
        m.classList.add("help-mark-active");
        m.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        m.classList.remove("help-mark-active");
      }
    });
  }, [activeMatch, matchCount, query]);

  const goPrev = () => {
    if (matchCount === 0) return;
    setActiveMatch((i) => (i - 1 + matchCount) % matchCount);
  };
  const goNext = () => {
    if (matchCount === 0) return;
    setActiveMatch((i) => (i + 1) % matchCount);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => {
      const hay =
        s.title +
        " " +
        s.intro +
        " " +
        s.steps.map((x) => x.title + " " + x.text).join(" ") +
        " " +
        (s.tips ?? []).join(" ");
      return hay.toLowerCase().includes(q);
    });
  }, [query]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="size-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Centre d'aide</h2>
            <p className="text-sm text-muted-foreground">
              Toutes les explications pour utiliser l'application au quotidien. Utilisez la recherche pour trouver un sujet précis.
            </p>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (matchCount === 0) return;
              if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                goNext();
              } else if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
                e.preventDefault();
                goPrev();
              }
            }}
            placeholder="Rechercher… (↑/↓ ou Entrée pour naviguer)"
            className="pl-9"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
              onClick={() => setQuery("")}
            >
              Effacer
            </Button>
          )}
        </div>

        {!query && (
          <>
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileSpreadsheet className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Procédure complète (PDF)</p>
                <p className="text-xs text-muted-foreground">
                  Guide illustré, en couleurs et pas à pas, pour prendre en main toute l'application.
                </p>
              </div>
              <a
                href="/procedure-planning-agents.pdf"
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Download className="size-4" />
                Télécharger
              </a>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Aperçu du guide (lecteur intégré)
                </p>
                <a
                  href="/procedure-planning-agents.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ouvrir en plein écran ↗
                </a>
              </div>
              <object
                data="/procedure-planning-agents.pdf#view=FitH"
                type="application/pdf"
                className="w-full h-[70vh] min-h-[500px]"
                aria-label="Procédure complète — Planning des agents"
              >
                <iframe
                  src="/procedure-planning-agents.pdf#view=FitH"
                  title="Procédure complète — Planning des agents"
                  className="w-full h-[70vh] min-h-[500px] border-0"
                />
                <p className="p-4 text-sm text-muted-foreground">
                  Votre navigateur ne peut pas afficher le PDF. Utilisez le bouton
                  « Télécharger » ci-dessus pour l'ouvrir.
                </p>
              </object>
            </div>
          </>
        )}

        {query && filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
            <p className="text-sm text-muted-foreground">
              {filtered.length} section{filtered.length > 1 ? "s" : ""} · {matchCount} occurrence{matchCount > 1 ? "s" : ""}
              {matchCount > 0 && (
                <span className="ml-1 font-semibold text-foreground">
                  ({activeMatch + 1}/{matchCount})
                </span>
              )}
              <span className="ml-1">pour « {query} »</span>
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={goPrev}
                disabled={matchCount === 0}
                aria-label="Occurrence précédente"
                title="Précédent (occurrence précédente)"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={goNext}
                disabled={matchCount === 0}
                aria-label="Occurrence suivante"
                title="Suivant (occurrence suivante)"
              >
                <ChevronDown className="size-4" />
              </Button>
            </div>
          </div>
        )}





        {filtered.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun résultat pour « {query} ». Essayez un autre mot-clé.
          </p>
        )}

        {!query && (
          <div className="mt-4 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#help-${s.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <s.icon className="size-3.5" />
                {s.title}
              </a>
            ))}
          </div>
        )}
      </div>

      <div ref={resultsRef} className="space-y-4">
        {filtered.map((s) => (
          <section
            key={s.id}
            id={`help-${s.id}`}
            className="scroll-mt-24 rounded-2xl border border-border bg-card p-5"
          >
            <header className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="size-5" />
              </div>
              <h3 className="text-lg font-bold">
                <Highlight text={s.title} query={query} />
              </h3>
            </header>
            <p className="mt-2 text-sm text-muted-foreground">
              <Highlight text={s.intro} query={query} />
            </p>

            <ol className="mt-4 space-y-3">
              {s.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">
                      <Highlight text={step.title} query={query} />
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <Highlight text={step.text} query={query} />
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            {s.tips && s.tips.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Astuces
                </p>
                <ul className="mt-1.5 space-y-1">
                  {s.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-amber-900 dark:text-amber-100">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                      <span><Highlight text={t} query={query} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center">
        <p className="text-sm font-medium">Une question sans réponse ?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Contactez l'administrateur de votre équipe via l'onglet « Équipe & partage ».
        </p>
      </div>
    </div>
  );
}
