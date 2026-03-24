// ============================================================
// Relances.gs — Relances automatiques + outils de maintenance
// ============================================================
// Fonctions :
//   verifierEtRelancer()        — trigger quotidien 08h00
//   renvoyerValidationManuelle() — menu : renvoyer un email perdu
//   reprendreTraitement()        — menu : relancer onFormSubmit
//   nettoyerTriggers()           — menu : supprimer doublons de triggers
// ============================================================


// ============================================================
// 1. Verifier et relancer — appele automatiquement chaque jour
// ============================================================
function verifierEtRelancer() {
  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const today    = new Date();
  const delaiMs  = (CONFIG.DELAI_RELANCE_JOURS || 7) * 24 * 3600 * 1000;
  let   nbRelances = 0;

  // Lecture groupee de toutes les colonnes jusqu'a RELANCE (col 29)
  const data = sheet.getRange(2, 1, lastRow - 1, CONFIG.COL.RELANCE).getValues();

  data.forEach((r, i) => {
    const row = i + 2;

    // Ignorer les demandes non "En cours"
    const statut = (r[CONFIG.COL.STATUT_GLOBAL - 1] || '').toString();
    if (statut !== 'En cours') return;

    // Trouver le niveau en attente
    const avisSup  = (r[CONFIG.COL.AVIS_SUP  - 1] || '').toString();
    const avisRH   = (r[CONFIG.COL.AVIS_RH   - 1] || '').toString();
    const avisPres = (r[CONFIG.COL.AVIS_PRES - 1] || '').toString();

    let niveau = null, token = null;
    if (avisSup  === 'En attente') { niveau = 'Superieur';  token = (r[CONFIG.COL.TOKEN_SUP  - 1] || '').toString(); }
    else if (avisRH   === 'En attente') { niveau = 'RH';         token = (r[CONFIG.COL.TOKEN_RH   - 1] || '').toString(); }
    else if (avisPres === 'En attente') { niveau = 'Presidence'; token = (r[CONFIG.COL.TOKEN_PRES - 1] || '').toString(); }

    if (!niveau || !token) return;

    // Ignorer si le token est deja consomme
    if (token.startsWith('UTILISE_') || token.startsWith('INVALIDE_')) return;

    // Verifier le delai depuis derniere relance (ou depuis la soumission)
    const dernRelanceRaw = r[CONFIG.COL.RELANCE      - 1];
    const horodateurRaw  = r[CONFIG.COL.HORODATEUR   - 1];
    const dateRef = dernRelanceRaw ? new Date(dernRelanceRaw) : new Date(horodateurRaw);
    if (isNaN(dateRef) || (today - dateRef) < delaiMs) return;

    // Envoyer la relance
    try {
      const demande = lireDemande(sheet, row);
      envoyerNotificationValidateur(demande, niveau, token);
      ecrireColonne(sheet, row, CONFIG.COL.RELANCE, today);
      nbRelances++;
      log('OK', 'Relances', `Relance envoyee - ${demande.idDemande} niveau ${niveau}`);
    } catch (err) {
      log('ERREUR', 'Relances', `Echec relance ligne ${row} : ${err.toString()}`);
    }
  });

  log('OK', 'Relances', `Verification terminee : ${nbRelances} relance(s) envoyee(s)`);
}


// ============================================================
// 2. Renvoyer manuellement l'email de validation
//    (si le validateur a perdu son lien)
// ============================================================
function renvoyerValidationManuelle() {
  const ui  = SpreadsheetApp.getUi();
  const rep = ui.prompt(
    'Renvoyer la validation',
    'Entrez la reference de la demande (ex: MSK-2026-0001) :',
    ui.ButtonSet.OK_CANCEL
  );
  if (rep.getSelectedButton() !== ui.Button.OK) return;

  const ref = rep.getResponseText().trim().toUpperCase();
  if (!ref) return;

  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { ui.alert('Aucune donnee dans le sheet.'); return; }

  // Chercher la ligne correspondant a la reference
  const ids = sheet.getRange(2, CONFIG.COL.ID_DEMANDE, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < ids.length; i++) {
    if ((ids[i][0] || '').toString().toUpperCase() === ref) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow < 0) {
    ui.alert('Reference introuvable : ' + ref + '\nVerifiez le format (ex: MSK-2026-0001).');
    return;
  }

  const statut = sheet.getRange(targetRow, CONFIG.COL.STATUT_GLOBAL).getValue().toString();
  if (statut !== 'En cours') {
    ui.alert('La demande ' + ref + ' n\'est pas "En cours" (statut actuel : ' + statut + ').\nAucun renvoi possible.');
    return;
  }

  // Identifier le niveau en attente
  const niveau = _getNiveauEnAttente(sheet, targetRow);
  if (!niveau) {
    ui.alert('Aucun niveau "En attente" trouve pour cette demande.');
    return;
  }

  const colToken = {
    'Superieur':  CONFIG.COL.TOKEN_SUP,
    'RH':         CONFIG.COL.TOKEN_RH,
    'Presidence': CONFIG.COL.TOKEN_PRES
  }[niveau];

  const token = sheet.getRange(targetRow, colToken).getValue().toString();
  if (token.startsWith('UTILISE_') || token.startsWith('INVALIDE_')) {
    ui.alert('Le token pour ce niveau est invalide. Contactez le service IT.');
    return;
  }

  const demande = lireDemande(sheet, targetRow);
  envoyerNotificationValidateur(demande, niveau, token);
  ecrireColonne(sheet, targetRow, CONFIG.COL.RELANCE, new Date());

  log('OK', 'Relances', `Renvoi manuel - ${ref} - niveau ${niveau}`);
  ui.alert('Email renvoye au validateur (' + niveau + ') pour la demande ' + ref + '.');
}


// ============================================================
// 3. Reprendre un traitement echoue
//    Simule onFormSubmit sur une ligne existante
// ============================================================
function reprendreTraitement() {
  const ui  = SpreadsheetApp.getUi();
  const rep = ui.prompt(
    'Reprendre un traitement echoue',
    'Entrez le numero de ligne (ex: 5) ou la reference (ex: MSK-2026-0001) :',
    ui.ButtonSet.OK_CANCEL
  );
  if (rep.getSelectedButton() !== ui.Button.OK) return;

  const saisie  = rep.getResponseText().trim();
  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  let   targetRow = -1;

  if (/^\d+$/.test(saisie)) {
    targetRow = parseInt(saisie, 10);
  } else {
    const ids = sheet.getRange(2, CONFIG.COL.ID_DEMANDE, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if ((ids[i][0] || '').toString().toUpperCase() === saisie.toUpperCase()) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow < 2 || targetRow > lastRow) {
    ui.alert('Ligne / reference introuvable.');
    return;
  }

  // Avertir si la ligne a deja un statut
  const statutExistant = sheet.getRange(targetRow, CONFIG.COL.STATUT_GLOBAL).getValue().toString();
  const idExistant     = sheet.getRange(targetRow, CONFIG.COL.ID_DEMANDE).getValue().toString();

  if (statutExistant && statutExistant !== '') {
    const confirm = ui.alert(
      'Attention',
      'La ligne ' + targetRow + ' a deja le statut "' + statutExistant + '"' +
      (idExistant ? ' (ref : ' + idExistant + ')' : '') + '.\n\n' +
      'Relancer va regenerer l\'ID et les tokens (les anciens liens email deviendront invalides).\n\n' +
      'Continuer ?',
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;
  }

  try {
    // Construire un faux evenement pour simuler onFormSubmit
    const fakeEvent = { range: sheet.getRange(targetRow, 1) };
    onFormSubmit(fakeEvent);
    log('OK', 'Relances', `Traitement repris manuellement pour la ligne ${targetRow}`);
    ui.alert('Traitement relance pour la ligne ' + targetRow + '. Verifiez les logs Apps Script pour confirmer.');
  } catch (err) {
    log('ERREUR', 'Relances', `Echec reprise ligne ${targetRow} : ${err.toString()}`);
    ui.alert('Erreur lors de la reprise : ' + err.toString());
  }
}


// ============================================================
// 4. Nettoyer les triggers en double
// ============================================================
function nettoyerTriggers() {
  const ui       = SpreadsheetApp.getUi();
  const triggers = ScriptApp.getProjectTriggers();
  const seen     = {};
  let   nbSupprimes = 0;

  triggers.forEach(t => {
    const fn = t.getHandlerFunction();
    if (seen[fn]) {
      ScriptApp.deleteTrigger(t);
      nbSupprimes++;
      log('OK', 'Maintenance', `Trigger en double supprime : ${fn}`);
    } else {
      seen[fn] = true;
    }
  });

  if (nbSupprimes === 0) {
    ui.alert('Aucun doublon trouve. Tous les triggers sont uniques.');
  } else {
    ui.alert(nbSupprimes + ' trigger(s) en double supprime(s).\nVerifiez Apps Script > Declencheurs pour confirmer.');
  }
}


// ============================================================
// Utilitaire interne — retourne le niveau en attente pour une ligne
// ============================================================
function _getNiveauEnAttente(sheet, row) {
  const avisSup  = sheet.getRange(row, CONFIG.COL.AVIS_SUP ).getValue().toString();
  const avisRH   = sheet.getRange(row, CONFIG.COL.AVIS_RH  ).getValue().toString();
  const avisPres = sheet.getRange(row, CONFIG.COL.AVIS_PRES).getValue().toString();

  if (avisSup  === 'En attente') return 'Superieur';
  if (avisRH   === 'En attente') return 'RH';
  if (avisPres === 'En attente') return 'Presidence';
  return null;
}
