// ============================================================
// CreerTemplate.gs — Génère le template Google Doc
// Exécuter UNE SEULE FOIS depuis l'éditeur Apps Script.
// Le Doc est créé dans le dossier DRIVE_DOSSIER_TEMPLATE.
// Copier l'ID affiché dans les logs dans CONFIG.DRIVE_DOSSIER_TEMPLATE.
// ============================================================

function creerTemplateDoc() {

  // ----------------------------------------------------------
  // 1. Créer le document dans le dossier template
  // ----------------------------------------------------------
  const dossierTemplate = DriveApp.getFolderById(CONFIG.DRIVE_DOSSIER_TEMPLATE);
  const doc  = DocumentApp.create('TEMPLATE_Autorisation_Absence');
  const file = DriveApp.getFileById(doc.getId());

  // Déplacer dans le dossier template
  dossierTemplate.addFile(file);
  DriveApp.getRootFolder().removeFile(file);

  const body = doc.getBody();
  body.clear();

  // Marges (en points : 72pt = 1 pouce)
  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(54);
  body.setMarginRight(54);

  // ----------------------------------------------------------
  // Styles de base
  // ----------------------------------------------------------
  const NOIR     = '#000000';
  const TEAL     = '#005555';
  const GRIS_BG  = '#F2F2F2';
  const GRIS_SEP = '#CCCCCC';
  const BLANC    = '#FFFFFF';

  function pStyle(align) {
    const s = {};
    s[DocumentApp.Attribute.FONT_FAMILY]          = 'Montserrat';
    s[DocumentApp.Attribute.FONT_SIZE]             = 10;
    s[DocumentApp.Attribute.FOREGROUND_COLOR]      = NOIR;
    s[DocumentApp.Attribute.BOLD]                  = false;
    s[DocumentApp.Attribute.ITALIC]                = false;
    s[DocumentApp.Attribute.HORIZONTAL_ALIGNMENT]  =
      align || DocumentApp.HorizontalAlignment.LEFT;
    return s;
  }

  // ----------------------------------------------------------
  // 2. EN-TÊTE — logo texte + titre
  // ----------------------------------------------------------

  // Ligne logo
  const pLogo = body.appendParagraph('');
  pLogo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  const tLogo = pLogo.appendText('▲ massaka');
  tLogo.setFontFamily('Montserrat');
  tLogo.setFontSize(18);
  tLogo.setBold(true);
  tLogo.setForegroundColor(NOIR);

  // Référence à droite (date soumission)
  const pRef = body.appendParagraph('');
  pRef.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  const tRef = pRef.appendText('Réf. : {{ID_DEMANDE}}   |   Le {{DATE_SOUMISSION}}');
  tRef.setFontFamily('Montserrat');
  tRef.setFontSize(8);
  tRef.setForegroundColor('#666666');
  tRef.setItalic(true);

  // Ligne de séparation noire épaisse
  const pSep0 = body.appendParagraph('');
  pSep0.setSpacingBefore(2);
  pSep0.setSpacingAfter(0);
  pSep0.setLineSpacing(0.1);
  pSep0.editAsText().setBackgroundColor(NOIR);

  // Titre principal
  const pTitre = body.appendParagraph('');
  pTitre.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  pTitre.setSpacingBefore(10);
  pTitre.setSpacingAfter(10);
  const tTitre = pTitre.appendText('DEMANDE D\'AUTORISATION D\'ABSENCE');
  tTitre.setFontFamily('Montserrat');
  tTitre.setFontSize(14);
  tTitre.setBold(true);
  tTitre.setForegroundColor(NOIR);

  // Ligne de séparation noire
  const pSep1 = body.appendParagraph('');
  pSep1.setSpacingBefore(0);
  pSep1.setSpacingAfter(8);
  pSep1.setLineSpacing(0.1);
  pSep1.editAsText().setBackgroundColor(NOIR);

  // ----------------------------------------------------------
  // 3. TABLEAU IDENTITÉ (2 colonnes)
  // ----------------------------------------------------------
  const tIdentite = body.appendTable([
    ['Nom de l\'employé',  '{{NOM}}'],
    ['Prénoms',            '{{PRENOM}}'],
    ['Service / Fonction', '{{SERVICE}}'],
  ]);

  tIdentite.setBorderColor(GRIS_SEP);

  for (let r = 0; r < tIdentite.getNumRows(); r++) {
    const row = tIdentite.getRow(r);
    row.setMinimumHeight(22);

    const cellLabel = row.getCell(0);
    cellLabel.setBackgroundColor(GRIS_BG);
    cellLabel.setPaddingTop(5);
    cellLabel.setPaddingBottom(5);
    cellLabel.setPaddingLeft(8);
    cellLabel.setPaddingRight(8);
    const tLabel = cellLabel.editAsText();
    tLabel.setFontFamily('Montserrat');
    tLabel.setFontSize(9);
    tLabel.setBold(true);
    tLabel.setForegroundColor(TEAL);

    const cellVal = row.getCell(1);
    cellVal.setPaddingTop(5);
    cellVal.setPaddingBottom(5);
    cellVal.setPaddingLeft(8);
    cellVal.setPaddingRight(8);
    const tVal = cellVal.editAsText();
    tVal.setFontFamily('Montserrat');
    tVal.setFontSize(10);
    tVal.setBold(true);
    tVal.setForegroundColor(NOIR);
  }

  // Largeurs colonnes (en points)
  tIdentite.getRow(0).getCell(0).setWidth(140);

  // ----------------------------------------------------------
  // 4. SECTION — Permission exceptionnelle
  // ----------------------------------------------------------
  _titreSection(body, '❖  Permission exceptionnelle', TEAL, GRIS_BG);

  const pDescExc = body.appendParagraph(
    'Sans retenue sur salaire ou du congé annuel, à concurrence de 10 jours par an, non cumulable.'
  );
  _styleNote(pDescExc);

  const tExc = body.appendTable([
    ['Motif',          '{{MOTIF_EXCEPTIONNEL}}'],
    ['Date de début',  '{{DATE_DEBUT}}  à  {{HEURE_DEBUT}}'],
    ['Date de fin',    '{{DATE_FIN}}  à  {{HEURE_FIN}}'],
  ]);
  _styleTableauInfo(tExc, GRIS_BG, GRIS_SEP, TEAL, NOIR);

  // ----------------------------------------------------------
  // 5. SECTION — Permission ordinaire
  // ----------------------------------------------------------
  _titreSection(body, '❖  Permission ordinaire', TEAL, GRIS_BG);

  const pDescOrd = body.appendParagraph(
    'Avec retenue sur salaire ou sur le congé annuel.'
  );
  _styleNote(pDescOrd);

  const tOrd = body.appendTable([
    ['Motif de l\'absence',       '{{MOTIF_ORDINAIRE}}'],
    ['Nombre de jours sollicités','{{NB_JOURS_ORDINAIRE}} jours'],
    ['Du',                        '{{DATE_DEBUT_ORDINAIRE}}'],
    ['Au',                        '{{DATE_FIN_ORDINAIRE}}'],
  ]);
  _styleTableauInfo(tOrd, GRIS_BG, GRIS_SEP, TEAL, NOIR);

  // ----------------------------------------------------------
  // 6. SECTION — Validations
  // ----------------------------------------------------------
  _titreSection(body, '✦  Validations', BLANC, TEAL);

  const tValid = body.appendTable([
    ['Avis du supérieur hiérarchique',         '{{AVIS_SUPERIEUR}}'],
    ['Décision de la Présidence',              '{{AVIS_PRESIDENCE}}'],
  ]);

  tValid.setBorderColor(GRIS_SEP);
  for (let r = 0; r < tValid.getNumRows(); r++) {
    const row  = tValid.getRow(r);
    row.setMinimumHeight(28);
    const cL = row.getCell(0);
    cL.setBackgroundColor(TEAL);
    cL.setPaddingTop(6); cL.setPaddingBottom(6);
    cL.setPaddingLeft(8); cL.setPaddingRight(8);
    const tL = cL.editAsText();
    tL.setFontFamily('Montserrat'); tL.setFontSize(9);
    tL.setBold(true); tL.setForegroundColor(BLANC);

    const cV = row.getCell(1);
    cV.setPaddingTop(6); cV.setPaddingBottom(6);
    cV.setPaddingLeft(8); cV.setPaddingRight(8);
    const tV = cV.editAsText();
    tV.setFontFamily('Montserrat'); tV.setFontSize(11);
    tV.setBold(true); tV.setForegroundColor(NOIR);
  }
  tValid.getRow(0).getCell(0).setWidth(200);

  // Commentaire / motif de rejet
  const pComm = body.appendParagraph('');
  pComm.setSpacingBefore(6);
  const tComm = pComm.appendText('Observations : {{COMMENTAIRE}}');
  tComm.setFontFamily('Montserrat');
  tComm.setFontSize(9);
  tComm.setItalic(true);
  tComm.setForegroundColor('#666666');

  // ----------------------------------------------------------
  // 7. SIGNATURE employé
  // ----------------------------------------------------------
  const pSign = body.appendParagraph('');
  pSign.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  pSign.setSpacingBefore(18);
  const tSign = pSign.appendText('Signature de l\'employé(e) :\n\n{{PRENOM}} {{NOM}}');
  tSign.setFontFamily('Montserrat');
  tSign.setFontSize(9);
  tSign.setForegroundColor(NOIR);

  // ----------------------------------------------------------
  // 8. NOTE DE BAS
  // ----------------------------------------------------------
  const pSepFin = body.appendParagraph('');
  pSepFin.setSpacingBefore(14);
  pSepFin.setSpacingAfter(0);
  pSepFin.setLineSpacing(0.1);
  pSepFin.editAsText().setBackgroundColor(TEAL);

  const pNB = body.appendParagraph(
    'NB :  • Pour les permissions exceptionnelles et celles prévues au contrat, cocher la partie concernée.\n' +
    '        • Les absences pour maladie sont justifiées sur présentation d\'un certificat médical au plus tard 6 jours après la reprise de travail.\n' +
    '        • Vous devez soumettre vos demandes d\'absence 72 heures avant leur date effective.\n' +
    '          Les autorisations d\'absence ne peuvent excéder 72 heures.'
  );
  pNB.setSpacingBefore(8);
  const tNB = pNB.editAsText();
  tNB.setFontFamily('Montserrat');
  tNB.setFontSize(8);
  tNB.setItalic(true);
  tNB.setForegroundColor('#444444');

  // ----------------------------------------------------------
  // 9. Finaliser
  // ----------------------------------------------------------
  doc.saveAndClose();

  const docId = doc.getId();
  Logger.log('✅ Template créé avec succès !');
  Logger.log('📄 ID du document : ' + docId);
  Logger.log('🔗 Lien : https://docs.google.com/document/d/' + docId + '/edit');
  Logger.log('');
  Logger.log('👉 Copiez cet ID dans DRIVE_DOSSIER_TEMPLATE de Config.gs');

  SpreadsheetApp.getUi().alert(
    '✅ Template créé !\n\n' +
    'ID du document :\n' + docId + '\n\n' +
    'Lien :\nhttps://docs.google.com/document/d/' + docId + '/edit\n\n' +
    '👉 Placez ce Doc seul dans votre dossier template Drive.\n' +
    '   Son ID dossier doit être dans CONFIG.DRIVE_DOSSIER_TEMPLATE.'
  );
}


// ============================================================
// Helpers internes
// ============================================================

function _titreSection(body, texte, couleurTexte, couleurFond) {
  const p = body.appendParagraph('');
  p.setSpacingBefore(12);
  p.setSpacingAfter(4);
  p.setBackgroundColor ? p.setBackgroundColor(couleurFond) : null;
  const t = p.appendText('  ' + texte + '  ');
  t.setFontFamily('Montserrat');
  t.setFontSize(9);
  t.setBold(true);
  t.setForegroundColor(couleurTexte);
  t.setBackgroundColor(couleurFond);
  return p;
}

function _styleNote(p) {
  p.setSpacingBefore(2);
  p.setSpacingAfter(4);
  const t = p.editAsText();
  t.setFontFamily('Montserrat');
  t.setFontSize(8);
  t.setItalic(true);
  t.setForegroundColor('#666666');
}

function _styleTableauInfo(table, bgLabel, borderColor, colorLabel, colorVal) {
  table.setBorderColor(borderColor);
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    row.setMinimumHeight(22);

    const cL = row.getCell(0);
    cL.setBackgroundColor(bgLabel);
    cL.setPaddingTop(5); cL.setPaddingBottom(5);
    cL.setPaddingLeft(8); cL.setPaddingRight(8);
    const tL = cL.editAsText();
    tL.setFontFamily('Montserrat'); tL.setFontSize(9);
    tL.setBold(true); tL.setForegroundColor(colorLabel);

    const cV = row.getCell(1);
    cV.setPaddingTop(5); cV.setPaddingBottom(5);
    cV.setPaddingLeft(8); cV.setPaddingRight(8);
    const tV = cV.editAsText();
    tV.setFontFamily('Montserrat'); tV.setFontSize(10);
    tV.setBold(false); tV.setForegroundColor(colorVal);
  }
  table.getRow(0).getCell(0).setWidth(160);
}
