# Système d'autorisation d'absence — Agribusiness TV

Système complet de gestion des demandes d'absence sur **Google Apps Script**.
Les employés soumettent via un **Google Form** ; les validateurs approuvent, rejettent
ou **demandent des précisions** soit **directement dans le Google Sheet**, soit via
**des liens email** (les deux modes coexistent sans conflit).

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
10. [Anti auto-validation et contrôle croisé](#10-anti-auto-validation-et-contrôle-croisé)
11. [Demande de précisions (aller-retour employé)](#11-demande-de-précisions-aller-retour-employé)
12. [Mode de validation manuelle (Sheet)](#12-mode-de-validation-manuelle-sheet)
13. [Règle de délai et jours ouvrables](#13-règle-de-délai-et-jours-ouvrables)
14. [Protections, identité et sécurité](#14-protections-identité-et-sécurité)
15. [Expéditeur des emails](#15-expéditeur-des-emails)
16. [Relances automatiques](#16-relances-automatiques)
17. [Menu Absences — outils d'administration](#17-menu-absences--outils-dadministration)
18. [Dépannage](#18-dépannage)
19. [Maintenance annuelle](#19-maintenance-annuelle)

---

## 1. Architecture

```
Google Form
    │  (soumission)
    ▼
Google Sheet ──► Apps Script (onFormSubmit)
    │                  │
    │          [Règle délai < 3 j. ouvrables]  → rejet auto → email employé
    │          [Exemption : types "sans délai" (ex. Urgence)]
    │                  │
    │          Résolution département → supérieur + workflow + nomOrg
    │          [Anti auto-validation : demandeur = supérieur → saut du niveau]
    │          Génération tokens + initialisation statuts
    │                  │
    │          Email accusé réception employé
    │          Email premier validateur (Supérieur ou Présidence)
    │
    ├── Validation manuelle (Sheet)     ◄── validateur édite col P / Q
    │       └── trigger traiterDecisionManuelle
    │           (contrôle d'identité par ligne + garde-fous motif)
    │
    └── Validation par email (WebApp)  ◄── validateur clique le lien
            └── doGet → traiterDecision / demanderPrecision
                    │
             [Approuvé / Rejeté / Précisions]
                    │
             ┌──────┴──────┐
          Approuvé       Rejeté
          (Présidence)     └── Email final employé (pas de Drive)
             │
        Drive créé (dossier + doc + PDF)
        Email final employé
```

**Cascade de validation :** le circuit dépend du département (voir § 9).
L'employé est notifié **uniquement** à la soumission, en cas de rejet, ou d'approbation finale.

---

## 2. Fichiers du projet

| Fichier | Rôle |
|---------|------|
| `Config.gs` | **Seul fichier à modifier.** `PERSONNEL` (supérieurs/présidents), `ADMINS`, IDs Drive/Sheet, délais, fériés, `SERVICE_SUP_MAP`, thème |
| `Code.gs` | Trigger `onFormSubmit` — réception, rejet délai, anti auto-validation, initialisation workflow, `onEdit` (garde de clôture) |
| `Workflow.gs` | Logique de décision — `traiterDecision` (WebApp), `demanderPrecision`, `enregistrerReponseEmploye`, `traiterDecisionManuelle` (Sheet) |
| `Notifications.gs` | Emails HTML — accusé réception, notification validateur, demande de précisions, confirmation finale |
| `DriveManager.gs` | Création dossier/doc Drive, template, PDF, déplacement par statut |
| `WebApp.gs` | Interface HTML de validation par lien email (`doGet`) — approuver / rejeter / demander des détails / répondre |
| `Setup.gs` | Initialisation, menu, protections de colonnes, dropdowns |
| `Relances.gs` | Relances automatiques quotidiennes, outils de maintenance |
| `Utils.gs` | Fonctions partagées — logs, UUID, `lireDemande`, formatage dates, jours ouvrables, résolution présidence, contrôle d'identité |

---

## 3. Prérequis

- Compte **Google** (GmailApp, Drive, DocumentApp)
- Un **Google Form** lié au Google Sheet
- Un **dossier Google Drive** racine avec sous-dossier `Accepté`
- Un **dossier template** Drive contenant **un seul** Google Doc (modèle officiel)
- Les validateurs et employés peuvent utiliser **n'importe quel compte** (ou aucun) :
  la sécurité repose sur le **token unique** du lien, pas sur le compte Google (voir § 14)

---

## 4. Installation pas à pas

### Étape 1 — Google Drive

```
Dossier racine/
└── Accepté/    ← créé automatiquement si absent

Dossier template/
└── [Modèle Google Doc]   ← un seul fichier
```

Notez les **IDs** des deux dossiers (URL Drive : `folders/XXXX`).

### Étape 2 — Configurer Config.gs

Renseigner obligatoirement :

```javascript
SHEET_REPONSES_ID:      'ID_du_Google_Sheet',
DRIVE_DOSSIER_RACINE:   'ID_dossier_racine',
DRIVE_DOSSIER_TEMPLATE: 'ID_dossier_template',
WEBAPP_URL:             'REMPLACER_APRES_DEPLOIEMENT',
```

Puis renseigner `PERSONNEL` (supérieurs + présidents), `ADMINS` et `SERVICE_SUP_MAP`
(voir § 5).

### Étape 3 — Initialiser le projet

Dans l'éditeur Apps Script, exécuter :
```
initialiserProjet()
```
Installe les triggers, en-têtes, protections et dropdowns.

### Étape 4 — Déployer la Web App

1. **Déployer → Nouveau déploiement**
2. Type : **Application Web** / Exécuter en tant que : **Moi** /
   Accès : **Toute personne** (`Anyone`) — évite tout écran d'autorisation
   aux validateurs et à l'employé (comptes Gmail/Workspace mixtes, voir § 14)
3. Copier l'URL → `Config.gs → WEBAPP_URL`

> ⚠️ À chaque modification de `WebApp.gs`, il faut **Déployer → Gérer les
> déploiements → Nouvelle version** pour que le changement soit servi.

### Étape 5 — Activer la validation manuelle

Menu **Absences** → **Activer validation manuelle**

### Étape 6 — Tester

- [ ] Colonnes S–AC remplies automatiquement après soumission
- [ ] Email accusé de réception reçu par l'employé
- [ ] Email notification reçu par le premier validateur
- [ ] Validation Sheet et lien email fonctionnent sans conflit
- [ ] Bouton « Demander plus de détails » du lien email fonctionne
- [ ] À l'approbation finale : dossier Drive + PDF créés dans `Accepté/`

---

## 5. Configuration (Config.gs)

### PERSONNEL — Supérieurs et présidents

Toutes les personnes (noms + emails) sont déclarées **ici uniquement**.

```javascript
PERSONNEL: {
  presidents: {
    PRES_GENERAL: { email: 'president@…', nom: 'Président Agribusiness TV' }
  },
  presidentCroise: {},      // sans objet : président unique (voir § 10)
  superieurs: {
    SUP_EDITORIAL: { email: 'superieur.editorial@…', nom: 'Responsable Éditorial' },
    SUP_TECHNIQUE: { email: 'superieur.technique@…', nom: 'Responsable Technique' }
  }
},
```

### ADMINS — Administrateurs exemptés

Emails autorisés à éditer manuellement **n'importe quelle** colonne d'avis (P/Q)
sans être le validateur désigné de la ligne (maintenance / tests).

```javascript
ADMINS: [
  'officie9@gmail.com'   // propriétaire du Sheet
],
```

### SERVICE_SUP_MAP — Mapping département → workflow

Clé de voûte. Chaque département du formulaire doit y figurer **exactement**
(même casse, même orthographe).

```javascript
SERVICE_SUP_MAP: {
  'Éditorial':      { sup: 'SUP_EDITORIAL', workflow: 'SUP_PRES', presidence: 'PRES_GENERAL', nomOrg: 'Agribusiness TV' },
  'Technique':      { sup: 'SUP_TECHNIQUE', workflow: 'SUP_PRES', presidence: 'PRES_GENERAL', nomOrg: 'Agribusiness TV' },
  'Administration': { sup: null,            workflow: 'PRES',     presidence: 'PRES_GENERAL', nomOrg: 'Agribusiness TV' },
},
```

| Champ | Description |
|-------|-------------|
| `sup` | **Clé** dans `PERSONNEL.superieurs` (ex. `'SUP_EDITORIAL'`), ou `null` |
| `workflow` | `'SUP_PRES'` (Supérieur → Présidence) ou `'PRES'` (Présidence directe) — voir § 9 |
| `presidence` | **Clé** dans `PERSONNEL.presidents` — quel président valide ce département (fallback : `PRES_GENERAL`) |
| `nomOrg` | Nom affiché de l'organisation dans les emails |

> Si un département du formulaire est absent de ce map, le workflow `PRES` est
> appliqué par défaut (avec un avertissement dans les logs).

---

## 6. Thèmes visuels par organisation

Le thème (couleurs, police des emails) est résolu par
`getThemeEmail(nomOrg, emailSup)` dans `Notifications.gs`, qui lit
**`CONFIG.THEME`** (une seule organisation).

Palette Agribusiness TV : entête vert foncé `#015438`, texte blanc,
badge / boutons vert clair `#7ED957`, police Proxima Nova.
Pour changer le branding, modifier uniquement `CONFIG.THEME` dans `Config.gs`.

---

## 7. Structure du Google Sheet

Colonnes **A–N** remplies par le formulaire. Colonnes **O–AC** gérées par le script.
Tous les indices sont centralisés dans `CONFIG.COL.*` — **ne jamais coder un numéro en dur**.

| Col | Nom | Source | Description |
|-----|-----|--------|-------------|
| A | Horodateur | Formulaire | Date/heure de soumission |
| B | Email employé | Formulaire | Sert à l'anti auto-validation et au contrôle d'identité |
| C–E | Matricule / Nom / Prénom | Formulaire | |
| F | **Département** | Formulaire | Valeur exacte → lookup `SERVICE_SUP_MAP` |
| G–N | Type, dates, heures, motif, durée | Formulaire | Selon type de permission |
| **O** | **Email supérieur** | **Script** | Résolu via `SERVICE_SUP_MAP[dépt].sup` → `PERSONNEL` |
| **P** | **Avis Supérieur** | **Validateur** | `En attente` / `Approuvé` / `Rejeté` / `En attente de précisions` |
| **Q** | **Avis Présidence** | **Validateur** | idem |
| **R** | **Commentaire** | **Validateur** | Motif de rejet **ou** message de demande de précisions — libre, sans protection |
| S | ID Demande | Script | `ABT-2026-0001` |
| T | Token Supérieur | Script | UUID usage unique |
| U | Token Présidence | Script | UUID usage unique |
| V | Statut global | Script | `En cours` / `Approuvé` / `Rejeté` / `Rejeté automatiquement` |
| W | Date clôture | Script | |
| X | Drive Dossier ID | Script | Lien cliquable |
| Y | Drive Doc ID | Script | Lien cliquable |
| Z | Dernière relance | Script | Date de la dernière relance |
| AA | Token précision | Script | Lien de réponse employé (demande de précisions) |
| AB | Niveau précision | Script | Niveau ayant demandé les précisions (`Superieur` / `Presidence`) |
| AC | Nb précisions | Script | Compteur d'allers-retours (max `MAX_PRECISIONS`) |

### États des tokens (colonnes T / U / AA)

| Valeur | Signification |
|--------|---------------|
| `<uuid>` | Actif — lien utilisable |
| `UTILISE_<uuid>` | Déjà consommé — décision enregistrée |
| `INVALIDE_<uuid>` | Annulé (niveau sauté ou en aval d'un rejet) |

---

## 8. Structure Google Drive

```
Dossier Racine/
└── Accepté/
    └── ABT-2026-0001 - Nom Employé/
        ├── ABT-2026-0001 - Nom Employé   ← Google Doc
        └── ABT-2026-0001 - Nom Employé.pdf

Dossier Template/
└── [Modèle document officiel]  ← 1 seul fichier
```

> Dossier, Google Doc et PDF créés **uniquement à l'approbation finale**.
> Les demandes rejetées n'ont aucune trace Drive.

---

## 9. Circuits de validation (workflows)

| Workflow | Circuit | Usage typique |
|----------|---------|---------------|
| `SUP_PRES` | Supérieur → Présidence | Départements avec supérieur (Éditorial, Technique) |
| `PRES` | Présidence directement | Département sans supérieur (Administration) |

Un **président unique** (`PRES_GENERAL`) : il valide ou
rejette seul, sa décision clôture la demande. Les niveaux sautés sont marqués
`Approuvé` et leurs tokens invalidés.

### Règles de notification employé

| Événement | Employé notifié ? |
|-----------|-------------------|
| Soumission | ✅ Accusé de réception |
| Approbation intermédiaire (Supérieur) | ❌ |
| Approbation finale (Présidence) | ✅ Confirmation + doc Drive |
| Rejet (tout niveau) | ✅ Email avec motif |
| Rejet automatique délai | ✅ Email avec explication |
| Demande de précisions | ✅ Email avec lien de réponse |

---

## 10. Anti auto-validation et contrôle croisé

Un validateur ne peut jamais valider sa propre demande.

- **Supérieur qui demande une absence** : à la soumission, si l'email du demandeur
  (col B) est celui du supérieur de son département, le niveau Supérieur est
  **sauté** (auto-marqué `Approuvé`, token invalidé) et la demande part directement
  à la Présidence. *(`onFormSubmit`, section 5)*

- **Président qui demande une absence** : la résolution de la présidence
  (`getPresidencePourSup`) détecte que le demandeur est le président normalement
  compétent et bascule vers le **président croisé** défini dans
  `PERSONNEL.presidentCroise`. **Agribusiness TV n'a qu'un président** :
  `presidentCroise` est vide, le président reste donc son propre validateur
  (un `WARN` est journalisé). Pour activer le contrôle croisé, déclarer un
  second président dans `PERSONNEL.presidents` puis renseigner `presidentCroise`.

---

## 11. Demande de précisions (aller-retour employé)

Avant de décider, un validateur peut demander des explications à l'employé.

**Circuit :**
1. Le validateur clique « Demander plus de détails » (lien email) **ou** choisit
   `En attente de précisions` dans le Sheet (avec message en colonne R d'abord).
2. `demanderPrecision()` consomme le token de décision, met le niveau à
   `En attente de précisions`, génère un token de réponse employé (col AA) et
   envoie un email à l'employé avec un lien de réponse.
3. L'employé répond via son lien (`action=REPONSE`). `enregistrerReponseEmploye()`
   incrémente le compteur (col AC), régénère un token de décision et **re-notifie
   le validateur** avec les précisions incluses.

**Quota :** `CONFIG.MAX_PRECISIONS` (défaut 2) allers-retours maximum. Au-delà,
le validateur doit approuver ou rejeter.

---

## 12. Mode de validation manuelle (Sheet)

1. Trouver la ligne (colonne S = référence `ABT-AAAA-XXXX`)
2. **Pour rejeter :** saisir le motif en **colonne R d'abord**, puis `Rejeté`
3. **Pour demander des précisions :** saisir le message en **colonne R d'abord**,
   puis `En attente de précisions`
4. Cliquer sur votre colonne (P Supérieur, Q Présidence) → choisir la valeur

> ⚠️ **Motif/message obligatoire :** un rejet ou une demande de précisions sans
> texte en colonne R → cellule annulée + message.
> ⚠️ **Ordre :** en `SUP_PRES`, la Présidence ne peut agir qu'après approbation du Supérieur.
> ⚠️ **Accès :** la colonne P est réservée aux supérieurs et la Q aux présidents
> via la protection de colonne native du Sheet (voir § 14).

### Coexistence Sheet ↔ lien email

| Scénario | Résultat |
|----------|---------|
| Sheet d'abord, puis lien email | Lien bloqué (« réponse déjà envoyée ») |
| Lien d'abord, puis tentative Sheet | Cellule annulée par `onEdit` |
| Double-clic lien email | Bloqué (token déjà utilisé) |

---

## 13. Règle de délai et jours ouvrables

**Toutes les permissions** (sauf types listés dans `TYPES_SANS_DELAI`, ex. Urgence)
sont rejetées automatiquement si le début est à moins de
`DELAI_MIN_JOURS_OUVRABLES` jours ouvrables de la soumission (samedis, dimanches
et `JOURS_FERIES` exclus).

| Soumission | Début absence | Jours ouvrables | Résultat (délai = 3) |
|-----------|--------------|----------------|---------------------|
| Lundi | Jeudi | 3 | ✅ Accepté |
| Lundi | Mercredi | 2 | ❌ Rejeté auto |
| Vendredi | Mercredi suivant | 3 | ✅ Accepté |

---

## 14. Protections, identité et sécurité

| Colonne | Éditeurs autorisés | Protection |
|---------|--------------------|-----------|
| A–N | Avertissement | Soft |
| O (Email sup.) | Script | Système (avertissement) |
| P (Avis Sup.) | Emails de `PERSONNEL.superieurs` | Strict (protection colonne native) |
| Q (Avis Présidence) | Emails de `PERSONNEL.presidents` | Strict (protection colonne native) |
| R (Commentaire) | Tous | Libre |
| S–AC (système) | Avertissement | Réservé au script |

### Sécurité par token (pas par compte Google)

Les validateurs et l'employé utilisant des comptes **mixtes** (Gmail perso +
Workspace), le système **ne vérifie pas le compte Google** du visiteur. La
sécurité repose sur le **token UUID à usage unique** du lien email :
- Seul celui qui a reçu l'email possède le token.
- Le token est invalidé (`UTILISE_` / `INVALIDE_`) après usage → non rejouable.

Cela évite tout écran d'autorisation et tout blocage « compte non attribué ».

> ⚠️ **Déploiement en « Execute as: Me » + « Toute personne » (`Anyone`).**
> C'est ce qui garantit qu'aucun visiteur (validateur ou employé) ne voit
> l'écran d'autorisation « Unverified » de Google.

> La restriction « seul le bon validateur édite sa ligne » dans le **Sheet**
> reste assurée par la **protection de colonne native** (P réservée aux
> supérieurs, Q aux présidents). Les fonctions `controlerIdentite` /
> `emailsAutorisesPourNiveau` restent dans le code mais sont **inactives**
> (réutilisables si un jour tous les comptes sont sur un même domaine Workspace).

### Autres gardes dans le code

| Situation | Mécanisme |
|-----------|-----------|
| Double-clic lien email | Vérifie que le niveau est encore « En attente » |
| Ré-édition après décision | `onEdit` (simple) annule + toast |
| Validation hors ordre | Annulation + toast |
| Rejet / précisions sans texte | Annulation + toast |
| Réentrance demande de précisions | Garde `En attente de précisions` + garde interne `demanderPrecision` |
| Exécutions simultanées | `LockService.getScriptLock()` (5 s) |

---

## 15. Expéditeur des emails

Les emails partent via **`GmailApp.sendEmail(...)`**, donc **depuis le compte Google
qui exécute le script** (le propriétaire, « Execute as: Me »). Le paramètre
`name: nomOrg` affiche « Agribusiness TV » comme nom d'expéditeur.

Pour utiliser une **autre adresse** :
1. **Alias Gmail** (le plus simple) : créer l'alias dans Gmail
   (Paramètres → Comptes → « Envoyer des e-mails en tant que »), puis passer
   `from: 'alias@…'` dans les options des appels `sendEmail`.
2. **Compte dédié** : déployer le script depuis un autre compte Google.

> ⚠️ Gmail n'autorise `from:` que pour un **alias déjà validé** sur le compte
> exécutant. Une adresse arbitraire non validée sera ignorée.

---

## 16. Relances automatiques

Trigger quotidien **8h00** (`verifierEtRelancer`) — renvoie l'email au validateur
en attente si :
- Statut global = `En cours`
- Niveau en `En attente` avec token valide
- Au moins `DELAI_RELANCE_JOURS` jours depuis la dernière relance ou la soumission

---

## 17. Menu Absences — outils d'administration

| Option | Description |
|--------|-------------|
| **Filtrer par mois / année** | Masque les lignes hors période |
| **Tout afficher** | Réaffiche toutes les lignes |
| **Activer validation manuelle** | Installe le trigger `traiterDecisionManuelle` |
| **Renvoyer une validation** | Renvoie l'email si le lien est perdu |
| **Reprendre un traitement échoué** | Rejoue le traitement (régénère tokens/Drive) |
| **Nettoyer les triggers en double** | Supprime les triggers dupliqués |
| **Reconfigurer les couleurs** | Réapplique les couleurs conditionnelles |
| **Reconfigurer les protections** | Réapplique protections et dropdowns |
| **Initialiser le projet** | Setup complet : en-têtes, 3 triggers, protections |

---

## 18. Dépannage

### Le formulaire ne déclenche rien
1. Vérifier le trigger `onFormSubmit` : Apps Script → **Déclencheurs**
2. Relancer `initialiserProjet()` si absent
3. Vérifier `SHEET_REPONSES_ID` et `ONGLET_REPONSES`

### Le mail « à valider » revient au demandeur / n'arrive pas au bon président
1. Vérifier que les emails de `PERSONNEL` sont les **vraies** adresses (pas les exemples `@agribusinesstv.com`)
2. Vérifier `SERVICE_SUP_MAP[dépt].presidence` (président unique : `PRES_GENERAL`)
3. Rappel : un supérieur/président qui demande lui-même est routé ailleurs (§ 10)

### La demande de précisions ne part pas (page blanche via le lien)
> Corrigé : le bouton « Demander plus de détails » soumet désormais proprement.
1. Vérifier qu'une **nouvelle version** du déploiement Web App a été publiée

### La validation manuelle ne réagit pas
1. Vérifier le trigger : menu **Absences** → **Activer validation manuelle**
2. Orthographe exacte : `Approuvé` (é) / `Rejeté` / `En attente de précisions`
3. **Identité** : êtes-vous connecté avec le compte du validateur désigné de la ligne ? (§ 14)
4. Pour une demande de précisions manuelle : le message doit être en **colonne R d'abord**

### « Cette demande ne vous est pas attribuée » alors que je suis le bon validateur
1. Déploiement bien en « **Toute personne disposant d'un compte Google** » ?
2. Le compte Google connecté correspond-il **exactement** à l'email de `Config.gs` ?
3. Compte hors domaine → `Session.getActiveUser()` peut être vide (§ 14)

### Les emails ne partent pas
1. Quotas Gmail (100/j compte perso, 1 500/j Workspace)
2. Adresses dans `Config.gs` sans espaces ni fautes

### Le dossier Drive n'est pas créé
> Normal si la demande est en cours ou rejetée — Drive uniquement à l'approbation finale.
1. Vérifier `DRIVE_DOSSIER_RACINE` / `DRIVE_DOSSIER_TEMPLATE`
2. Le dossier template doit contenir **exactement 1** Google Doc
3. Erreur « Impossible d'accéder au document » → **Reprendre un traitement échoué** (lag de propagation Drive)

---

## 19. Maintenance annuelle

À faire chaque janvier :

- [ ] Mettre à jour `JOURS_FERIES` (Korité, Tabaski, Maouloud, Tamkharit changent chaque année)
- [ ] Mettre à jour `PERSONNEL` si des responsables/présidents ont changé
- [ ] Vérifier `ADMINS`
- [ ] Menu **Absences** → **Reconfigurer les protections**
- [ ] Archiver ou filtrer les demandes de l'année précédente

---

## Licence

Usage interne — Agribusiness TV. Tous droits réservés.
