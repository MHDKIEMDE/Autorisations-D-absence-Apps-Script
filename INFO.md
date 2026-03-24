# Guide d'installation — Système d'autorisation d'absence Massaka

---

## 1. Prérequis

Avant de commencer, assurez-vous de disposer de :

- Un compte Google Workspace avec accès à **Google Sheets**, **Google Drive**, **Google Docs** et **Gmail**
- Le **Google Sheet de réponses** du formulaire déjà créé (colonnes A→T remplies par le formulaire)
- L'**ID du Google Sheet** de réponses (visible dans l'URL : `spreadsheets/d/[ID]/edit`)
- Un **dossier Google Drive** créé pour stocker les dossiers de demandes
- Un **dossier Google Drive** contenant le modèle Google Doc (template avec balises `{{...}}`)
- Les droits pour déployer une **Apps Script Web App** (Exécuter en tant que : Moi)

---

## 2. Étapes d'installation

### Étape 1 — Créer le projet Apps Script

1. Ouvrir le Google Sheet de réponses
2. Menu **Extensions → Apps Script**
3. Supprimer le contenu par défaut de `Code.gs`
4. Créer les 8 fichiers suivants (bouton **+** → Fichier de script) :
   - `Config.gs`
   - `Utils.gs`
   - `Setup.gs`
   - `Code.gs`
   - `Workflow.gs`
   - `DriveManager.gs`
   - `Notifications.gs`
   - `WebApp.gs`
5. Copier le contenu de chaque fichier fourni dans le fichier correspondant

### Étape 2 — Renseigner l'ID du Sheet

Dans **Config.gs**, ligne 8, remplacer :
```javascript
SHEET_REPONSES_ID: 'REMPLACER_PAR_ID_DU_SHEET_REPONSES',
```
Par l'ID réel du Google Sheet de réponses.

### Étape 3 — Exécuter l'initialisation

1. Dans l'éditeur Apps Script, ouvrir **Setup.gs**
2. Sélectionner la fonction `initialiserProjet` dans le menu déroulant
3. Cliquer sur **Exécuter**
4. Autoriser les permissions demandées (accès Drive, Gmail, Sheets)
5. Une alerte de confirmation s'affiche dans le sheet

Cette étape crée automatiquement :
- L'onglet `CONFIG` avec les clés de configuration
- L'onglet `LOGS` avec les en-têtes colorés
- Les en-têtes des colonnes U → AB dans le sheet réponses
- Le trigger `onFormSubmit`

### Étape 4 — Configurer l'onglet CONFIG

Ouvrir l'onglet `CONFIG` du Google Sheet et renseigner les valeurs réelles :

| Clé | Valeur à renseigner |
|---|---|
| `EMAIL_RH` | Email du responsable RH |
| `NOM_RH` | Nom affiché du responsable RH |
| `EMAIL_PRESIDENCE_1` | Email du premier contact Présidence |
| `NOM_PRESIDENCE_1` | Nom affiché (ex : Président) |
| `EMAIL_PRESIDENCE_2` | Email du second contact Présidence |
| `NOM_PRESIDENCE_2` | Nom affiché (ex : Directeur Général) |
| `DRIVE_DOSSIER_RACINE` | ID du dossier racine Drive (voir étape 5) |
| `DRIVE_DOSSIER_TEMPLATE` | ID du dossier template Drive (voir étape 5) |
| `WEBAPP_URL` | URL de déploiement (voir étape 6) |
| `NOM_ORG` | Massaka |

**Supérieurs hiérarchiques (optionnel — pour afficher leur nom dans les emails) :**

Ajouter une ligne par supérieur :
- Colonne A : `SUP_email@domaine.com`
- Colonne B : `Prénom Nom — Poste`

> Si un email de supérieur n'est pas dans CONFIG, l'email brut sera affiché à la place. Le système continue de fonctionner.

### Étape 5 — Préparer Google Drive

**a) Dossier racine**
1. Dans Google Drive, créer un dossier nommé `Autorisation d'absence`
2. Copier son ID depuis l'URL : `drive.google.com/drive/folders/[ID]`
3. Coller cet ID dans CONFIG → `DRIVE_DOSSIER_RACINE`

**b) Dossier template**
1. Créer un dossier nommé ``
2. Y déposer le modèle Google Doc contenant les balises `{{...}}` (voir section 5)
3. Copier l'ID de ce dossier dans CONFIG → `DRIVE_DOSSIER_TEMPLATE`

> Le script utilise le **premier fichier** trouvé dans le dossier template. Ne mettre qu'un seul fichier dans ce dossier.

### Étape 6 — Déployer la Web App

1. Dans l'éditeur Apps Script : **Déployer → Nouveau déploiement**
2. Type : **Application Web**
3. Paramètres :
   - **Exécuter en tant que :** Moi
   - **Accès :** Tout le monde (sans connexion requise)
4. Cliquer sur **Déployer**
5. Copier l'URL fournie (format : `https://script.google.com/macros/s/[ID]/exec`)
6. Coller cette URL dans CONFIG → `WEBAPP_URL`

> Chaque fois que vous modifiez le code, vous devez créer un **nouveau déploiement** pour que les changements soient pris en compte. L'URL reste la même si vous choisissez "Gérer les déploiements" → version spécifique.

---

## 3. Structure des dossiers Drive à créer manuellement

```
📁 Autorisation d'absence          ← créer ce dossier (ID → CONFIG DRIVE_DOSSIER_RACINE)
📁 Template Absence                 ← créer ce dossier (ID → CONFIG DRIVE_DOSSIER_TEMPLATE)
   📄 [Modèle Google Doc]           ← y déposer le template avec les balises {{...}}
```

Les sous-dossiers suivants sont créés **automatiquement** par le script à la première demande :

```
📁 Autorisation d'absence
   📁 [Nom Prénom de l'employé]    ← créé automatiquement
      📁 En attente                ← créé automatiquement
      📁 Accepté                   ← créé automatiquement
      📁 Rejeté                    ← créé automatiquement
         📁 ABS-2026-0001          ← dossier de la demande (déplacé selon statut)
            📄 ABS-2026-0001 – Nom Prénom   ← Google Doc rempli
```

---

## 4. Structure de l'onglet CONFIG

L'onglet `CONFIG` est créé automatiquement par `initialiserProjet()`. Il contient deux colonnes :
- **Colonne A** : clé (ne pas modifier les noms de clés)
- **Colonne B** : valeur (à renseigner)

```
Clé                       | Valeur (exemple)
--------------------------|------------------------------------------
EMAIL_RH                  | rh@massaka.com
NOM_RH                    | Fatou Diallo
EMAIL_PRESIDENCE_1        | president@massaka.com
NOM_PRESIDENCE_1          | Amadou Diallo — Président
EMAIL_PRESIDENCE_2        | dg@massaka.com
NOM_PRESIDENCE_2          | Mariama Ba — Directrice Générale
SUP_chef@massaka.com      | Ibrahima Sow — Chef de service
DRIVE_DOSSIER_RACINE      | 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs
DRIVE_DOSSIER_TEMPLATE    | 1EiUkdFqKjmstSr9Rb_xtVTGMpBd2Q7bA
WEBAPP_URL                | https://script.google.com/macros/s/.../exec
NOM_ORG                   | Massaka
```

---

## 5. Balises du template Google Doc

Le modèle Google Doc doit contenir ces balises exactement (avec les doubles accolades).
Elles seront remplacées automatiquement à chaque création de fiche.

**Balises statiques** (remplies à la création, ne changent pas) :

| Balise | Contenu |
|---|---|
| `{{ID_DEMANDE}}` | Référence de la demande (ex : ABS-2026-0001) |
| `{{NOM}}` | Nom de l'employé |
| `{{PRENOM}}` | Prénom de l'employé |
| `{{MATRICULE}}` | Matricule |
| `{{SERVICE}}` | Service / Poste |
| `{{TYPE_PERMISSION}}` | Permission exceptionnelle / ordinaire |
| `{{TYPE_ABSENCE}}` | Type ou motif d'absence |
| `{{DATE_DEBUT}}` | Date de début (jj/mm/aaaa) |
| `{{HEURE_DEBUT}}` | Heure de début (08h30) |
| `{{DATE_FIN}}` | Date de fin |
| `{{HEURE_FIN}}` | Heure de fin |
| `{{NB_JOURS}}` | Nombre de jours |
| `{{MOTIF}}` | Motif libre si saisi |
| `{{DATE_SOUMISSION}}` | Date et heure de soumission |

**Balises dynamiques** (mises à jour après chaque décision) :

| Balise | Contenu |
|---|---|
| `{{AVIS_SUPERIEUR}}` | En attente / Approuvé / Rejeté |
| `{{AVIS_RH}}` | En attente / Approuvé / Rejeté |
| `{{AVIS_PRESIDENCE}}` | En attente / Approuvé / Rejeté |
| `{{COMMENTAIRE}}` | Motif de rejet si applicable |
| `{{DATE_CLOTURE}}` | Date et heure de la décision finale |

---

## 6. Comment tester

### Test complet recommandé

1. **Soumettre une demande** via le Google Form lié au sheet
   - Choisir **Permission exceptionnelle**, type : **Famille**, date dans plus de 72h
   - Renseigner l'email du supérieur hiérarchique (une adresse accessible)

2. **Vérifier dans le sheet** (onglet Réponses) :
   - Colonnes U→AB remplies (ID, tokens, statut "En cours")
   - Colonne Q : "En attente"

3. **Vérifier l'email du supérieur** : email HTML reçu avec boutons Approuver/Rejeter

4. **Cliquer Approuver** → vérifier :
   - Email RH reçu
   - Colonne R : "En attente"
   - Onglet LOGS : entrée OK

5. **RH approuve** → vérifier :
   - Email Présidence reçu (2 emails)
   - Colonne S : "En attente"

6. **Présidence approuve** → vérifier :
   - Email final employé reçu (✅ Approuvé)
   - Dossier Drive déplacé dans "Accepté"
   - Google Doc mis à jour avec tous les avis

### Test rejet automatique 72h

Soumettre une demande avec date de début dans moins de 72h (type ≠ Maladie) :
- L'employé reçoit immédiatement un email de refus automatique
- Le dossier Drive est créé dans "Rejeté"
- Aucun email aux validateurs

---

## 7. En cas de problème

### Où regarder les logs

1. **Onglet LOGS** du Google Sheet — tous les WARN et ERREUR y sont écrits
2. **Apps Script → Exécutions** — historique complet avec stack traces
3. **Apps Script → Logger** — logs en temps réel pendant l'exécution manuelle

### Problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| Trigger ne se déclenche pas | Trigger non installé ou mauvais sheet | Ré-exécuter `initialiserProjet()` |
| "Aucun template trouvé" | Dossier template vide ou mauvais ID | Vérifier `DRIVE_DOSSIER_TEMPLATE` dans CONFIG |
| "Onglet CONFIG introuvable" | `initialiserProjet()` pas encore exécuté | Exécuter `initialiserProjet()` |
| Email non reçu | Quota Gmail dépassé ou email incorrect | Vérifier les emails dans CONFIG et l'onglet LOGS |
| Lien de validation invalide | WEBAPP_URL incorrecte dans CONFIG | Redéployer et mettre à jour `WEBAPP_URL` |
| Dossier Drive non créé | ID racine Drive incorrect | Vérifier `DRIVE_DOSSIER_RACINE` dans CONFIG |
| Bouton approuver → erreur | Web App non déployée en "Tout le monde" | Redéployer avec accès "Tout le monde" |

### Relancer après une erreur

1. Corriger la cause dans CONFIG ou le code
2. Si un nouveau déploiement est nécessaire : **Déployer → Gérer les déploiements → Nouvelle version**
3. Les demandes déjà en cours ne sont pas perdues — les tokens restent valides
4. Pour relancer manuellement le traitement d'une ligne : appeler `onFormSubmit` avec un objet simulé (usage avancé)

### Vérifier les permissions

Si le script demande des autorisations non accordées :
1. Apps Script → **Exécuter** `initialiserProjet()` manuellement
2. Cliquer **Examiner les autorisations** → **Autoriser**
3. Accepter toutes les demandes (Drive, Gmail, Sheets, Docs)
