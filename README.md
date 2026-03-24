# Système d'autorisation d'absence — Massaka

Système complet de gestion des demandes d'absence sur Google Apps Script.
Les employés soumettent via un Google Form ; les validateurs approuvent ou rejettent soit **directement dans le Google Sheet**, soit via **des liens email** (les deux modes coexistent).

---

## Table des matières

1. [Architecture](#1-architecture)
2. [Fichiers du projet](#2-fichiers-du-projet)
3. [Prérequis](#3-prérequis)
4. [Installation pas à pas](#4-installation-pas-à-pas)
5. [Configuration (Config.gs)](#5-configuration-configgs)
6. [Structure du Google Sheet](#6-structure-du-google-sheet)
7. [Structure Google Drive](#7-structure-google-drive)
8. [Workflow de validation](#8-workflow-de-validation)
9. [Mode de validation manuelle (Sheet)](#9-mode-de-validation-manuelle-sheet)
10. [Règle de délai et jours ouvrables](#10-règle-de-délai-et-jours-ouvrables)
11. [Double Présidence — routage automatique](#11-double-présidence--routage-automatique)
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
    │          ┌───────┴────────┐
    │          │                │
    │     Drive (dossier     Email (accusé
    │     + doc créés)       réception employé)
    │
    ├── Validation manuelle (Sheet)          ◄── validateur édite col Q/R/S
    │       │
    │       ▼ trigger installable (traiterDecisionManuelle)
    │
    └── Validation par email (WebApp)        ◄── validateur clique lien
            │
            ▼ doGet → traiterDecision
            │
     [Approuvé / Rejeté]
            │
     ┌──────┴──────┐
     │             │
  Drive mis    Email final
  à jour       employé
```

**Cascade de validation :** Supérieur → RH → Présidence
L'employé est notifié **uniquement** en cas de rejet (tout niveau) ou d'approbation finale (Présidence).

---

## 2. Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `Config.gs` | **Seul fichier à modifier.** Tous les paramètres (emails, IDs, délais, jours fériés) |
| `Code.gs` | Trigger `onFormSubmit` — réception des demandes, rejet automatique délai, trigger `onEdit` protection |
| `Workflow.gs` | Logique de décision — `traiterDecision` (WebApp) et `traiterDecisionManuelle` (Sheet) |
| `Notifications.gs` | Emails HTML — accusé de réception, notification validateur, confirmation finale employé |
| `DriveManager.gs` | Création dossier/doc Drive, remplissage du template, déplacement par statut |
| `WebApp.gs` | Interface HTML de validation par lien email (`doGet`) |
| `Setup.gs` | Initialisation, menu, protections colonnes, validation de données (dropdowns) |
| `Relances.gs` | Relances automatiques quotidiennes, outils de maintenance |
| `Utils.gs` | Fonctions partagées — logs, UUID, formatage dates, calcul jours ouvrables |

---

## 3. Prérequis

- Compte **Google Workspace** (requis pour GmailApp, Drive, DocumentApp)
- Un **Google Form** lié au Google Sheet
- Un **dossier Google Drive** racine avec 3 sous-dossiers : `En attente`, `Accepté`, `Rejeté`
- Un **dossier template** Drive contenant **un seul** Google Doc (le modèle de document officiel)
- Droits d'administrateur sur le script pour installer les triggers

---

## 4. Installation pas à pas

### Étape 1 — Préparer Google Drive

```
Dossier racine/
├── En attente/
├── Accepté/
└── Rejeté/

Dossier template/
└── [Votre modèle Google Doc]   ← un seul fichier
```

Notez les **IDs** des deux dossiers (dans l'URL Drive : `folders/XXXX`).

### Étape 2 — Préparer le template Google Doc

Le document doit contenir ces balises exactes (remplacées automatiquement) :

Le template supporte deux sections distinctes selon le type de permission.

**Balises communes (toutes permissions)**

| Balise | Contenu injecté |
|--------|----------------|
| `{{ID_DEMANDE}}` | Référence MSK-AAAA-XXXX |
| `{{NOM}}` | Nom de l'employé |
| `{{PRENOM}}` | Prénom |
| `{{MATRICULE}}` | Matricule |
| `{{SERVICE}}` | Service / Poste |
| `{{TYPE_PERMISSION}}` | Type de permission |
| `{{DATE_SOUMISSION}}` | Date et heure de soumission |
| `{{AVIS_SUPERIEUR}}` | Décision du supérieur (remplie à la clôture) |
| `{{AVIS_RH}}` | Décision RH |
| `{{AVIS_PRESIDENCE}}` | Décision Présidence |
| `{{COMMENTAIRE}}` | Motif de rejet (si applicable) |
| `{{DATE_CLOTURE}}` | Date de clôture |

**Balises — Permission exceptionnelle**

| Balise | Contenu injecté |
|--------|----------------|
| `{{TYPE_ABSENCE}}` | Type d'absence (dropdown formulaire) |
| `{{MOTIF_EXCEPTIONNEL}}` | Identique à `{{TYPE_ABSENCE}}` |
| `{{DATE_DEBUT}}` | Date de début (ex : lundi 23 mars 2026) |
| `{{HEURE_DEBUT}}` | Heure de début (ex : 08h00) |
| `{{DATE_FIN}}` | Date de fin |
| `{{HEURE_FIN}}` | Heure de fin |
| `{{NB_JOURS_EXCEPTIONNEL}}` | Durée calculée automatiquement |

**Balises — Permission ordinaire**

| Balise | Contenu injecté |
|--------|----------------|
| `{{MOTIF_ORDINAIRE}}` | Motif saisi librement par l'employé |
| `{{MOTIF}}` | Identique à `{{MOTIF_ORDINAIRE}}` |
| `{{DATE_DEBUT_ORDINAIRE}}` | Date du début de l'absence ordinaire |
| `{{DATE_FIN_ORDINAIRE}}` | Date du fin de l'absence ordinaire |
| `{{NB_JOURS}}` / `{{NB_JOURS_ORDINAIRE}}` | Nombre de jours saisi dans le formulaire |

> **Important :** Les balises `{{AVIS_*}}` et `{{DATE_CLOTURE}}` sont remplies **uniquement à la décision finale**. Elles doivent rester intactes dans le template.

### Étape 3 — Configurer Config.gs

Ouvrir `Config.gs` et renseigner :

```javascript
SHEET_REPONSES_ID:       'ID_du_Google_Sheet',
EMAIL_RH:                'rh@votreorg.com',
NOM_RH:                  'Prénom Nom RH',

// Présidence par défaut (fallback si superviseur absent de PRESIDENCE_MAP)
EMAIL_PRESIDENCE:        'president@votreorg.com',
NOM_PRESIDENCE:          'Prénom Nom Président',

// Mapping superviseur → Présidence compétente
PRESIDENCE_MAP: {
  'sup1@votreorg.com': { email: 'pres-a@votreorg.com', nom: 'Prénom Nom — Présidence A' },
  'sup2@votreorg.com': { email: 'pres-b@votreorg.com', nom: 'Prénom Nom — Présidence B' },
},

SUP_NOMS: {
  'sup1@votreorg.com': 'Prénom Nom — Directeur',
  'sup2@votreorg.com': 'Prénom Nom — Chef de service',
},
DRIVE_DOSSIER_RACINE:   'ID_dossier_racine',
DRIVE_DOSSIER_TEMPLATE: 'ID_dossier_template',
WEBAPP_URL:             'REMPLACER_APRES_DEPLOIEMENT',  // ← remplir à l'étape 5
NOM_ORG:                'Votre Organisation',
```

### Étape 4 — Initialiser le projet

Dans le Google Sheet : menu **Absences** → (si le menu n'apparaît pas, ouvrir l'éditeur Apps Script → Exécuter `onOpen`)

Puis exécuter dans l'éditeur Apps Script :
```
initialiserProjet()
```

Cela installe les triggers, crée les en-têtes de colonnes, configure les protections et active la validation manuelle.

### Étape 5 — Déployer la Web App

Dans Apps Script :
1. **Déployer** → **Nouveau déploiement**
2. Type : **Application Web**
3. Exécuter en tant que : **Moi**
4. Accès : **Toute personne** (ou domaine selon politique)
5. Copier l'URL générée dans `Config.gs` → `WEBAPP_URL`

### Étape 6 — Activer la validation manuelle

Menu **Absences** → **⚙️ Activer validation manuelle (Sheet)**

Cette étape installe le trigger installable `traiterDecisionManuelle`.
Si `initialiserProjet()` a déjà été exécuté, ce trigger est déjà actif.

### Étape 7 — Tester

Soumettre une demande test via le formulaire et vérifier :
- [ ] Colonnes U–AC remplies automatiquement dans le Sheet
- [ ] Email accusé de réception reçu par l'employé
- [ ] Email notification reçu par le supérieur (avec les deux options : Sheet et lien)
- [ ] Dossier et doc créés dans Drive → `En attente/`
- [ ] Validation manuelle dans le Sheet déclenche les emails suivants
- [ ] Validation par lien email fonctionne
- [ ] À la décision finale, doc mis à jour et dossier déplacé vers `Accepté/` ou `Rejeté/`

---

## 5. Configuration (Config.gs)

### Paramètres principaux

| Paramètre | Description | Valeur par défaut |
|-----------|-------------|-------------------|
| `SHEET_REPONSES_ID` | ID du Google Sheet | À renseigner |
| `ONGLET_REPONSES` | Nom de l'onglet | `Réponses au formulaire 1` |
| `DELAI_MIN_JOURS_OUVRABLES` | Préavis minimum (jours ouvrables) | `3` |
| `DELAI_RELANCE_JOURS` | Jours avant relance automatique | `7` |
| `EMAIL_RH` / `NOM_RH` | Responsable RH | À renseigner |
| `EMAIL_PRESIDENCE` / `NOM_PRESIDENCE` | Président | À renseigner |
| `SUP_NOMS` | Dictionnaire email → nom des supérieurs | `{}` |
| `DRIVE_DOSSIER_RACINE` | ID du dossier racine Drive | À renseigner |
| `DRIVE_DOSSIER_TEMPLATE` | ID du dossier template | À renseigner |
| `WEBAPP_URL` | URL de la Web App déployée | À renseigner après déploiement |
| `NOM_ORG` | Nom affiché dans les emails | `Massaka` |
| `JOURS_FERIES` | Liste des jours fériés `['YYYY-MM-DD']` | Jours fériés 2026 |

### Ajouter un supérieur hiérarchique

```javascript
SUP_NOMS: {
  'jean.dupont@massaka.com':  'Jean Dupont — Directeur Financier',
  'marie.fall@massaka.com':   'Marie Fall — Chef de Projet',
}
```

L'email doit correspondre **exactement** à ce que l'employé sélectionne dans le formulaire.
Après modification, relancer **Reconfigurer les protections** pour mettre à jour les accès col Q.

---

## 6. Structure du Google Sheet

Les colonnes **A–P** sont remplies par le formulaire. Les colonnes **Q–AC** sont gérées par le script.

| Col | Nom | Rempli par | Description |
|-----|-----|-----------|-------------|
| A | Horodateur | Formulaire | Date/heure de soumission |
| B | Email employé | Formulaire | |
| C | Matricule | Formulaire | |
| D | Nom | Formulaire | |
| E | Prénom | Formulaire | |
| F | Service | Formulaire | |
| G | Type permission | Formulaire | Permission ordinaire / exceptionnelle |
| H | Type absence | Formulaire | Sous-type si exceptionnelle |
| I | Date début | Formulaire | |
| J | Heure début | Formulaire | |
| K | Date fin | Formulaire | |
| L | Heure fin | Formulaire | |
| M | Motif libre | Formulaire | |
| N | Motif long | Formulaire | |
| O | Nb jours | Formulaire | |
| P | Email supérieur | Formulaire | Choisi par l'employé |
| **Q** | **Avis Supérieur** | **Validateur** | En attente / Approuvé / Rejeté |
| **R** | **Avis RH** | **Validateur** | En attente / Approuvé / Rejeté |
| **S** | **Avis Présidence** | **Validateur** | En attente / Approuvé / Rejeté |
| **T** | **Commentaire** | **Validateur** | Motif de rejet — obligatoire si Rejeté |
| U | ID Demande | Script | ABS-2026-0001 |
| V | Token Supérieur | Script | UUID usage unique |
| W | Token RH | Script | UUID usage unique |
| X | Token Présidence | Script | UUID usage unique |
| Y | Statut Global | Script | En cours / Approuvé / Rejeté |
| Z | Date Clôture | Script | |
| AA | Drive Dossier ID | Script | ID du dossier de la demande |
| AB | Drive Doc ID | Script | ID du Google Doc |
| AC | Dernière Relance | Script | Date de la dernière relance envoyée |

---

## 7. Structure Google Drive

```
Dossier Racine/
├── En attente/
│   ├── ABS-2026-0001 - Fall Mamadou/
│   │   └── ABS-2026-0001 - Fall Mamadou  ← Google Doc
│   └── ABS-2026-0002 - Diop Fatou/
│       └── ABS-2026-0002 - Diop Fatou
├── Accepté/
│   └── [dossiers des demandes approuvées]
└── Rejeté/
    └── [dossiers des demandes rejetées]

Dossier Template/
└── [Modèle document officiel]  ← 1 seul fichier
```

---

## 8. Workflow de validation

### Flux normal

```
Soumission formulaire
        │
        ▼
  Règle délai ? ──── < 3 jours ouvrables ──► Rejeté automatiquement + email employé
  
  uniquement)
        │
   >= 3 jours
        │
        ▼
  Drive créé + tokens générés + email Supérieur
        │
   ┌────┴────┐
Approuvé  Rejeté ──► email employé + clôture (Drive → Rejeté)
   │
   ▼
  Email RH
   │
   ┌────┴────┐
Approuvé  Rejeté ──► email employé + clôture (Drive → Rejeté)
   │
   ▼
  Email Présidence
   │
   ┌────┴────┐
Approuvé  Rejeté ──► email employé + clôture (Drive → Rejeté)
   │
   ▼
email employé (confirmation)
+ doc mis à jour
+ Drive → Accepté
```

### Règles de notification employé

| Événement | Notifié ? |
|-----------|-----------|
| Soumission | ✅ Accusé de réception |
| Approbation Supérieur | ❌ |
| Approbation RH | ❌ |
| Approbation Présidence | ✅ Confirmation finale |
| Rejet (tout niveau) | ✅ Email avec motif |
| Rejet automatique délai | ✅ Email avec explication |

---

## 9. Mode de validation manuelle (Sheet)

Les validateurs peuvent décider **directement dans le Google Sheet** sans passer par les liens email.

### Comment valider dans le Sheet

1. Ouvrir le Google Sheet
2. Trouver la ligne de la demande (colonne U = référence ABS-AAAA-XXXX)
3. **Pour rejeter** : saisir le motif dans la **colonne T** en **premier**
4. Cliquer sur la cellule de votre colonne (Q, R ou S) et choisir dans le menu déroulant :
   - `Approuvé` — le niveau suivant est notifié automatiquement
   - `Rejeté` — la demande est clôturée et l'employé notifié avec le motif de la col T

> ⚠️ **Ordre obligatoire :** RH ne peut pas valider avant le Supérieur. Présidence ne peut pas valider avant le RH. Tentative hors ordre → cellule annulée + message.

> ⚠️ **Motif obligatoire pour rejet :** Sélectionner `Rejeté` sans motif en colonne T → cellule annulée + message demandant de saisir le motif d'abord.

### Coexistence Sheet et liens email

Les deux modes fonctionnent **sans conflit** :

| Scénario | Résultat |
|----------|---------|
| Sheet d'abord, puis lien email | Lien email bloqué ("réponse déjà envoyée") |
| Lien email d'abord, puis tentative Sheet | Cellule annulée par `onEdit` |
| Double clic sur lien email | Bloqué (vérifie que la colonne n'est plus "En attente") |
| Double édition Sheet | Bloqué (ancienneValeur = "Approuvé" ou "Rejeté") |

---

## 10. Règle de délai et jours ouvrables

### Principe

**Toutes les permissions sans exception** sont **automatiquement rejetées** si le début de l'absence est à moins de `DELAI_MIN_JOURS_OUVRABLES` jours ouvrables de la soumission.

Les **samedis**, **dimanches** et les dates listées dans `JOURS_FERIES` ne comptent pas.

> Pour toute situation urgente (maladie, cas de force majeure, etc.), l'employé doit contacter **directement la RH**.

### Exemples

| Soumission | Début absence | Jours ouvrables | Résultat (délai = 3) |
|-----------|--------------|----------------|---------------------|
| Lundi 9h | Jeudi 9h | 3 (Mar + Mer + Jeu) | ✅ Accepté |
| Lundi 9h | Mercredi 9h | 2 (Mar + Mer) | ❌ Rejeté auto |
| Vendredi 9h | Mercredi suivant | 3 (Lun + Mar + Mer) | ✅ Accepté |
| Jeudi 9h | Lundi suivant (vendredi = férié) | 2 (Lun) | ❌ Rejeté auto |
| Tout moment | Maladie urgente | — | ❌ Rejeté auto → contacter RH directement |

### Mise à jour annuelle des jours fériés

Dans `Config.gs`, mettre à jour `JOURS_FERIES` chaque début d'année avec les dates exactes, notamment les fêtes islamiques à dates variables :
- Korité (fin Ramadan)
- Tabaski (Aïd el-Kébir)
- Maouloud (naissance du Prophète)
- Tamkharit (Nouvel An islamique)

---

## 11. Protections et sécurité

### Accès par colonne

| Colonne | Éditeurs autorisés | Type de protection |
|---------|--------------------|-------------------|
| A–P (données formulaire) | Avertissement seul | Soft — ne bloque pas les soumissions formulaire |
| **Q** Avis Supérieur | Emails dans `SUP_NOMS` | **Strict** — accès refusé aux autres |
| **R** Avis RH | `EMAIL_RH` | **Strict** |
| **S** Avis Présidence | `EMAIL_PRESIDENCE` | **Strict** |
| **T** Commentaire/Motif | Tous les validateurs | **Strict** |
| U–AC (colonnes système) | Avertissement seul | Soft — réservé au script |

> Le script (propriétaire du spreadsheet) contourne toujours les protections pour écrire ses données.

### Dropdowns colonnes Q, R, S

Valeurs autorisées : `En attente` · `Approuvé` · `Rejeté`
Toute saisie libre hors de cette liste est **refusée** par Sheets (`setAllowInvalid(false)`).

### Gardes dans le code

| Situation | Mécanisme de protection |
|-----------|------------------------|
| Double-clic lien email | Vérifie colonne encore "En attente" avant traitement |
| Ré-édition après décision | `onEdit` annule la cellule + toast |
| Validation hors ordre hiérarchique | Annulation cellule + toast explicatif |
| Rejet sans motif | Annulation cellule + toast |
| Deux triggers simultanés | `LockService.getScriptLock()` — séquentialise les exécutions |
| Drive ID absent | Guard `if (driveDossierID)` — workflow continue sans Drive |

---

## 12. Relances automatiques

Un trigger s'exécute **chaque jour à 8h00** et renvoie l'email de notification au validateur en attente si toutes les conditions sont réunies :

- Statut global de la demande = `En cours`
- Un niveau est en `En attente` avec un token valide (non utilisé, non invalidé)
- La date de début de l'absence est **dans le futur**
- Au moins `DELAI_RELANCE_JOURS` jours se sont écoulés depuis la dernière relance (ou la soumission initiale)

---

## 13. Menu Absences — outils d'administration

Accessible depuis le Google Sheet après ouverture (rechargez la page si absent).

| Option | Description |
|--------|-------------|
| **Filtrer par mois / année** | Masque les lignes hors période (ex : `3/2026` ou `2026`) |
| **Tout afficher** | Réaffiche toutes les lignes |
| **⚙️ Activer validation manuelle** | Installe le trigger `traiterDecisionManuelle` (à faire une fois) |
| **Renvoyer une validation** | Renvoie l'email au validateur en attente si le lien est perdu |
| **Reprendre un traitement échoué** | Rejoue `onFormSubmit` sur une ligne (régénère tokens et Drive si absents) |
| **Nettoyer les triggers en double** | Supprime les triggers dupliqués pour éviter les doubles traitements |
| **Reconfigurer les couleurs** | Réapplique les couleurs conditionnelles sur Q / R / S / Y |
| **Reconfigurer les protections** | Réapplique toutes les protections et dropdowns (après ajout de supérieur par ex.) |

---

## 14. Dépannage

### Le formulaire ne déclenche rien

1. Vérifier que le trigger `onFormSubmit` est installé : Apps Script → **Déclencheurs**
2. Relancer `initialiserProjet()` si absent
3. Vérifier `SHEET_REPONSES_ID` et `ONGLET_REPONSES` dans `Config.gs`
4. Consulter les logs : Apps Script → **Exécutions**

### Les emails ne partent pas

1. Vérifier les quotas Gmail : 100/jour (compte personnel), 1 500/jour (Workspace)
2. Vérifier les adresses dans `Config.gs` (`EMAIL_RH`, `EMAIL_PRESIDENCE`, `SUP_NOMS`)
3. Vérifier que les adresses email n'ont pas de fautes de frappe (espaces, majuscules)

### La validation manuelle ne réagit pas

1. Vérifier que le trigger est bien installé : menu **Absences** → **⚙️ Activer validation manuelle**
2. Vérifier que vous êtes bien dans la liste des éditeurs de la colonne (Q, R ou S)
3. Vérifier l'orthographe exacte : `Approuvé` (accent sur le é) ou `Rejeté`
4. Si doublon de trigger : menu **Absences** → **Nettoyer les triggers en double**
5. Consulter les logs Apps Script pour voir les messages d'erreur

### Le dossier Drive n'est pas créé

1. Vérifier `DRIVE_DOSSIER_RACINE` et `DRIVE_DOSSIER_TEMPLATE` dans `Config.gs`
2. Vérifier que le dossier template contient **exactement un seul** fichier Google Doc
3. Vérifier que le compte propriétaire du script a les droits d'édition sur les dossiers
4. Si un log `[WARN]` signale plusieurs fichiers dans le template, supprimer les fichiers en trop

### Le doc final ne montre pas la décision

Vérifier que le template contient bien les balises `{{AVIS_SUPERIEUR}}`, `{{AVIS_RH}}`, `{{AVIS_PRESIDENCE}}`, `{{COMMENTAIRE}}`, `{{DATE_CLOTURE}}` telles quelles (non remplacées, non supprimées accidentellement).

### Une demande est bloquée "En cours" indéfiniment

1. Menu **Absences** → **Renvoyer une validation** → saisir la référence (ABS-AAAA-XXXX)
2. Si le token est invalide ou corrompu → **Reprendre un traitement échoué** (régénère tout)

### Rejet automatique inattendu le week-end

Vérifier que les jours fériés concernés sont bien listés dans `JOURS_FERIES` (Config.gs).
Le système ne compte pas les samedis, dimanches et jours fériés dans le délai.

---

## 15. Maintenance annuelle

À faire chaque début d'année (janvier) :

- [ ] Mettre à jour `JOURS_FERIES` dans `Config.gs` avec les dates de la nouvelle année
  - Inclure les fêtes islamiques (Korité, Tabaski, Maouloud, Tamkharit) dont les dates changent chaque année
- [ ] Vérifier et mettre à jour `SUP_NOMS` si des responsables ont changé de poste ou quitté
- [ ] Vérifier `EMAIL_RH` et `EMAIL_PRESIDENCE` si les responsables ont changé
- [ ] Menu **Absences** → **Reconfigurer les protections** (après tout changement dans `SUP_NOMS`)
- [ ] Archiver ou filtrer les demandes de l'année précédente (menu **Filtrer par mois / année**)
- [ ] Vérifier les quotas Gmail si le volume de demandes augmente (envisager Workspace si besoin)

---

## Licence

Usage interne — Massaka. Tous droits réservés.
