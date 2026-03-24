# PROMPT CLAUDE CODE — v2
# Système d'autorisation d'absence – Massaka (Google Apps Script)

---

## TA MISSION

Développe un système complet Google Apps Script qui automatise le workflow de validation des demandes d'autorisation d'absence pour l'organisation Massaka. Tu vas créer plusieurs fichiers `.gs` interconnectés, déployables directement dans l'éditeur Apps Script Google.

---

## CHARTE GRAPHIQUE MASSAKA (à appliquer dans tous les HTML)

```
Couleur principale : Bleu canard   → #016579
Couleur secondaire : Jaune doré    → #f8c542
Texte sur fond sombre              → #ffffff
Texte corps                        → #333333
Fond page                          → #f4f4f4
Fond carte                         → #ffffff
```

---

## STRUCTURE DU GOOGLE SHEET DE RÉPONSES (EXISTANT — NE PAS MODIFIER A→T)

```
A  = Horodateur
B  = Adresse e-mail (employé)
C  = Matricule
D  = Nom
E  = Prénom
F  = Service / Fonction
G  = Type de permission        → "Permission exceptionnelle" ou "Permission ordinaire"
H  = Type d'absence            → 13 valeurs (Permission exceptionnelle)
I  = Date du début
J  = Heure de début
K  = Date du fin
L  = Heure de fin
M  = Précisez le motif (si non trouvé dans la liste)
N  = Motif de l'absence        → Permission ordinaire uniquement
O  = Nombre de jours sollicités → Permission ordinaire uniquement
P  = Adresse e-mail du supérieur hiérarchique
Q  = Avis supérieur hiérarchique   → "En attente" / "Approuvé" / "Rejeté"
R  = Avis GRH                      → "En attente" / "Approuvé" / "Rejeté"
S  = Avis présidence               → "En attente" / "Approuvé" / "Rejeté"
T  = Commentaire                   → motif de rejet ou commentaire final
```

### Colonnes supplémentaires gérées par le script (U→Z) — créer si absentes :
```
U  = ID_Demande           → ABS-2026-0001 (auto-incrémenté)
V  = Token_Superieur      → UUID à usage unique
W  = Token_RH             → UUID à usage unique
X  = Token_Presidence     → UUID à usage unique (partagé entre les 2 contacts)
Y  = Statut_Global        → "En cours" / "Approuvé" / "Rejeté" / "Rejeté automatiquement"
Z  = Date_Cloture         → timestamp de la décision finale
AA = Drive_DossierID      → ID du dossier Google Drive de l'employé pour cette demande
AB = Drive_DocID          → ID du Google Doc de la fiche imprimable
```

### Valeurs possibles pour "Type d'absence" (colonne H — Permission exceptionnelle) :
- Maladie
- Famille
- Administration
- Activités judiciaires
- Motif syndical
- Congé parental
- Mariage du travailleur (02 jours)
- Naissance d'un enfant (03 jours)
- Décès du conjoint ou d'un ascendant en ligne directe (02 jours)
- Mariage d'un enfant, d'un frère, ou d'une sœur en ligne directe (02 jours)
- Décès d'un ascendant, d'un frère ou d'une sœur en ligne directe (02 jours)
- Décès d'un beau-père ou d'une belle-mère en ligne directe (02 jours)
- Autre

---

## CONFIGURATION — UN SEUL GOOGLE SHEET (ONGLET DÉDIÉ)

> ⚠️ Il n'y a PAS de second Google Sheet séparé.
> Toute la configuration est stockée dans un onglet `CONFIG` du même Google Sheet de réponses.

### Fonction getConfig() — à implémenter dans Config.gs :
```javascript
function getConfig() {
  const ss     = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
  const sheet  = ss.getSheetByName('CONFIG');
  const data   = sheet.getDataRange().getValues();
  const config = {};
  // Lire chaque ligne : colonne A = clé, colonne B = valeur
  data.forEach(row => { if (row[0]) config[row[0]] = row[1]; });
  return config;
}
```

### Structure de l'onglet `CONFIG` (colonne A = clé, colonne B = valeur) :
```
Clé                    | Valeur
-----------------------|-----------------------------------------------
EMAIL_RH               | rh@massaka.com
NOM_RH                 | Responsable RH
EMAIL_PRESIDENCE_1     | president@massaka.com
NOM_PRESIDENCE_1       | Président
EMAIL_PRESIDENCE_2     | dg@massaka.com
NOM_PRESIDENCE_2       | Directeur Général
SUP_mohamed@agence-mediaprod.com   | Mohamed - Agence Principale
SUP_mohamed@agence1-mediaprod.com  | Mohamed - Agence 1
SUP_mohamed@agence2-mediaprod.com  | Mohamed - Agence 2
SUP_mohamed@agence3-mediaprod.com  | Mohamed - Agence 3
DRIVE_DOSSIER_RACINE   | (ID du dossier racine "Autorisation d'absence")
DRIVE_DOSSIER_TEMPLATE | (ID du dossier contenant le template Google Doc)
WEBAPP_URL             | (URL après déploiement)
NOM_ORG                | Massaka
```

> Les noms de supérieurs sont préfixés `SUP_` suivi de leur email pour lecture dynamique.

---

## ARCHITECTURE DES FICHIERS

```
Config.gs        → Constantes, getConfig(), index des colonnes
Code.gs          → Trigger onFormSubmit, rejet automatique 72h
Workflow.gs      → Logique cascade de validation
Notifications.gs → Emails HTML (validateurs + employé final uniquement)
WebApp.gs        → doGet() : interface HTML de validation
DriveManager.gs  → Création dossiers, doc, déplacements Drive
Utils.gs         → UUID, lireDemande, trouverToken, formatDate, logs
Setup.gs         → Initialisation unique (colonnes, trigger, onglet CONFIG)
```

---

## FICHIER : Config.gs

```javascript
const CONFIG = {
  // ⚠️ Seul ID à renseigner manuellement
  SHEET_REPONSES_ID: 'REMPLACER_PAR_ID_DU_SHEET_REPONSES',

  // Noms des onglets
  ONGLET_REPONSES: 'Réponses au formulaire 1',
  ONGLET_CONFIG:   'CONFIG',

  // Délai de préavis minimum en heures (Permission exceptionnelle uniquement)
  DELAI_MIN_HEURES: 72,

  // Index des colonnes (base 1)
  COL: {
    HORODATEUR:    1,   // A
    EMAIL_EMPLOYE: 2,   // B
    MATRICULE:     3,   // C
    NOM:           4,   // D
    PRENOM:        5,   // E
    SERVICE:       6,   // F
    TYPE_PERM:     7,   // G
    TYPE_ABSENCE:  8,   // H
    DATE_DEBUT:    9,   // I
    HEURE_DEBUT:   10,  // J
    DATE_FIN:      11,  // K
    HEURE_FIN:     12,  // L
    MOTIF_LIBRE:   13,  // M
    MOTIF_LONG:    14,  // N
    NB_JOURS:      15,  // O
    EMAIL_SUP:     16,  // P
    AVIS_SUP:      17,  // Q
    AVIS_RH:       18,  // R
    AVIS_PRES:     19,  // S
    COMMENTAIRE:   20,  // T
    ID_DEMANDE:    21,  // U
    TOKEN_SUP:     22,  // V
    TOKEN_RH:      23,  // W
    TOKEN_PRES:    24,  // X
    STATUT_GLOBAL: 25,  // Y
    DATE_CLOTURE:  26,  // Z
    DRIVE_DOSSIER: 27,  // AA
    DRIVE_DOC:     28   // AB
  }
};
```

---

## FICHIER : Utils.gs — Logs structurés + utilitaires

### Système de logs — implémenter comme suit :

```javascript
// Niveaux : INFO | OK | WARN | ERREUR
// Format  : [NIVEAU][CONTEXTE] message — timestamp
function log(niveau, contexte, message) {
  const ts  = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' });
  const txt = `[${niveau}][${contexte}] ${message} — ${ts}`;
  Logger.log(txt);
  // Pour les erreurs : aussi écrire dans l'onglet LOGS du sheet
  if (niveau === 'ERREUR' || niveau === 'WARN') {
    try {
      const ss    = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
      let logSheet = ss.getSheetByName('LOGS');
      if (!logSheet) logSheet = ss.insertSheet('LOGS');
      logSheet.appendRow([ts, niveau, contexte, message]);
    } catch(e) { Logger.log('[ERREUR][Utils] Impossible d\'écrire dans LOGS: ' + e); }
  }
}
```

### Logs à placer obligatoirement à chaque étape :

| Étape | Niveau | Contexte | Message |
|---|---|---|---|
| Soumission reçue | INFO | onFormSubmit | `Nouvelle demande reçue - ligne ${row}` |
| Vérification 72h | INFO | rejet72h | `Vérification délai pour ${idDemande} : ${heuresRestantes}h avant début` |
| Rejet auto 72h | WARN | rejet72h | `Demande ${idDemande} rejetée automatiquement : délai insuffisant (${h}h < 72h)` |
| Token généré | INFO | initTokens | `Tokens générés pour ${idDemande}` |
| Doc créé | INFO | DriveManager | `Doc créé : ${docId} pour ${idDemande}` |
| Dossier créé | INFO | DriveManager | `Dossier créé : ${folderId} - ${nomEmploye}` |
| Dossier déplacé | INFO | DriveManager | `Dossier ${idDemande} déplacé vers "${statut}"` |
| Email envoyé | OK | Notifications | `Email envoyé à ${destinataire} - niveau ${niveau}` |
| Token invalide | WARN | WebApp | `Token invalide ou expiré : ${token.substring(0,8)}...` |
| Lien déjà utilisé | WARN | WebApp | `Tentative d'accès sur lien déjà utilisé - demande ${idDemande}` |
| Décision validateur | OK | Workflow | `Décision ${decision} enregistrée - ${niveau} - demande ${idDemande}` |
| Clôture demande | OK | Workflow | `Demande ${idDemande} clôturée : ${statut}` |
| Erreur critique | ERREUR | (contexte) | Message d'erreur complet + stack |

### Autres fonctions Utils :

```javascript
// Génère un UUID v4
function genererUUID() { ... }

// Génère un ID auto-incrémenté : ABS-2026-0001
function genererIdDemande(sheet) { ... }

// Retourne le sheet des réponses
function getSheetReponses() {
  return SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID)
    .getSheetByName(CONFIG.ONGLET_REPONSES);
}

// Lit une ligne et retourne un objet structuré complet :
// { idDemande, emailEmploye, matricule, nom, prenom, nomComplet,
//   service, typePerm, typeAbsence, dateDebut, heureDebut,
//   dateFin, heureFin, motifLibre, motifLong, nbJours,
//   emailSuperieur, avisSuperieur, avisRH, avisPres,
//   commentaire, tokenSup, tokenRH, tokenPres,
//   statutGlobal, driveDossierID, driveDocID }
function lireDemande(sheet, row) { ... }

// Cherche token dans colonnes V, W, X — ignore préfixes UTILISE_/INVALIDE_
// Retourne { row, niveau: 'Superieur'|'RH'|'Presidence' } ou null
function trouverLigneParToken(token) { ... }

// Résout le nom d'un supérieur depuis son email via onglet CONFIG (clé SUP_email)
function getNomSuperieur(email) { ... }

// Formate une date objet en "lundi 23 mars 2026 à 08h30"
function formatDateHeure(date) { ... }

// Écrit une valeur dans une cellule
function ecrireColonne(sheet, row, colIndex, valeur) {
  sheet.getRange(row, colIndex).setValue(valeur);
}

// Calcule le nombre d'heures entre maintenant et une date future
function heuresAvant(dateDebut) {
  return (dateDebut - new Date()) / (1000 * 60 * 60);
}
```

---

## FICHIER : Code.gs — Trigger + Rejet automatique 72h

```javascript
function onFormSubmit(e) {
  const sheet = e.range.getSheet();
  const row   = e.range.getRow();
  log('INFO', 'onFormSubmit', `Nouvelle soumission reçue - ligne ${row}`);

  try {
    // 1. Lire les données brutes de la ligne
    const typePerm  = sheet.getRange(row, CONFIG.COL.TYPE_PERM).getValue();
    const dateDebut = sheet.getRange(row, CONFIG.COL.DATE_DEBUT).getValue();
    const heureDebut = sheet.getRange(row, CONFIG.COL.HEURE_DEBUT).getValue();

    // 2. Générer l'ID de demande en premier
    const idDemande = genererIdDemande(sheet);
    ecrireColonne(sheet, row, CONFIG.COL.ID_DEMANDE, idDemande);
    log('INFO', 'onFormSubmit', `ID généré : ${idDemande}`);

    // 3. RÈGLE MÉTIER : Rejet automatique si délai < 72h
    //    Applicable UNIQUEMENT pour "Permission exceptionnelle"
    //    Exception : "Maladie" n'est PAS soumise au délai de 72h
    if (typePerm === 'Permission exceptionnelle') {
      const typeAbsence = sheet.getRange(row, CONFIG.COL.TYPE_ABSENCE).getValue();

      if (typeAbsence !== 'Maladie') {
        // Reconstituer la date+heure de début
        const dateHeureDebut = new Date(dateDebut);
        if (heureDebut) {
          const h = heureDebut.getHours ? heureDebut.getHours() : 0;
          const m = heureDebut.getMinutes ? heureDebut.getMinutes() : 0;
          dateHeureDebut.setHours(h, m, 0, 0);
        }
        const heuresRestantes = heuresAvant(dateHeureDebut);
        log('INFO', 'rejet72h', `Délai pour ${idDemande} : ${Math.round(heuresRestantes)}h avant début`);

        if (heuresRestantes < CONFIG.DELAI_MIN_HEURES) {
          log('WARN', 'rejet72h',
            `Demande ${idDemande} rejetée auto : ${Math.round(heuresRestantes)}h < 72h`);

          // Initialiser les colonnes
          ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,      'Rejeté automatiquement');
          ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,       '—');
          ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES,     '—');
          ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE,
            `Demande soumise moins de 72h avant la date d'absence. Délai effectif : ${Math.round(heuresRestantes)}h.`);
          ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, 'Rejeté automatiquement');
          ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());

          // Créer le dossier Drive + doc + classer en "Rejeté"
          const demande = lireDemande(sheet, row);
          const { dossierID, docID } = creerDossierEtDoc(demande);
          ecrireColonne(sheet, row, CONFIG.COL.DRIVE_DOSSIER, dossierID);
          ecrireColonne(sheet, row, CONFIG.COL.DRIVE_DOC, docID);
          deplacerVersDossierStatut(dossierID, demande.nomComplet, 'Rejeté');

          // Notifier l'employé
          envoyerConfirmationFinaleEmploye(
            lireDemande(sheet, row),
            'Rejeté',
            `Votre demande a été soumise moins de 72 heures avant la date d'absence prévue (délai effectif : ${Math.round(heuresRestantes)}h). Conformément au règlement, les demandes de permission exceptionnelle doivent être déposées au minimum 72 heures à l'avance.`
          );
          return; // Arrêt du traitement
        }
      }
    }

    // 4. Générer les tokens
    const tokenSup  = genererUUID();
    const tokenRH   = genererUUID();
    const tokenPres = genererUUID();
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP,  tokenSup);
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_RH,   tokenRH);
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRES, tokenPres);
    log('INFO', 'initTokens', `Tokens générés pour ${idDemande}`);

    // 5. Initialiser les statuts
    ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,      'En attente');
    ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,       '');
    ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES,     '');
    ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, 'En cours');

    // 6. Créer le dossier Drive + document imprimable + classer "En attente"
    const demande = lireDemande(sheet, row);
    const { dossierID, docID } = creerDossierEtDoc(demande);
    ecrireColonne(sheet, row, CONFIG.COL.DRIVE_DOSSIER, dossierID);
    ecrireColonne(sheet, row, CONFIG.COL.DRIVE_DOC,     docID);
    deplacerVersDossierStatut(dossierID, demande.nomComplet, 'En attente');
    log('OK', 'onFormSubmit', `Dossier et doc créés pour ${idDemande}`);

    // 7. Notifier le supérieur hiérarchique (niveau 1)
    envoyerNotificationValidateur(lireDemande(sheet, row), 'Superieur', tokenSup);

    // 8. Accusé de réception à l'employé
    envoyerAccuseReceptionEmploye(lireDemande(sheet, row));

    log('OK', 'onFormSubmit', `Demande ${idDemande} initialisée avec succès - ligne ${row}`);

  } catch (err) {
    log('ERREUR', 'onFormSubmit', `${err.toString()} | Stack: ${err.stack}`);
    MailApp.sendEmail({
      to: Session.getActiveUser().getEmail(),
      subject: '[ERREUR CRITIQUE] Système absence Massaka',
      body: `Erreur ligne ${row}.\n\nDétail: ${err.toString()}\n\nStack:\n${err.stack}`
    });
  }
}
```

---

## FICHIER : DriveManager.gs — Gestion Google Drive

### Structure des dossiers Drive :
```
📁 Autorisation d'absence                       ← dossier racine (ID dans CONFIG)
   📁 [Nom Prénom de l'employé]                 ← un dossier par employé
      📁 En attente                             ← dossier à la soumission
      📁 Accepté                                ← après validation présidence
      📁 Rejeté                                 ← après rejet à tout niveau
```

> Le dossier de la demande (nom de la demande = ID_Demande) est physiquement
> déplacé entre "En attente", "Accepté" ou "Rejeté" selon l'avancement.

### Template Google Doc :
- Stocké dans le dossier dont l'ID est `DRIVE_DOSSIER_TEMPLATE` (onglet CONFIG)
- Le script récupère le premier fichier de ce dossier comme template
- Il en fait une copie, la renomme `[ID_Demande] – [Nom Prénom]`
- La copie est placée dans le dossier "En attente" de l'employé
- Elle est remplie avec les données via `DocumentApp` (remplacement de balises)

### Balises à remplacer dans le template :
```
{{ID_DEMANDE}}         {{NOM}}              {{PRENOM}}
{{MATRICULE}}          {{SERVICE}}          {{TYPE_PERMISSION}}
{{TYPE_ABSENCE}}       {{DATE_DEBUT}}       {{HEURE_DEBUT}}
{{DATE_FIN}}           {{HEURE_FIN}}        {{NB_JOURS}}
{{MOTIF}}              {{DATE_SOUMISSION}}
{{AVIS_SUPERIEUR}}     {{AVIS_RH}}          {{AVIS_PRESIDENCE}}
{{COMMENTAIRE}}        {{DATE_CLOTURE}}
```

```javascript
/**
 * Crée le dossier employé, les sous-dossiers, copie et remplit le template.
 * @returns { dossierID: string, docID: string }
 */
function creerDossierEtDoc(demande) {
  log('INFO', 'DriveManager', `Création dossier/doc pour ${demande.idDemande}`);
  const cfg = getConfig();

  // 1. Récupérer le dossier racine
  const dossierRacine = DriveApp.getFolderById(cfg['DRIVE_DOSSIER_RACINE']);

  // 2. Trouver ou créer le dossier de l'employé (Nom Prénom)
  const nomEmploye = demande.nomComplet; // ex: "Martin Sophie"
  let dossierEmploye;
  const it = dossierRacine.getFoldersByName(nomEmploye);
  dossierEmploye = it.hasNext() ? it.next() : dossierRacine.createFolder(nomEmploye);
  log('INFO', 'DriveManager', `Dossier employé : ${dossierEmploye.getId()} - ${nomEmploye}`);

  // 3. Créer les sous-dossiers "En attente", "Accepté", "Rejeté" si absents
  ['En attente', 'Accepté', 'Rejeté'].forEach(nom => {
    const sub = dossierEmploye.getFoldersByName(nom);
    if (!sub.hasNext()) dossierEmploye.createFolder(nom);
  });

  // 4. Créer un sous-dossier pour cette demande dans "En attente"
  const dossierEnAttente = dossierEmploye.getFoldersByName('En attente').next();
  const dossierDemande   = dossierEnAttente.createFolder(demande.idDemande);
  log('INFO', 'DriveManager', `Dossier demande créé : ${dossierDemande.getId()}`);

  // 5. Copier le template et le renommer
  const dossierTemplate = DriveApp.getFolderById(cfg['DRIVE_DOSSIER_TEMPLATE']);
  const templateIt      = dossierTemplate.getFiles();
  if (!templateIt.hasNext()) throw new Error('Aucun template trouvé dans le dossier template.');
  const templateFile = templateIt.next();
  const docCopie     = templateFile.makeCopy(
    `${demande.idDemande} – ${demande.nomComplet}`,
    dossierDemande
  );
  log('INFO', 'DriveManager', `Doc copié : ${docCopie.getId()}`);

  // 6. Remplir le doc avec les données de la demande
  remplirTemplate(docCopie.getId(), demande);

  return { dossierID: dossierDemande.getId(), docID: docCopie.getId() };
}

/**
 * Remplace toutes les balises {{...}} dans le Google Doc.
 */
function remplirTemplate(docId, demande) {
  const doc  = DocumentApp.openById(docId);
  const body = doc.getBody();
  const remplac = {
    '{{ID_DEMANDE}}':      demande.idDemande        || '',
    '{{NOM}}':             demande.nom              || '',
    '{{PRENOM}}':          demande.prenom           || '',
    '{{MATRICULE}}':       demande.matricule        || '',
    '{{SERVICE}}':         demande.service          || '',
    '{{TYPE_PERMISSION}}': demande.typePerm         || '',
    '{{TYPE_ABSENCE}}':    demande.typeAbsence      || demande.motifLong || '',
    '{{DATE_DEBUT}}':      demande.dateDebut        || '',
    '{{HEURE_DEBUT}}':     demande.heureDebut       || '',
    '{{DATE_FIN}}':        demande.dateFin          || '',
    '{{HEURE_FIN}}':       demande.heureFin         || '',
    '{{NB_JOURS}}':        demande.nbJours          || '',
    '{{MOTIF}}':           demande.motifLibre || demande.motifLong || '',
    '{{DATE_SOUMISSION}}': formatDateHeure(new Date()),
    '{{AVIS_SUPERIEUR}}':  demande.avisSuperieur    || 'En attente',
    '{{AVIS_RH}}':         demande.avisRH           || '—',
    '{{AVIS_PRESIDENCE}}': demande.avisPres         || '—',
    '{{COMMENTAIRE}}':     demande.commentaire      || '',
    '{{DATE_CLOTURE}}':    demande.dateCloture ? formatDateHeure(demande.dateCloture) : '—'
  };
  Object.entries(remplac).forEach(([balise, valeur]) => {
    body.replaceText(balise, valeur);
  });
  doc.saveAndClose();
  log('OK', 'DriveManager', `Template rempli pour ${demande.idDemande}`);
}

/**
 * Déplace le dossier de la demande vers le sous-dossier de statut correct.
 * @param {string} dossierDemandeId - ID du dossier de la demande
 * @param {string} nomEmploye       - Nom complet de l'employé
 * @param {string} statut           - "En attente" | "Accepté" | "Rejeté"
 */
function deplacerVersDossierStatut(dossierDemandeId, nomEmploye, statut) {
  const cfg          = getConfig();
  const dossierRacine = DriveApp.getFolderById(cfg['DRIVE_DOSSIER_RACINE']);

  const dossierDemande  = DriveApp.getFolderById(dossierDemandeId);
  const dossierEmploye  = dossierRacine.getFoldersByName(nomEmploye).next();
  const cibleIt         = dossierEmploye.getFoldersByName(statut);

  if (!cibleIt.hasNext()) {
    log('WARN', 'DriveManager', `Dossier "${statut}" introuvable pour ${nomEmploye}, création...`);
    dossierEmploye.createFolder(statut);
  }
  const cible = dossierEmploye.getFoldersByName(statut).next();

  // Déplacer : ajouter au nouveau dossier, retirer des parents actuels
  cible.addFolder(dossierDemande);
  const parents = dossierDemande.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getId() !== cible.getId()) {
      parent.removeFolder(dossierDemande);
    }
  }

  // Mettre à jour les avis dans le doc après un changement de statut
  // (appelé après chaque décision de validateur via mettreAJourDoc)
  log('OK', 'DriveManager', `Dossier ${dossierDemandeId} déplacé vers "${statut}"`);
}

/**
 * Met à jour les balises d'avis dans le Google Doc après chaque décision.
 */
function mettreAJourDoc(demande) {
  if (!demande.driveDocID) return;
  try {
    const doc  = DocumentApp.openById(demande.driveDocID);
    const body = doc.getBody();
    body.replaceText('{{AVIS_SUPERIEUR}}',  demande.avisSuperieur || 'En attente');
    body.replaceText('{{AVIS_RH}}',         demande.avisRH        || '—');
    body.replaceText('{{AVIS_PRESIDENCE}}', demande.avisPres      || '—');
    body.replaceText('{{COMMENTAIRE}}',     demande.commentaire   || '');
    if (demande.dateCloture) {
      body.replaceText('{{DATE_CLOTURE}}',  formatDateHeure(new Date(demande.dateCloture)));
    }
    doc.saveAndClose();
    log('OK', 'DriveManager', `Doc mis à jour pour ${demande.idDemande}`);
  } catch(e) {
    log('ERREUR', 'DriveManager', `Impossible de mettre à jour le doc : ${e}`);
  }
}
```

---

## FICHIER : Workflow.gs

```javascript
/**
 * Traite la décision d'un validateur.
 * Règle de notification :
 *   - L'employé N'EST PAS notifié lors des approbations intermédiaires
 *   - L'employé EST notifié UNIQUEMENT en cas de :
 *       a) Rejet (à n'importe quel niveau)
 *       b) Approbation finale par la Présidence
 */
function traiterDecision(token, decision, motif) {
  log('INFO', 'Workflow', `Traitement décision - token: ${token.substring(0,8)}...`);

  const resultat = trouverLigneParToken(token);
  if (!resultat) {
    log('WARN', 'WebApp', `Token invalide ou expiré : ${token.substring(0,8)}...`);
    return { success: false, message: 'Ce lien de validation n\'est plus actif.' };
  }
  const { row, niveau } = resultat;

  const sheet   = getSheetReponses();
  const demande = lireDemande(sheet, row);

  // Vérifier que le statut du niveau est "En attente"
  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'RH':         CONFIG.COL.AVIS_RH,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[niveau];

  const statutActuel = sheet.getRange(row, colStatut).getValue();
  if (statutActuel !== 'En attente') {
    log('WARN', 'WebApp',
      `Tentative sur lien déjà utilisé - demande ${demande.idDemande} - niveau ${niveau}`);
    return {
      success: false,
      alreadyUsed: true,
      message: `La réponse pour cette demande (${demande.idDemande}) a déjà été envoyée au niveau "${niveau === 'Superieur' ? 'Supérieur hiérarchique' : niveau === 'RH' ? 'RH' : 'Présidence'}". Aucune action supplémentaire n'est nécessaire de votre part.`
    };
  }

  if (decision === 'REJETE' && (!motif || motif.trim() === '')) {
    return { success: false, message: 'Le motif de rejet est obligatoire.' };
  }

  if (decision === 'APPROUVE') {
    ecrireColonne(sheet, row, colStatut, 'Approuvé');
    log('OK', 'Workflow', `Décision APPROUVÉ enregistrée - ${niveau} - ${demande.idDemande}`);

    if (niveau === 'Superieur') {
      // Passer au RH — PAS de notification à l'employé
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH, 'En attente');
      const tokenRH = sheet.getRange(row, CONFIG.COL.TOKEN_RH).getValue();
      mettreAJourDoc(lireDemande(sheet, row));
      envoyerNotificationValidateur(lireDemande(sheet, row), 'RH', tokenRH);
      return { success: true, message: 'Demande approuvée. Le service RH a été notifié.' };

    } else if (niveau === 'RH') {
      // Passer à la Présidence — PAS de notification à l'employé
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      const tokenPres = sheet.getRange(row, CONFIG.COL.TOKEN_PRES).getValue();
      mettreAJourDoc(lireDemande(sheet, row));
      envoyerNotificationValidateur(lireDemande(sheet, row), 'Presidence', tokenPres);
      return { success: true, message: 'Demande approuvée. La présidence a été notifiée.' };

    } else if (niveau === 'Presidence') {
      // Invalider le token pour le 2e contact présidence
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRES, 'UTILISE_' + token);
      cloturerDemande(sheet, row, 'Approuvé', '');
      mettreAJourDoc(lireDemande(sheet, row));
      // Déplacer dans "Accepté"
      deplacerVersDossierStatut(demande.driveDossierID, demande.nomComplet, 'Accepté');
      // ✅ Notifier l'employé — approbation finale
      envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Approuvé', '');
      log('OK', 'Workflow', `Demande ${demande.idDemande} clôturée : Approuvée`);
      return { success: true, message: "Demande approuvée. L'employé a été notifié." };
    }

  } else if (decision === 'REJETE') {
    ecrireColonne(sheet, row, colStatut, 'Rejeté');
    ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE, motif.trim());
    invaliderTokensRestants(sheet, row, niveau);
    cloturerDemande(sheet, row, 'Rejeté', motif.trim());
    mettreAJourDoc(lireDemande(sheet, row));
    // Déplacer dans "Rejeté"
    deplacerVersDossierStatut(demande.driveDossierID, demande.nomComplet, 'Rejeté');
    // ✅ Notifier l'employé — rejet
    envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Rejeté', motif.trim());
    log('OK', 'Workflow', `Demande ${demande.idDemande} clôturée : Rejetée - motif: ${motif}`);
    return { success: true, message: "Demande rejetée. L'employé a été notifié avec le motif." };
  }
}

function cloturerDemande(sheet, row, statut, motif) {
  ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, statut);
  ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());
}

function invaliderTokensRestants(sheet, row, niveauRejet) {
  const ordre     = ['Superieur', 'RH', 'Presidence'];
  const colTokens = [CONFIG.COL.TOKEN_SUP, CONFIG.COL.TOKEN_RH, CONFIG.COL.TOKEN_PRES];
  const idx       = ordre.indexOf(niveauRejet);
  for (let i = idx + 1; i < ordre.length; i++) {
    const val = sheet.getRange(row, colTokens[i]).getValue();
    if (val && !val.toString().startsWith('INVALIDE_')) {
      ecrireColonne(sheet, row, colTokens[i], 'INVALIDE_' + val);
    }
  }
}
```

---

## FICHIER : Notifications.gs

Règle de notification à l'employé :
- ✅ **Accusé de réception** → à la soumission (toujours)
- ✅ **Notification validateur** → à chaque niveau (supérieur, RH, présidence)
- ❌ **PAS de notification** à l'employé lors des approbations intermédiaires (sup → RH → présidence)
- ✅ **Notification finale** → UNIQUEMENT si rejet (à tout niveau) OU approbation de la présidence

### Design HTML à appliquer sur TOUS les emails et pages web :
- En-tête : fond `#016579`, texte blanc, logo texte "massaka" ou icône M stylisée
- Bouton Approuver : `#016579`
- Bouton Rejeter : `#dc3545`
- Accent / badges : `#f8c542`
- Police : `'Segoe UI', Arial, sans-serif`
- Fond page : `#f4f4f4`, fond carte : `#ffffff`

### 1. `envoyerAccuseReceptionEmploye(demande)`
- **Destinataire :** `demande.emailEmploye`
- **Objet :** `[Massaka] Demande reçue – ${demande.idDemande}`
- **Corps :** Confirmation + récapitulatif + "Vous serez informé uniquement en cas de rejet ou d'approbation finale."

### 2. `envoyerNotificationValidateur(demande, niveau, token)`
- **Destinataires :**
  - `Superieur` → `demande.emailSuperieur`
  - `RH` → `cfg['EMAIL_RH']`
  - `Presidence` → `cfg['EMAIL_PRESIDENCE_1']` ET `cfg['EMAIL_PRESIDENCE_2']` (deux envois séparés)
- **Objet :** `[Massaka] À valider – ${demande.idDemande} – ${demande.prenom} ${demande.nom}`
- **Corps :** Récapitulatif demande + bouton bleu canard "APPROUVER" (lien direct) + bouton rouge "REJETER" (ouvre formulaire) + note explicative
- **Lien approuver :** `${cfg['WEBAPP_URL']}?token=${token}&action=APPROUVE`
- **Lien rejeter :**   `${cfg['WEBAPP_URL']}?token=${token}`

### 3. `envoyerConfirmationFinaleEmploye(demande, decision, motif)`
- **Destinataire :** `demande.emailEmploye`
- **Objet :**
  - Approuvé : `[Massaka] ✅ Absence approuvée – ${demande.idDemande}`
  - Rejeté :   `[Massaka] ❌ Absence refusée – ${demande.idDemande}`
- **Corps :** Résultat en grand (couleur) + récapitulatif + motif si rejeté + lien vers le Google Doc

---

## FICHIER : WebApp.gs

```javascript
function doGet(e) {
  const token  = e.parameter.token  || '';
  const action = e.parameter.action || '';
  const motif  = e.parameter.motif  || '';

  if (!token) {
    return page(pageErreur('Lien invalide', 'Aucun paramètre de validation fourni.'));
  }

  // Approbation directe depuis email
  if (action === 'APPROUVE') {
    const res = traiterDecision(token, 'APPROUVE', '');
    return page(res.alreadyUsed ? pageDejaUtilise(res) : pageResultat(res));
  }

  // Rejet avec motif
  if (action === 'REJETE') {
    const res = traiterDecision(token, 'REJETE', motif);
    return page(res.alreadyUsed ? pageDejaUtilise(res) : pageResultat(res));
  }

  // Formulaire de décision
  const found = trouverLigneParToken(token);
  if (!found) {
    return page(pageDejaUtilise({
      message: 'La réponse pour cette demande a déjà été envoyée. Ce lien n\'est plus actif.'
    }));
  }

  const demande = lireDemande(getSheetReponses(), found.row);
  return HtmlService.createHtmlOutput(
    cssCommun() + pageFormulaire(demande, token, found.niveau)
  ).setTitle('Validation – Massaka')
   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// CSS commun Massaka
function cssCommun() {
  return `<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; color: #333; }
    .header { background: #016579; color: #fff; padding: 22px 32px; }
    .header h1 { font-size: 20px; font-weight: 800; letter-spacing: .5px; }
    .header .sous-titre { font-size: 13px; opacity: .85; margin-top: 4px; }
    .header .badge-niveau {
      display: inline-block; background: #f8c542; color: #333;
      font-size: 12px; font-weight: 700; padding: 3px 12px;
      border-radius: 20px; margin-top: 8px; }
    .container { max-width: 640px; margin: 28px auto; padding: 0 16px 48px; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.08);
            padding: 22px; margin-bottom: 18px; }
    .card h2 { font-size: 15px; color: #016579; border-bottom: 2px solid #f0f0f0;
               padding-bottom: 8px; margin-bottom: 14px; }
    .info-row { display: flex; padding: 7px 0; border-bottom: 1px solid #f7f7f7; font-size: 14px; }
    .lbl { width: 44%; color: #666; font-weight: 600; }
    .val { width: 56%; color: #222; }
    .btn { display: block; width: 100%; padding: 13px; font-size: 15px; font-weight: 700;
           border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; transition: opacity .2s; }
    .btn:hover { opacity: .88; }
    .btn-ok  { background: #016579; color: #fff; }
    .btn-ko  { background: #dc3545; color: #fff; }
    textarea { width: 100%; height: 110px; padding: 10px; border: 1px solid #ccc;
               border-radius: 5px; font-size: 14px; margin-top: 10px; resize: vertical; }
    .zone-rejet { background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 6px; padding: 16px; }
    .badge-att { background: #fff3cd; color: #856404; font-size: 12px; font-weight: 700;
                  padding: 3px 10px; border-radius: 12px; margin-bottom: 12px; display: inline-block; }
    .result-box { background: #fff; border-radius: 8px; padding: 40px 32px; text-align: center;
                  max-width: 460px; margin: 60px auto; box-shadow: 0 2px 10px rgba(0,0,0,.1); }
    .ico { font-size: 52px; margin-bottom: 14px; }
    .note { margin-top: 16px; font-size: 12px; color: #999; }
  </style>`;
}

// Page formulaire de décision
function pageFormulaire(demande, token, niveau) {
  const cfg = getConfig();
  const labelNiveau = {
    'Superieur':  'Supérieur hiérarchique',
    'RH':         'Responsable RH',
    'Presidence': 'Présidence'
  }[niveau];

  return `
    <div class="header">
      <h1>⬡ massaka</h1>
      <div class="sous-titre">Système de gestion des absences</div>
      <div class="badge-niveau">Niveau : ${labelNiveau}</div>
    </div>
    <div class="container">
      <div class="card">
        <h2>📋 Demande à valider</h2>
        <span class="badge-att">⏳ En attente de votre décision</span>
        <div class="info-row"><span class="lbl">Référence</span><span class="val">${demande.idDemande}</span></div>
        <div class="info-row"><span class="lbl">Employé</span><span class="val">${demande.prenom} ${demande.nom}</span></div>
        <div class="info-row"><span class="lbl">Matricule</span><span class="val">${demande.matricule}</span></div>
        <div class="info-row"><span class="lbl">Service</span><span class="val">${demande.service}</span></div>
        <div class="info-row"><span class="lbl">Type de permission</span><span class="val">${demande.typePerm}</span></div>
        <div class="info-row"><span class="lbl">Motif / Absence</span><span class="val">${demande.typeAbsence || demande.motifLong || '—'}</span></div>
        <div class="info-row"><span class="lbl">Du</span><span class="val">${demande.dateDebut} à ${demande.heureDebut}</span></div>
        <div class="info-row"><span class="lbl">Au</span><span class="val">${demande.dateFin} à ${demande.heureFin}</span></div>
        <div class="info-row"><span class="lbl">Durée</span><span class="val">${demande.nbJours ? demande.nbJours + ' jour(s)' : 'N/A'}</span></div>
      </div>

      <div class="card">
        <h2>✅ Approuver la demande</h2>
        <p style="font-size:13px;color:#555;margin-bottom:4px">La demande sera transmise au niveau suivant de validation.</p>
        <form method="GET" action="${cfg['WEBAPP_URL']}">
          <input type="hidden" name="token"  value="${token}">
          <input type="hidden" name="action" value="APPROUVE">
          <button type="submit" class="btn btn-ok">✅ APPROUVER LA DEMANDE</button>
        </form>
      </div>

      <div class="card">
        <h2>❌ Rejeter la demande</h2>
        <div class="zone-rejet">
          <p style="font-size:13px;color:#721c24;font-weight:600;margin-bottom:4px">
            ⚠️ Le motif est obligatoire — il sera communiqué à l'employé.
          </p>
          <form method="GET" action="${cfg['WEBAPP_URL']}" onsubmit="return checkMotif()">
            <input type="hidden" name="token"  value="${token}">
            <input type="hidden" name="action" value="REJETE">
            <textarea name="motif" id="motifRejet" placeholder="Décrivez le motif de rejet..."></textarea>
            <button type="submit" class="btn btn-ko">❌ REJETER LA DEMANDE</button>
          </form>
        </div>
      </div>
    </div>
    <script>
      function checkMotif() {
        if (!document.getElementById('motifRejet').value.trim()) {
          alert('Veuillez saisir un motif de rejet avant de continuer.');
          return false;
        }
        return true;
      }
    </script>`;
}

// Page : lien déjà utilisé (message explicite)
function pageDejaUtilise(res) {
  return `
    <div class="header"><h1>⬡ massaka</h1><div class="sous-titre">Système de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">📩</div>
      <h2 style="color:#016579;font-size:19px;margin-bottom:10px">Réponse déjà envoyée</h2>
      <p style="font-size:14px;color:#555;line-height:1.6">${res.message}</p>
      <p class="note">Si vous pensez qu'il s'agit d'une erreur, contactez le service RH.</p>
    </div>`;
}

// Page résultat après action
function pageResultat(res) {
  const icon    = res.success ? '✅' : '❌';
  const couleur = res.success ? '#016579' : '#dc3545';
  return `
    <div class="header"><h1>⬡ massaka</h1><div class="sous-titre">Système de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">${icon}</div>
      <h2 style="color:${couleur};font-size:19px;margin-bottom:10px">
        ${res.success ? 'Décision enregistrée' : 'Action impossible'}
      </h2>
      <p style="font-size:14px;color:#555;line-height:1.6">${res.message}</p>
      <p class="note">Vous pouvez fermer cette fenêtre.</p>
    </div>`;
}

// Page erreur générique
function pageErreur(titre, message) {
  return `
    <div class="header"><h1>⬡ massaka</h1><div class="sous-titre">Système de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">⚠️</div>
      <h2 style="color:#dc3545;font-size:19px;margin-bottom:10px">${titre}</h2>
      <p style="font-size:14px;color:#555">${message}</p>
    </div>`;
}

// Encapsule dans une page HTML complète
function page(contenu) {
  return HtmlService.createHtmlOutput(cssCommun() + contenu)
    .setTitle('Massaka – Gestion des absences')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

---

## FICHIER : Setup.gs

```javascript
/**
 * Exécuter UNE SEULE FOIS après avoir renseigné SHEET_REPONSES_ID dans Config.gs.
 */
function initialiserProjet() {
  const ss    = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
  const sheet = ss.getSheetByName(CONFIG.ONGLET_REPONSES);

  // 1. Créer l'onglet CONFIG s'il n'existe pas
  let configSheet = ss.getSheetByName(CONFIG.ONGLET_CONFIG);
  if (!configSheet) {
    configSheet = ss.insertSheet(CONFIG.ONGLET_CONFIG);
    const lignesConfig = [
      ['EMAIL_RH',               'rh@massaka.com'],
      ['NOM_RH',                 'Responsable RH'],
      ['EMAIL_PRESIDENCE_1',     'president@massaka.com'],
      ['NOM_PRESIDENCE_1',       'Président'],
      ['EMAIL_PRESIDENCE_2',     'dg@massaka.com'],
      ['NOM_PRESIDENCE_2',       'Directeur Général'],
      ['SUP_mohamed@agence-mediaprod.com',  'Mohamed - Agence Principale'],
      ['SUP_mohamed@agence1-mediaprod.com', 'Mohamed - Agence 1'],
      ['SUP_mohamed@agence2-mediaprod.com', 'Mohamed - Agence 2'],
      ['SUP_mohamed@agence3-mediaprod.com', 'Mohamed - Agence 3'],
      ['DRIVE_DOSSIER_RACINE',   'REMPLACER_PAR_ID_DOSSIER_RACINE_DRIVE'],
      ['DRIVE_DOSSIER_TEMPLATE', 'REMPLACER_PAR_ID_DOSSIER_TEMPLATE_DRIVE'],
      ['WEBAPP_URL',             'REMPLACER_APRES_DEPLOIEMENT'],
      ['NOM_ORG',                'Massaka']
    ];
    configSheet.getRange(1, 1, lignesConfig.length, 2).setValues(lignesConfig);
    configSheet.getRange(1, 1, lignesConfig.length, 1).setFontBold(true);
    configSheet.setColumnWidth(1, 260);
    configSheet.setColumnWidth(2, 320);
  }

  // 2. Créer l'onglet LOGS s'il n'existe pas
  if (!ss.getSheetByName('LOGS')) {
    const logsSheet = ss.insertSheet('LOGS');
    logsSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Niveau', 'Contexte', 'Message']]);
    logsSheet.getRange(1, 1, 1, 4).setFontBold(true).setBackground('#016579').setFontColor('#ffffff');
  }

  // 3. Créer les en-têtes des colonnes U → AB
  const newHeaders = {
    [CONFIG.COL.ID_DEMANDE]:    'ID_Demande',
    [CONFIG.COL.TOKEN_SUP]:     'Token_Superieur',
    [CONFIG.COL.TOKEN_RH]:      'Token_RH',
    [CONFIG.COL.TOKEN_PRES]:    'Token_Presidence',
    [CONFIG.COL.STATUT_GLOBAL]: 'Statut_Global',
    [CONFIG.COL.DATE_CLOTURE]:  'Date_Cloture',
    [CONFIG.COL.DRIVE_DOSSIER]: 'Drive_DossierID',
    [CONFIG.COL.DRIVE_DOC]:     'Drive_DocID'
  };
  for (const [col, nom] of Object.entries(newHeaders)) {
    const cell = sheet.getRange(1, parseInt(col));
    if (!cell.getValue()) {
      cell.setValue(nom).setFontBold(true).setBackground('#d9d9d9');
    }
  }

  // 4. Installer le trigger onFormSubmit
  const dejaTrigger = ScriptApp.getProjectTriggers()
    .some(t => t.getHandlerFunction() === 'onFormSubmit');
  if (!dejaTrigger) {
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
  }

  SpreadsheetApp.getUi().alert(
    '✅ Initialisation réussie !\n\n' +
    'Étapes suivantes :\n' +
    '1. Renseigner les vrais emails dans l\'onglet CONFIG\n' +
    '2. Créer le dossier racine "Autorisation d\'absence" dans Drive\n' +
    '   → Copier son ID dans CONFIG > DRIVE_DOSSIER_RACINE\n' +
    '3. Créer un dossier template, y déposer le modèle Google Doc\n' +
    '   → Copier l\'ID dans CONFIG > DRIVE_DOSSIER_TEMPLATE\n' +
    '4. Déployer la Web App (Déployer > App Web > Tout le monde)\n' +
    '5. Copier l\'URL dans CONFIG > WEBAPP_URL\n' +
    '6. Tester avec une soumission complète'
  );
}
```

---

## RÉCAPITULATIF DES RÈGLES MÉTIER

| Règle | Détail |
|---|---|
| Délai 72h | Uniquement Permission exceptionnelle, sauf Maladie |
| Rejet auto | Clôture immédiate + email employé + classement Drive "Rejeté" |
| Notification employé | Uniquement : accusé de réception + rejet (tout niveau) + approbation présidence |
| Notification validateur | Supérieur → RH → Présidence (les 2 contacts en parallèle) |
| Présidence | Le premier à répondre valide, le second voit "Réponse déjà envoyée" |
| Token expiré/utilisé | Page "Réponse déjà envoyée" avec message explicatif clair |
| Drive | Dossier demande déplacé à chaque changement de statut |
| Google Doc | Créé à la soumission depuis template, mis à jour après chaque décision |
| Logs | Chaque étape loggée dans Logger + onglet LOGS pour WARN/ERREUR |
| Config | Un seul Sheet, onglet CONFIG, lu dynamiquement via getConfig() |

---

## ORDRE D'INSTALLATION

```
1. Apps Script : renseigner SHEET_REPONSES_ID dans Config.gs
2. Exécuter initialiserProjet() dans Setup.gs
3. Dans l'onglet CONFIG du sheet : renseigner les vrais emails
4. Google Drive :
   a. Créer le dossier "Autorisation d'absence"
      → Copier son ID dans CONFIG > DRIVE_DOSSIER_RACINE
   b. Créer le dossier "Template Absence", y déposer le modèle .gdoc
      → Copier son ID dans CONFIG > DRIVE_DOSSIER_TEMPLATE
   c. Le modèle doit contenir les balises {{...}} listées dans DriveManager.gs
5. Déployer la Web App :
   Déployer > Nouveau déploiement > Application Web
   - Exécuter en tant que : Moi
   - Accès : Tout le monde (sans connexion requise)
6. Copier l'URL dans CONFIG > WEBAPP_URL (onglet CONFIG du sheet)
7. Tester avec une soumission formulaire complète
   → Vérifier les logs dans l'onglet LOGS
   → Vérifier la création du dossier Drive et du Google Doc
```
