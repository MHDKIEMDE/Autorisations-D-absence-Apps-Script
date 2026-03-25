# Système d'autorisation d'absence — Massaka SAS / Agribusiness TV

Système complet de gestion des demandes d'absence sur **Google Apps Script**.
Les employés soumettent via un **Google Form** ; les validateurs approuvent ou rejettent soit **directement dans le Google Sheet**, soit via **des liens email** (les deux modes coexistent sans conflit).

---

## Table des matières

1. [Architecture](#1-architecture)
2. [Fichiers du projet](#2-fichiers-du-projet)
3. [Prérequis](#3-prérequis)
4. [Installation pas à pas](#4-installation-pas-à-pas)
5. [Configuration (Config.gs)](#5-configuration-configgs)
6. [Thèmes visuels par organisation](#6-thèmes-visuels-par-organisation)
7. [Structure du Google Sheet](#7-structure-du-google-sheet)
8. [Structure Google Drive](#8-structure-google-drive)
9. [Circuits de validation (workflows)](#9-circuits-de-validation-workflows)
10. [Mode de validation manuelle (Sheet)](#10-mode-de-validation-manuelle-sheet)
11. [Règle de délai et jours ouvrables](#11-règle-de-délai-et-jours-ouvrables)
12. [Protections et sécurité](#12-protections-et-sécurité)
13. [Relances automatiques](#13-relances-automatiques)
14. [Menu Absences — outils d'administration](#14-menu-absences--outils-dadministration)
15. [Dépannage](#15-dépannage)
16. [Maintenance annuelle](#16-maintenance-annuelle)

---

## 1. Architecture

```
Google Form
    │  (soumission)
    ▼
Google Sheet ──► Apps Script (onFormSubmit)
    │                  │
    │          [Règle délai < 3 j. ouvrables]
    │                  │ rejet auto → email employé
    │                  │
    │          Résolution service → supervisor + workflow + nomOrg
    │          Génération tokens + initialisation statuts
    │                  │
    │          Email accusé réception employé
    │          Email premier validateur (Sup / RH / Présidence)
    │
    ├── Validation manuelle (Sheet)     ◄── validateur édite col R/S/T
    │       └── trigger traiterDecisionManuelle
    │
    └── Validation par email (WebApp)  ◄── validateur clique lien
            └── doGet → traiterDecision
                    │
             [Approuvé / Rejeté]
                    │
             ┌──────┴──────┐
          Approuvé       Rejeté
          (dernier        └── Email final employé
           niveau)            (pas de Drive)
             │
        Drive créé (dossier + doc)
        Email final employé
```

**Cascade de validation :** le circuit dépend du service (voir § 9).
L'employé est notifié **uniquement** en cas de rejet ou d'approbation finale.

---

## 2. Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `Config.gs` | **Seul fichier à modifier.** Emails, IDs Drive, délais, fériés, SERVICE_SUP_MAP, thèmes |
| `Code.gs` | Trigger `onFormSubmit` — réception, rejet délai, initialisation workflow, `onEdit` |
| `Workflow.gs` | Logique de décision — `traiterDecision` (WebApp) et `traiterDecisionManuelle` (Sheet) |
| `Notifications.gs` | Emails HTML — accusé réception, notification validateur, confirmation finale |
| `DriveManager.gs` | Création dossier/doc Drive, template, déplacement par statut |
| `WebApp.gs` | Interface HTML de validation par lien email (`doGet`) |
| `Setup.gs` | Initialisation, menu, protections colonnes, dropdowns |
| `Relances.gs` | Relances automatiques quotidiennes, outils de maintenance |
| `Utils.gs` | Fonctions partagées — logs, UUID, `lireDemande`, formatage dates, jours ouvrables |

---

## 3. Prérequis

- Compte **Google Workspace** (GmailApp, Drive, DocumentApp)
- Un **Google Form** lié au Google Sheet
- Un **dossier Google Drive** racine avec sous-dossier `Accepté`
- Un **dossier template** Drive contenant **un seul** Google Doc (modèle officiel)
- Droits d'administrateur sur le script pour installer les triggers

---

## 4. Installation pas à pas

### Étape 1 — Préparer Google Drive

```
Dossier racine/
└── Accepté/    ← créé automatiquement si absent

Dossier template/
└── [Modèle Google Doc]   ← un seul fichier
```

Notez les **IDs** des deux dossiers (URL Drive : `folders/XXXX`).

### Étape 2 — Template Google Doc (balises)

| Balise | Contenu injecté |
|--------|----------------|
| `{{ID_DEMANDE}}` | MSK-AAAA-XXXX |
| `{{NOM}}` | Nom employé |
| `{{PRENOM}}` | Prénom |
| `{{MATRICULE}}` | Matricule |
| `{{SERVICE}}` | Service |
| `{{TYPE_PERMISSION}}` | Type de permission |
| `{{DATE_SOUMISSION}}` | Date/heure soumission |
| `{{AVIS_SUPERIEUR}}` | Décision supérieur |
| `{{AVIS_RH}}` | Décision RH |
| `{{AVIS_PRESIDENCE}}` | Décision Présidence |
| `{{COMMENTAIRE}}` | Motif de rejet |
| `{{DATE_CLOTURE}}` | Date de clôture |
| `{{TYPE_ABSENCE}}` | Sous-type absence exceptionnelle |
| `{{DATE_DEBUT}}` / `{{HEURE_DEBUT}}` | Début (exceptionnelle) |
| `{{DATE_FIN}}` / `{{HEURE_FIN}}` | Fin (exceptionnelle) |
| `{{NB_JOURS_EXCEPTIONNEL}}` | Durée calculée |
| `{{MOTIF_ORDINAIRE}}` | Motif (ordinaire) |
| `{{DATE_DEBUT_ORDINAIRE}}` / `{{DATE_FIN_ORDINAIRE}}` | Dates (ordinaire) |
| `{{NB_JOURS}}` | Nombre de jours (ordinaire) |

### Étape 3 — Configurer Config.gs

Renseigner obligatoirement :

```javascript
SHEET_REPONSES_ID:       'ID_du_Google_Sheet',
EMAIL_RH:                'rh@votreorg.com',
EMAIL_PRESIDENCE:        'president@votreorg.com',
DRIVE_DOSSIER_RACINE:   'ID_dossier_racine',
DRIVE_DOSSIER_TEMPLATE: 'ID_dossier_template',
WEBAPP_URL:             'REMPLACER_APRES_DEPLOIEMENT',
```

Puis configurer `SERVICE_SUP_MAP` (voir § 5).

### Étape 4 — Initialiser le projet

Dans l'éditeur Apps Script, exécuter :
```
initialiserProjet()
```
Installe les triggers, en-têtes colonnes, protections et dropdowns.

### Étape 5 — Déployer la Web App

1. **Déployer → Nouveau déploiement**
2. Type : **Application Web** / Exécuter en tant que : **Moi** / Accès : **Toute personne**
3. Copier l'URL → `Config.gs → WEBAPP_URL`

### Étape 6 — Activer la validation manuelle

Menu **Absences** → **⚙️ Activer validation manuelle (Sheet)**

### Étape 7 — Tester

- [ ] Colonnes V–AD remplies automatiquement après soumission
- [ ] Email accusé de réception reçu par l'employé
- [ ] Email notification reçu par le premier validateur
- [ ] Thème email (badge/boutons) correspond à l'entreprise de l'employé
- [ ] Aucun dossier Drive créé avant approbation finale
- [ ] Validation Sheet et lien email fonctionnent sans conflit
- [ ] À l'approbation finale : dossier Drive créé dans `Accepté/`

---

## 5. Configuration (Config.gs)

### SERVICE_SUP_MAP — Mapping service → workflow

C'est la clé de voûte du système. Chaque service du formulaire doit y figurer **exactement** (même casse, même orthographe).

```javascript
SERVICE_SUP_MAP: {
  'Nom du service': {
    sup:      'email.superviseur@domaine.com',  // null si pas de supérieur
    workflow: 'SUP_RH_PRES',                   // voir § 9
    nomOrg:   'Massaka SAS',                   // ou 'Agribusiness TV'
  },
}
```

| Champ | Description |
|-------|-------------|
| `sup` | Email du supérieur hiérarchique. `null` si le service n'en a pas |
| `workflow` | Circuit de validation (voir § 9) |
| `nomOrg` | Nom de l'organisation — détermine le thème email (voir § 6) |

### PRESIDENCE_MAP — Routage multi-présidence (optionnel)

Si plusieurs présidences existent, renseigner ce map pour router chaque superviseur vers la bonne présidence **et** lui appliquer un thème personnalisé :

```javascript
PRESIDENCE_MAP: {
  'sup@org.com': {
    email:         'president@org.com',
    nom:           'Prénom Nom — Président',
    couleur:       '#000000',
    couleurBadge:  '#f8c542',
    couleurAccent: '#016579',
    couleurTexte:  '#ffffff',
    police:        "'Montserrat', sans-serif",
  },
}
```

Si vide → `EMAIL_PRESIDENCE` et le thème `nomOrg` sont utilisés par défaut.

### SUP_NOMS — Noms d'affichage

```javascript
SUP_NOMS: {
  'sup@org.com': 'Prénom Nom — Titre',
}
```

---

## 6. Thèmes visuels par organisation

Le thème est résolu automatiquement à partir du champ `nomOrg` dans `SERVICE_SUP_MAP`.
**Aucune configuration supplémentaire n'est requise** : déclarer le bon `nomOrg` suffit.

| Organisation | Badge | Accent (boutons/titres) | Police |
|-------------|-------|------------------------|--------|
| `Massaka SAS` | `#f8c542` jaune | `#016579` bleu-vert | Montserrat |
| `Agribusiness TV` | `#B9EB57` vert | `#015438` vert foncé | Proxima Nova |

Les deux organisations ont un **fond d'entête noir** et **texte blanc**.

> Pour ajouter une 3ème organisation : ajouter une entrée dans `THEMES_ORG` dans `Notifications.gs` et utiliser le même nom dans `nomOrg` de `SERVICE_SUP_MAP`.

---

## 7. Structure du Google Sheet

Les colonnes **A–P** sont remplies par le formulaire. Les colonnes **Q–AD** sont gérées par le script.

| Col | Nom | Source | Description |
|-----|-----|--------|-------------|
| A | Horodateur | Formulaire | Date/heure de soumission |
| B | Email employé | Formulaire | |
| C | Matricule | Formulaire | |
| D | Nom | Formulaire | |
| E | Prénom | Formulaire | |
| F | Service | Formulaire | Valeur exacte → lookup `SERVICE_SUP_MAP` |
| G | Type permission | Formulaire | `Permission ordinaire` / `Permission exceptionnelle` |
| H | Type absence | Formulaire | Sous-type si exceptionnelle |
| I | Date début | Formulaire | Permission exceptionnelle uniquement |
| J | Heure début | Formulaire | Permission exceptionnelle |
| K | Date fin | Formulaire | Permission exceptionnelle |
| L | Heure fin | Formulaire | Permission exceptionnelle |
| M | Motif long | Formulaire | Permission ordinaire |
| N | Nombre de jours | Formulaire | Permission ordinaire |
| O | Date début ord. | Formulaire | Permission ordinaire |
| P | Date fin ord. | Formulaire | Permission ordinaire |
| **Q** | **Email supérieur** | **Script** | Résolu via `SERVICE_SUP_MAP[service].sup` |
| **R** | **Avis Supérieur** | **Validateur** | `En attente` / `Approuvé` / `Rejeté` |
| **S** | **Avis RH** | **Validateur** | `En attente` / `Approuvé` / `Rejeté` |
| **T** | **Avis Présidence** | **Validateur** | `En attente` / `Approuvé` / `Rejeté` |
| **U** | **Commentaire** | **Validateur** | Motif de rejet — obligatoire si Rejeté |
| V | ID Demande | Script | `MSK-2026-0001` |
| W | Token Supérieur | Script | UUID usage unique |
| X | Token RH | Script | UUID usage unique |
| Y | Token Présidence | Script | UUID usage unique |
| Z | Statut global | Script | `En cours` / `Approuvé` / `Rejeté` |
| AA | Date clôture | Script | |
| AB | Drive Dossier ID | Script | Lien cliquable vers le dossier |
| AC | Drive Doc ID | Script | Lien cliquable vers le Google Doc |
| AD | Dernière relance | Script | Date de la dernière relance envoyée |

---

## 8. Structure Google Drive

```
Dossier Racine/
└── Accepté/
    ├── MSK-2026-0001 - Nom Employé/
    │   └── MSK-2026-0001 - Nom Employé  ← Google Doc
    └── MSK-2026-0002 - Nom Employé/
        └── MSK-2026-0002 - Nom Employé

Dossier Template/
└── [Modèle document officiel]  ← 1 seul fichier
```

> Dossier et Google Doc créés **uniquement à l'approbation finale**. Les demandes rejetées n'ont aucune trace Drive.

---

## 9. Circuits de validation (workflows)

| Workflow | Circuit | Usage typique |
|----------|---------|---------------|
| `SUP_RH_PRES` | Supérieur → RH → Présidence | Circuit complet — employés avec supérieur |
| `RH_PRES` | RH → Présidence | Pas de supérieur hiérarchique |
| `PRES` | Présidence directement | Validateur unique |
| `PRES_RH` | Présidence → RH (final) | RH est le validateur final (ex : Administration) |

Les niveaux sautés sont marqués `Approuvé` automatiquement et leurs tokens invalidés.

### Règles de notification employé

| Événement | Employé notifié ? |
|-----------|-------------------|
| Soumission | ✅ Accusé de réception |
| Approbation intermédiaire (Sup / RH) | ❌ |
| Approbation finale | ✅ Confirmation avec doc Drive |
| Rejet (tout niveau) | ✅ Email avec motif |
| Rejet automatique délai | ✅ Email avec explication |

---

## 10. Mode de validation manuelle (Sheet)

1. Trouver la ligne (colonne V = référence `MSK-AAAA-XXXX`)
2. **Pour rejeter :** saisir le motif en **colonne U d'abord**
3. Cliquer sur la cellule de votre colonne (R, S ou T) → choisir `Approuvé` ou `Rejeté`

> ⚠️ **Ordre obligatoire :** R avant S avant T (selon workflow).
> ⚠️ **Motif obligatoire :** rejet sans motif → cellule annulée + message.

### Coexistence Sheet ↔ lien email

| Scénario | Résultat |
|----------|---------|
| Sheet d'abord, puis lien email | Lien bloqué ("réponse déjà envoyée") |
| Lien d'abord, puis tentative Sheet | Cellule annulée par `onEdit` |
| Double-clic lien email | Bloqué (token déjà utilisé) |

---

## 11. Règle de délai et jours ouvrables

**Toutes les permissions** sont rejetées automatiquement si le début est à moins de `DELAI_MIN_JOURS_OUVRABLES` jours ouvrables de la soumission (samedis, dimanches et `JOURS_FERIES` exclus).

| Soumission | Début absence | Jours ouvrables | Résultat (délai = 3) |
|-----------|--------------|----------------|---------------------|
| Lundi | Jeudi | 3 | ✅ Accepté |
| Lundi | Mercredi | 2 | ❌ Rejeté auto |
| Vendredi | Mercredi suivant | 3 | ✅ Accepté |

> Pour toute urgence → contacter la RH directement.

---

## 12. Protections et sécurité

| Colonne | Éditeurs autorisés | Protection |
|---------|--------------------|-----------|
| A–P | Avertissement | Soft (ne bloque pas le formulaire) |
| Q | Script uniquement | Strict — résolu automatiquement |
| R Avis Sup. | Emails dans `SUP_NOMS` | Strict |
| S Avis RH | `EMAIL_RH` | Strict |
| T Avis Présidence | `EMAIL_PRESIDENCE` | Strict |
| U Commentaire | Tous validateurs | Strict |
| V–AD (système) | Avertissement | Réservé au script |

### Gardes dans le code

| Situation | Mécanisme |
|-----------|-----------|
| Double-clic lien email | Vérifie colonne encore "En attente" |
| Ré-édition après décision | `onEdit` annule + toast |
| Validation hors ordre | Annulation + toast |
| Rejet sans motif | Annulation + toast |
| Exécutions simultanées | `LockService.getScriptLock()` |

---

## 13. Relances automatiques

Trigger quotidien **8h00** — renvoie l'email au validateur en attente si :
- Statut global = `En cours`
- Niveau en `En attente` avec token valide
- Au moins `DELAI_RELANCE_JOURS` jours depuis la dernière relance ou la soumission

---

## 14. Menu Absences — outils d'administration

| Option | Description |
|--------|-------------|
| **Filtrer par mois / année** | Masque les lignes hors période |
| **Tout afficher** | Réaffiche toutes les lignes |
| **⚙️ Activer validation manuelle** | Installe le trigger `traiterDecisionManuelle` |
| **Renvoyer une validation** | Renvoie l'email si le lien est perdu |
| **Reprendre un traitement échoué** | Rejoue `onFormSubmit` (régénère tokens/Drive) |
| **Nettoyer les triggers en double** | Supprime les triggers dupliqués |
| **Reconfigurer les couleurs** | Réapplique couleurs conditionnelles Q/R/S/T/Z |
| **Reconfigurer les protections** | Réapplique protections et dropdowns |

---

## 15. Dépannage

### Le formulaire ne déclenche rien
1. Vérifier le trigger `onFormSubmit` : Apps Script → **Déclencheurs**
2. Relancer `initialiserProjet()` si absent
3. Vérifier `SHEET_REPONSES_ID` et `ONGLET_REPONSES`
4. Consulter : Apps Script → **Exécutions**

### Mauvais thème email (mauvaise entreprise)
1. Vérifier que le nom du service dans le formulaire correspond **exactement** à une clé de `SERVICE_SUP_MAP` (majuscules, accents, espaces)
2. Vérifier que `nomOrg` dans `SERVICE_SUP_MAP` vaut `'Massaka SAS'` ou `'Agribusiness TV'` (orthographe exacte)
3. Consulter les logs : chercher `[INFO][Notifications]` pour voir `org=`

### Les emails ne partent pas
1. Vérifier les quotas Gmail (100/j compte perso, 1 500/j Workspace)
2. Vérifier les adresses dans `Config.gs` (sans espaces ni fautes)

### La validation manuelle ne réagit pas
1. Vérifier le trigger : menu **Absences** → **⚙️ Activer validation manuelle**
2. Vérifier l'orthographe : `Approuvé` (accent é) / `Rejeté`
3. Vérifier les droits sur la colonne (R, S ou T)
4. Menu **Absences** → **Nettoyer les triggers en double** si doublon

### Le dossier Drive n'est pas créé
> Normal si la demande est en cours ou rejetée — Drive uniquement à l'approbation finale.
1. Vérifier `DRIVE_DOSSIER_RACINE` et `DRIVE_DOSSIER_TEMPLATE`
2. Le dossier template doit contenir **exactement 1** Google Doc
3. Droits d'édition requis sur les dossiers

### Demande bloquée "En cours"
1. Menu **Absences** → **Renvoyer une validation** (référence MSK-AAAA-XXXX)
2. Si token corrompu → **Reprendre un traitement échoué**

### Rejet automatique inattendu
Vérifier que les jours fériés concernés sont dans `JOURS_FERIES` (Config.gs).

---

## 16. Maintenance annuelle

À faire chaque janvier :

- [ ] Mettre à jour `JOURS_FERIES` (Korité, Tabaski, Maouloud, Tamkharit changent chaque année)
- [ ] Mettre à jour `SUP_NOMS` si des responsables ont changé
- [ ] Vérifier `EMAIL_RH` et `EMAIL_PRESIDENCE`
- [ ] Menu **Absences** → **Reconfigurer les protections**
- [ ] Archiver ou filtrer les demandes de l'année précédente

---

## Licence

Usage interne — Massaka SAS / Agribusiness TV. Tous droits réservés.
