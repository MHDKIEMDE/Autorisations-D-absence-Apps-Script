// ============================================================
// CreerTemplate.gs — Génère le template Google Doc
// Exécuter UNE SEULE FOIS depuis l'éditeur Apps Script.
// Le Doc est créé dans le dossier DRIVE_DOSSIER_TEMPLATE.
// ============================================================

function creerTemplateDoc() {

  // ----------------------------------------------------------
  // 1. Créer le document dans le dossier template
  // ----------------------------------------------------------
  const dossierTemplate = DriveApp.getFolderById(CONFIG.DRIVE_DOSSIER_TEMPLATE);
  const doc  = DocumentApp.create('TEMPLATE_Autorisation_Absence');
  const file = DriveApp.getFileById(doc.getId());
  dossierTemplate.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  const body = doc.getBody();
  body.clear();
  body.setMarginTop(40);
  body.setMarginBottom(40);
  body.setMarginLeft(56);
  body.setMarginRight(56);

  // ----------------------------------------------------------
  // Palette
  // ----------------------------------------------------------
  const NOIR    = '#000000';
  const TEAL    = '#005555';
  const TEAL_LT = '#E6F2F2';   // teal très clair pour labels
  const BLANC   = '#FFFFFF';
  const GRIS    = '#F5F5F5';   // fond labels neutres
  const BORDER  = '#CCCCCC';
  const TEXTE   = '#222222';
  const GRIS_T  = '#666666';

  // ----------------------------------------------------------
  // 2. EN-TÊTE
  // ----------------------------------------------------------

  // Logo
  const pLogo = body.appendParagraph('');
  pLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  pLogo.setSpacingAfter(2);
  const tLogo = pLogo.appendText('▲ massaka');
  tLogo.setFontFamily('Montserrat'); tLogo.setFontSize(20);
  tLogo.setBold(true); tLogo.setForegroundColor(NOIR);

  // Sous-titre organisation
  const pOrg = body.appendParagraph('');
  pOrg.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  pOrg.setSpacingAfter(8);
  const tOrg = pOrg.appendText('Massaka SAS');
  tOrg.setFontFamily('Montserrat'); tOrg.setFontSize(9);
  tOrg.setBold(false); tOrg.setForegroundColor(GRIS_T);
  tOrg.setItalic(true);

  // Barre noire titre
  const tblTitre = body.appendTable([['DEMANDE D\'AUTORISATION D\'ABSENCE']]);
  tblTitre.setBorderWidth(0);
  tblTitre.setBorderColor(NOIR);
  const cellTitre = tblTitre.getRow(0).getCell(0);
  cellTitre.setBackgroundColor(NOIR);
  cellTitre.setPaddingTop(10); cellTitre.setPaddingBottom(10);
  cellTitre.setPaddingLeft(16); cellTitre.setPaddingRight(16);
  const tTitre = cellTitre.editAsText();
  tTitre.setFontFamily('Montserrat'); tTitre.setFontSize(13);
  tTitre.setBold(true); tTitre.setForegroundColor(BLANC);
  tTitre.setItalic(false);
  const pTitre = cellTitre.getChild(0).asParagraph();
  pTitre.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // Référence + date (à droite sous le titre)
  const pRef = body.appendParagraph('');
  pRef.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  pRef.setSpacingBefore(4); pRef.setSpacingAfter(12);
  const tRef = pRef.appendText('Réf. : {{ID_DEMANDE}}   |   Soumis le {{DATE_SOUMISSION}}');
  tRef.setFontFamily('Montserrat'); tRef.setFontSize(8);
  tRef.setForegroundColor(GRIS_T); tRef.setItalic(true);

  // ----------------------------------------------------------
  // 3. TABLEAU IDENTITÉ
  // ----------------------------------------------------------
  const tIdentite = body.appendTable([
    ['Nom de l\'employé',  '{{NOM}}'],
    ['Prénoms',            '{{PRENOM}}'],
    ['Service / Fonction', '{{SERVICE}}'],
  ]);
  _styleTableau(tIdentite, TEAL_LT, BLANC, BORDER, TEAL, TEXTE, 150);

  // ----------------------------------------------------------
  // 4. SECTION Permission exceptionnelle
  // ----------------------------------------------------------
  _espaceur(body, 14);
  _bandeauSection(body, '❖  Permission exceptionnelle', BLANC, TEAL);

  const pDescExc = body.appendParagraph(
    'Sans retenue sur salaire ou du congé annuel, à concurrence de 10 jours par an, non cumulable.'
  );
  _noteStyle(pDescExc, GRIS_T);

  const tExc = body.appendTable([
    ['Motif',         '{{MOTIF_EXCEPTIONNEL}}'],
    ['Date de début', '{{DATE_DEBUT}}  à  {{HEURE_DEBUT}}'],
    ['Date de fin',   '{{DATE_FIN}}  à  {{HEURE_FIN}}'],
  ]);
  _styleTableau(tExc, GRIS, BLANC, BORDER, TEAL, TEXTE, 150);

  // ----------------------------------------------------------
  // 5. SECTION Permission ordinaire
  // ----------------------------------------------------------
  _espaceur(body, 14);
  _bandeauSection(body, '❖  Permission ordinaire', BLANC, TEAL);

  const pDescOrd = body.appendParagraph('Avec retenue sur salaire ou sur le congé annuel.');
  _noteStyle(pDescOrd, GRIS_T);

  const tOrd = body.appendTable([
    ['Motif de l\'absence',        '{{MOTIF_ORDINAIRE}}'],
    ['Nombre de jours sollicités', '{{NB_JOURS_ORDINAIRE}} jours'],
    ['Du',                         '{{DATE_DEBUT_ORDINAIRE}}'],
    ['Au',                         '{{DATE_FIN_ORDINAIRE}}'],
  ]);
  _styleTableau(tOrd, GRIS, BLANC, BORDER, TEAL, TEXTE, 150);

  // ----------------------------------------------------------
  // 6. SECTION Validations
  // ----------------------------------------------------------
  _espaceur(body, 14);
  _bandeauSection(body, '✦  Validations', BLANC, NOIR);

  const tValid = body.appendTable([
    ['Avis du supérieur hiérarchique', '{{AVIS_SUPERIEUR}}'],
    ['Décision de la Présidence',      '{{AVIS_PRESIDENCE}}'],
  ]);
  _styleTableau(tValid, TEAL, BLANC, TEAL, BLANC, TEXTE, 200);
  // Forcer le texte des valeurs en gras + taille plus grande
  for (let r = 0; r < tValid.getNumRows(); r++) {
    const cv = tValid.getRow(r).getCell(1);
    cv.setBackgroundColor(BLANC);
    const tv = cv.editAsText();
    tv.setFontSize(11); tv.setBold(true); tv.setForegroundColor(TEAL);
  }

  // Ligne commentaire
  _espaceur(body, 6);
  const pComm = body.appendParagraph('');
  const tComm = pComm.appendText('Observations / motif de rejet :  {{COMMENTAIRE}}');
  tComm.setFontFamily('Montserrat'); tComm.setFontSize(9);
  tComm.setItalic(true); tComm.setForegroundColor(GRIS_T);

  // ----------------------------------------------------------
  // 7. SIGNATURE
  // ----------------------------------------------------------
  _espaceur(body, 20);
  const pSign = body.appendParagraph('');
  pSign.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  const tSign = pSign.appendText('Fait et signé par l\'employé(e) :\n\n{{PRENOM}} {{NOM}}');
  tSign.setFontFamily('Montserrat'); tSign.setFontSize(9);
  tSign.setForegroundColor(TEXTE); tSign.setBold(false);

  // ----------------------------------------------------------
  // 8. PIED DE PAGE (note)
  // ----------------------------------------------------------
  _espaceur(body, 16);

  // Ligne teal fine
  const tblSepFin = body.appendTable([['']]);
  tblSepFin.setBorderWidth(0);
  const cSepFin = tblSepFin.getRow(0).getCell(0);
  cSepFin.setBackgroundColor(TEAL);
  cSepFin.setPaddingTop(1); cSepFin.setPaddingBottom(1);

  const pNB = body.appendParagraph(
    'NB :  • Pour les permissions exceptionnelles et celles prévues au contrat, cocher la partie concernée.\n' +
    '         • Les absences pour maladie sont justifiées sur présentation d\'un certificat médical au plus tard 6 jours après la reprise de travail.\n' +
    '         • Vous devez soumettre vos demandes d\'absence 72 heures avant leur date effective. Les autorisations d\'absence ne peuvent excéder 72 heures.'
  );
  pNB.setSpacingBefore(6);
  const tNB = pNB.editAsText();
  tNB.setFontFamily('Montserrat'); tNB.setFontSize(8);
  tNB.setItalic(true); tNB.setForegroundColor('#555555');

  // ----------------------------------------------------------
  // 9. Finaliser
  // ----------------------------------------------------------
  doc.saveAndClose();

  const docId = doc.getId();
  Logger.log('ID du document : ' + docId);
  Logger.log('Lien : https://docs.google.com/document/d/' + docId + '/edit');

  SpreadsheetApp.getUi().alert(
    'Template cree !\n\n' +
    'ID : ' + docId + '\n\n' +
    'Lien :\nhttps://docs.google.com/document/d/' + docId + '/edit\n\n' +
    'Placez ce Doc seul dans votre dossier template Drive.\n' +
    'Son ID dossier doit etre dans CONFIG.DRIVE_DOSSIER_TEMPLATE.'
  );
}


// ============================================================
// Helpers
// ============================================================

function _bandeauSection(body, texte, couleurTexte, couleurFond) {
  const tbl = body.appendTable([[texte]]);
  tbl.setBorderWidth(0);
  const cell = tbl.getRow(0).getCell(0);
  cell.setBackgroundColor(couleurFond);
  cell.setPaddingTop(6); cell.setPaddingBottom(6);
  cell.setPaddingLeft(10); cell.setPaddingRight(10);
  const t = cell.editAsText();
  t.setFontFamily('Montserrat'); t.setFontSize(9);
  t.setBold(true); t.setForegroundColor(couleurTexte);
  t.setItalic(false);
}

function _styleTableau(table, bgLabel, bgVal, borderColor, colorLabel, colorVal, largeurLabel) {
  table.setBorderColor(borderColor);
  table.setBorderWidth(1);
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    row.setMinimumHeight(24);

    const cL = row.getCell(0);
    cL.setBackgroundColor(bgLabel);
    cL.setPaddingTop(6); cL.setPaddingBottom(6);
    cL.setPaddingLeft(10); cL.setPaddingRight(10);
    const tL = cL.editAsText();
    tL.setFontFamily('Montserrat'); tL.setFontSize(9);
    tL.setBold(true); tL.setForegroundColor(colorLabel);
    tL.setItalic(false);

    const cV = row.getCell(1);
    cV.setBackgroundColor(bgVal);
    cV.setPaddingTop(6); cV.setPaddingBottom(6);
    cV.setPaddingLeft(10); cV.setPaddingRight(10);
    const tV = cV.editAsText();
    tV.setFontFamily('Montserrat'); tV.setFontSize(10);
    tV.setBold(false); tV.setForegroundColor(colorVal);
    tV.setItalic(false);
  }
  if (largeurLabel) {
    table.getRow(0).getCell(0).setWidth(largeurLabel);
  }
}

function _noteStyle(p, couleur) {
  p.setSpacingBefore(3); p.setSpacingAfter(5);
  const t = p.editAsText();
  t.setFontFamily('Montserrat'); t.setFontSize(8);
  t.setItalic(true); t.setForegroundColor(couleur);
}

function _espaceur(body, pts) {
  const p = body.appendParagraph('');
  p.setSpacingBefore(0); p.setSpacingAfter(0);
  p.setLineSpacing(1);
  p.editAsText().setFontSize(pts / 2);
}
