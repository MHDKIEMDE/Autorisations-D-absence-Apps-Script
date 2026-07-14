// ============================================================
// Workflow.gs - Logique cascade de validation
// Système d'autorisation d'absence - Massaka SAS
// ============================================================
//
// Circuits :
//   SUP_PRES : Supérieur → Présidence (président unique)
//   PRES     : Présidence directement (président unique)
//
// Un seul président par périmètre (PRES_GENERAL / PRES_ADMIN_FIN) :
// il valide ou rejette seul ; sa décision clôture la demande.
// ============================================================


/**
 * Traite la décision d'un validateur (approbation ou rejet).
 */
function traiterDecision(token, decision, motif) {
  log('INFO', 'Workflow', `Traitement décision - token: ${token.substring(0, 8)}...`);

  const resultat = trouverLigneParTokenOptimise(token);
  if (!resultat) {
    log('WARN', 'WebApp', `Token invalide ou expiré : ${token.substring(0, 8)}...`);
    return {
      success: false,
      message: "Ce lien de validation n'est plus actif."
    };
  }

  const { row, niveau, utilise } = resultat;
  const sheet   = getSheetReponses();
  const demande = lireDemande(sheet, row);

  const service  = sheet.getRange(row, CONFIG.COL.DEPARTEMENT).getValue().toString().trim();
  const workflow = ((CONFIG.SERVICE_SUP_MAP || {})[service] || {}).workflow || 'PRES';

  // ----------------------------------------------------------
  // Vérifier que ce niveau est bien "En attente"
  // ----------------------------------------------------------
  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[niveau];

  const statutActuel = sheet.getRange(row, colStatut).getValue();

  if (statutActuel !== 'En attente') {
    const labelNiveau = niveau === 'Superieur'
      ? 'Supérieur hiérarchique'
      : (getPresidencePourSup(demande).titre || 'Présidence');
    log('WARN', 'WebApp',
      `Tentative d'accès sur lien déjà utilisé - demande ${demande.idDemande}`);
    return {
      success:    false,
      alreadyUsed: true,
      message:    `La réponse pour cette demande (${demande.idDemande}) a déjà été ` +
                  `envoyée au niveau "${labelNiveau}". ` +
                  `Aucune action supplémentaire n'est nécessaire de votre part.`
    };
  }

  // ----------------------------------------------------------
  // Valider le motif si rejet
  // ----------------------------------------------------------
  if (decision === 'REJETE' && (!motif || motif.trim() === '')) {
    return { success: false, message: 'Le motif de rejet est obligatoire.' };
  }

  // ----------------------------------------------------------
  // CAS : APPROBATION
  // ----------------------------------------------------------
  if (decision === 'APPROUVE') {
    ecrireColonne(sheet, row, colStatut, 'Approuvé');
    ecrireColonne(sheet, row, colStatut === CONFIG.COL.AVIS_SUP ? CONFIG.COL.TOKEN_SUP : CONFIG.COL.TOKEN_PRES, 'UTILISE_' + token);
    log('OK', 'Workflow',
      `Décision Approuvé enregistrée - ${niveau} - demande ${demande.idDemande}`);

    if (niveau === 'Superieur') {
      // Passer à la Présidence - notifier le président
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      appliquerProtectionsLigne(sheet, row);   // verrouille P (avis donné)
      const tokenPres = sheet.getRange(row, CONFIG.COL.TOKEN_PRES).getValue();
      envoyerNotificationValidateur(lireDemande(sheet, row), 'Presidence', tokenPres);
      return {
        success: true,
        message: 'Demande approuvée. La présidence a été notifiée.'
      };

    } else if (niveau === 'Presidence') {
      // Clôturer (président unique - plus de second validateur à notifier)
      cloturerDemande(sheet, row, 'Approuvé', '');
      const demandeApprouvee = lireDemande(sheet, row);
      const { dossierID, docID } = creerDossierEtDoc(demandeApprouvee);
      ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOSSIER, dossierID,
        `https://drive.google.com/drive/folders/${dossierID}`);
      ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOC, docID,
        `https://docs.google.com/document/d/${docID}/edit`);
      mettreAJourDoc(lireDemande(sheet, row));
      envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Approuvé', '');
      finaliserEnPDF(sheet, row, lireDemande(sheet, row));
      log('OK', 'Workflow', `Demande ${demande.idDemande} clôturée : Approuvé`);
      return { success: true, message: `Demande approuvée. ${demande.prenom} a été notifié(e).` };
    }
  }

  // ----------------------------------------------------------
  // CAS : REJET
  // ----------------------------------------------------------
  if (decision === 'REJETE') {
    ecrireColonne(sheet, row, colStatut,             'Rejeté');
    ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE, motif.trim());

    invaliderTokensRestants(sheet, row, niveau);

    cloturerDemande(sheet, row, 'Rejeté', motif.trim());
    envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Rejeté', motif.trim());

    log('OK', 'Workflow',
      `Décision Rejeté enregistrée - ${niveau} - demande ${demande.idDemande}`);

    return {
      success: true,
      message: `Demande rejetée. ${demande.prenom} a été notifié(e) avec le motif.`
    };
  }
}


/**
 * Le validateur demande des PRÉCISIONS à l'employé avant de décider.
 *
 * Effets :
 *   - vérifie que le niveau est bien "En attente" et que le quota
 *     MAX_PRECISIONS n'est pas atteint ;
 *   - consomme le token de décision du validateur (UTILISE_) ;
 *   - met le statut du niveau à "En attente de précisions" ;
 *   - mémorise le niveau demandeur + génère un token de réponse employé ;
 *   - envoie à l'employé un email avec un lien de réponse.
 *
 * @param {string} token    Token de décision du validateur.
 * @param {string} message  Message libre du validateur (peut être vide).
 */
function demanderPrecision(token, message) {
  const resultat = trouverLigneParTokenOptimise(token);
  if (!resultat) {
    return { success: false, message: "Ce lien de validation n'est plus actif." };
  }

  const { row, niveau } = resultat;
  const sheet   = getSheetReponses();
  const demande = lireDemande(sheet, row);

  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[niveau];

  // Le niveau doit être actif
  if (sheet.getRange(row, colStatut).getValue() !== 'En attente') {
    return {
      success: false, alreadyUsed: true,
      message: `La demande ${demande.idDemande} a déjà été traitée à ce niveau.`
    };
  }

  // Quota d'allers-retours
  const max = CONFIG.MAX_PRECISIONS || 2;
  if (demande.nbPrecisions >= max) {
    return {
      success: false,
      message: `Le nombre maximum de demandes de précisions (${max}) est atteint ` +
               `pour cette demande. Merci de l'approuver ou de la rejeter.`
    };
  }

  // Consommer le token de décision du validateur
  const colToken = (niveau === 'Superieur') ? CONFIG.COL.TOKEN_SUP : CONFIG.COL.TOKEN_PRES;
  ecrireColonne(sheet, row, colToken, 'UTILISE_' + token);

  // Marquer le niveau en attente de précisions + mémoriser le demandeur
  ecrireColonne(sheet, row, colStatut, 'En attente de précisions');
  ecrireColonne(sheet, row, CONFIG.COL.NIVEAU_PRECISION, niveau);

  // Générer le token de réponse employé
  const tokenRep = genererUUID();
  ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRECISION, tokenRep);

  // Notifier l'employé
  const lienReponse = `${CONFIG.WEBAPP_URL}?token=${tokenRep}&action=REPONSE`;
  envoyerDemandePrecision(lireDemande(sheet, row), niveau, (message || '').trim(), lienReponse);

  log('OK', 'Workflow',
    `Précisions demandées - ${niveau} - demande ${demande.idDemande} ` +
    `(aller-retour ${demande.nbPrecisions + 1}/${max})`);

  return {
    success: true,
    message: `Votre demande de précisions a été envoyée à ${demande.prenom}. ` +
             `Vous recevrez un nouvel email dès sa réponse.`
  };
}


/**
 * L'employé répond à une demande de précisions via son lien.
 *
 * Effets :
 *   - incrémente le compteur NB_PRECISIONS ;
 *   - consomme le token de réponse employé (UTILISE_) ;
 *   - régénère un token de décision pour le validateur demandeur,
 *     remet le niveau à "En attente" ;
 *   - renvoie au validateur un email de décision incluant les précisions.
 *
 * @param {string} tokenPrecision  Token du lien de réponse employé.
 * @param {string} precisions      Texte saisi par l'employé (obligatoire).
 */
function enregistrerReponseEmploye(tokenPrecision, precisions) {
  if (!precisions || !precisions.trim()) {
    return { success: false, message: 'Veuillez saisir vos précisions avant d\'envoyer.' };
  }

  const found = trouverLigneParTokenPrecision(tokenPrecision);
  if (!found || found.utilise) {
    return {
      success: false, alreadyUsed: true,
      message: "Ce lien de réponse n'est plus actif (précisions déjà envoyées)."
    };
  }

  const row     = found.row;
  const sheet   = getSheetReponses();
  const demande = lireDemande(sheet, row);

  const niveau = demande.niveauPrecision || 'Superieur';
  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[niveau];

  // Incrémenter le compteur d'allers-retours
  ecrireColonne(sheet, row, CONFIG.COL.NB_PRECISIONS, demande.nbPrecisions + 1);

  // Consommer le token de réponse employé
  ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRECISION, 'UTILISE_' + tokenPrecision);

  // Régénérer un token de décision pour le validateur + réactiver le niveau
  const tokenDecision = genererUUID();
  const colToken = (niveau === 'Superieur') ? CONFIG.COL.TOKEN_SUP : CONFIG.COL.TOKEN_PRES;
  ecrireColonne(sheet, row, colToken, tokenDecision);
  ecrireColonne(sheet, row, colStatut, 'En attente');

  // Renvoyer la notification de décision au validateur, avec les précisions
  envoyerNotificationValidateur(
    lireDemande(sheet, row), niveau, tokenDecision, false, precisions.trim());

  log('OK', 'Workflow',
    `Réponse employé enregistrée - ${niveau} - demande ${demande.idDemande} ` +
    `- validateur re-notifié`);

  return {
    success: true,
    message: "Merci, vos précisions ont été transmises au validateur."
  };
}


/**
 * Clôture une demande.
 */
function cloturerDemande(sheet, row, statut, motif) {
  ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, statut);
  ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());
  appliquerProtectionsLigne(sheet, row);   // verrouille P et Q (demande close)
  log('OK', 'Workflow',
    `Demande ligne ${row} clôturée avec statut : ${statut}`);
}


/**
 * Trigger installable onEdit - Validation manuelle via le sheet.
 */
function traiterDecisionManuelle(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.ONGLET_REPONSES) return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < 2) return;

  const lock = LockService.getScriptLock();
  const verrouillee = lock.tryLock(5000);
  if (!verrouillee) {
    log('WARN', 'traiterDecisionManuelle',
      `Verrou non obtenu ligne ${row} - exécution simultanée ignorée`);
    return;
  }

  try {
    const colsNiveau = {};
    colsNiveau[CONFIG.COL.AVIS_SUP]  = 'Superieur';
    colsNiveau[CONFIG.COL.AVIS_PRES] = 'Presidence';

    if (!(col in colsNiveau)) return;
    const niveau = colsNiveau[col];

    const nouvelleValeur = (e.value    || '').toString().trim();
    const ancienneValeur = (e.oldValue !== undefined ? e.oldValue : '').toString().trim();

    if (nouvelleValeur !== 'Approuvé' &&
        nouvelleValeur !== 'Rejeté'   &&
        nouvelleValeur !== 'En attente de précisions') return;

    if (['Approuvé', 'Rejeté'].includes(ancienneValeur)) {
      log('WARN', 'traiterDecisionManuelle',
        `Ligne ${row} - décision "${ancienneValeur}" déjà en place (col ${col}) - ré-édition ignorée`);
      return;
    }

    // Anti-réentrance : demanderPrecision() réécrit lui-même la cellule
    // d'avis à "En attente de précisions". Cette réécriture re-déclenche
    // le trigger - on l'ignore pour ne pas relancer un aller-retour.
    if (nouvelleValeur === 'En attente de précisions' &&
        ancienneValeur === 'En attente de précisions') {
      return;
    }

    const idLigne = sheet.getRange(row, CONFIG.COL.ID_DEMANDE).getValue().toString().trim();
    if (!idLigne) {
      log('WARN', 'traiterDecisionManuelle', `Ligne ${row} vide - décision ignorée`);
      return;
    }

    const statutGlobal = sheet.getRange(row, CONFIG.COL.STATUT_GLOBAL).getValue().toString();
    if (['Approuvé', 'Rejeté', 'Rejeté automatiquement'].includes(statutGlobal)) {
      log('WARN', 'traiterDecisionManuelle', `Demande ligne ${row} déjà clôturée - édition ignorée`);
      return;
    }

    const service  = sheet.getRange(row, CONFIG.COL.DEPARTEMENT).getValue().toString().trim();
    const workflow = ((CONFIG.SERVICE_SUP_MAP || {})[service] || {}).workflow || 'PRES';

    // Garde : respect de l'ordre hiérarchique (SUP_PRES uniquement)
    if (niveau === 'Presidence' && workflow === 'SUP_PRES') {
      const avisSup = sheet.getRange(row, CONFIG.COL.AVIS_SUP).getValue().toString();
      if (avisSup !== 'Approuvé') {
        e.range.setValue(ancienneValeur || 'En attente');
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Le supérieur hiérarchique doit d\'abord approuver cette demande.',
          '⚠️ Ordre de validation', 8
        );
        return;
      }
    }

    log('INFO', 'traiterDecisionManuelle',
      `Décision manuelle - niveau: ${niveau}, valeur: ${nouvelleValeur}, ligne: ${row}`);

    const demande = lireDemande(sheet, row);

    // Note : la restriction "seul le bon validateur édite sa ligne" repose
    // ici sur la PROTECTION PAR LIGNE native du Sheet : chaque cellule
    // d'avis (P/Q) n'a pour éditeur que LE validateur de cette demande
    // (cf. appliquerProtectionsLigne dans Utils.gs). On ne fait pas de
    // contrôle Session.getActiveUser() car le web app est déployé
    // "Execute as: Me" (l'email de l'éditeur peut être vide pour les
    // comptes hors domaine, ce qui bloquerait tout le monde à tort).

    // ----------------------------------------------------------
    // CAS : APPROBATION
    // ----------------------------------------------------------
    if (nouvelleValeur === 'Approuvé') {
      log('OK', 'traiterDecisionManuelle',
        `Approuvé - ${niveau} - demande ${demande.idDemande}`);

      if (niveau === 'Superieur') {
        ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
        appliquerProtectionsLigne(sheet, row);   // verrouille P (avis donné)
        const tokenPres = sheet.getRange(row, CONFIG.COL.TOKEN_PRES).getValue();
        envoyerNotificationValidateur(lireDemande(sheet, row), 'Presidence', tokenPres);
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Décision enregistrée. La présidence a été notifiée par email.',
          '✅ Approuvé', 6
        );

      } else if (niveau === 'Presidence') {
        cloturerDemande(sheet, row, 'Approuvé', '');
        const demandeApprouvee = lireDemande(sheet, row);
        const { dossierID, docID } = creerDossierEtDoc(demandeApprouvee);
        ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOSSIER, dossierID,
          `https://drive.google.com/drive/folders/${dossierID}`);
        ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOC, docID,
          `https://docs.google.com/document/d/${docID}/edit`);
        mettreAJourDoc(lireDemande(sheet, row));
        envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Approuvé', '');
        finaliserEnPDF(sheet, row, lireDemande(sheet, row));
        log('OK', 'traiterDecisionManuelle', `Demande ${demande.idDemande} clôturée : Approuvé`);
        SpreadsheetApp.getActiveSpreadsheet().toast(
          `Demande approuvée et clôturée. ${demande.prenom} a été notifié(e).`,
          '✅ Approuvé - Dossier clôturé', 10
        );
      }

    // ----------------------------------------------------------
    // CAS : REJET
    // ----------------------------------------------------------
    } else if (nouvelleValeur === 'Rejeté') {
      const motif = sheet.getRange(row, CONFIG.COL.COMMENTAIRE).getValue().toString().trim();

      if (!motif) {
        e.range.setValue(ancienneValeur || 'En attente');
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Veuillez d\'abord saisir le motif de rejet en colonne R (Commentaires), ' +
          'puis remettre "Rejeté" dans cette colonne.',
          '⚠️ Motif requis', 12
        );
        log('WARN', 'traiterDecisionManuelle',
          `Rejet sans motif bloqué - ligne ${row}, niveau ${niveau}`);
        return;
      }

      invaliderTokensRestants(sheet, row, niveau);
      cloturerDemande(sheet, row, 'Rejeté', motif);
      envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Rejeté', motif);

      log('OK', 'traiterDecisionManuelle',
        `Demande ${demande.idDemande} clôturée : Rejeté (niveau ${niveau})`);

      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Demande rejetée et clôturée. ${demande.prenom} a été notifié(e).`,
        '❌ Rejeté - Dossier clôturé', 10
      );

    // ----------------------------------------------------------
    // CAS : DEMANDE DE PRÉCISIONS
    //   Comme le rejet, le message est OBLIGATOIRE : il faut d'abord
    //   saisir ce qu'on veut savoir en colonne R (Commentaire), puis
    //   choisir "En attente de précisions" dans la colonne d'avis.
    // ----------------------------------------------------------
    } else if (nouvelleValeur === 'En attente de précisions') {
      const message = sheet.getRange(row, CONFIG.COL.COMMENTAIRE).getValue().toString().trim();

      if (!message) {
        e.range.setValue(ancienneValeur || 'En attente');
        SpreadsheetApp.getActiveSpreadsheet().toast(
          `Veuillez d'abord saisir en colonne R ce que vous souhaitez que ` +
          `${demande.prenom} précise, puis remettre "En attente de précisions".`,
          '⚠️ Message requis', 12
        );
        log('WARN', 'traiterDecisionManuelle',
          `Demande de précisions sans message bloquée - ligne ${row}, niveau ${niveau}`);
        return;
      }

      // demanderPrecision() exige que le niveau soit "En attente" et
      // repasse lui-même la cellule à "En attente de précisions".
      // On rétablit donc "En attente" avant l'appel (l'utilisateur vient
      // de saisir "En attente de précisions" à la main).
      const colStatutNiveau = (niveau === 'Superieur')
        ? CONFIG.COL.AVIS_SUP : CONFIG.COL.AVIS_PRES;
      sheet.getRange(row, colStatutNiveau).setValue('En attente');
      SpreadsheetApp.flush();

      // Le token de décision du niveau courant sert de clé à demanderPrecision
      const colToken = (niveau === 'Superieur') ? CONFIG.COL.TOKEN_SUP : CONFIG.COL.TOKEN_PRES;
      const tokenNiveau = sheet.getRange(row, colToken).getValue().toString();

      const res = demanderPrecision(tokenNiveau, message);

      if (!res.success) {
        // Quota atteint ou niveau déjà traité - revenir à l'état précédent
        e.range.setValue(ancienneValeur || 'En attente');
        SpreadsheetApp.getActiveSpreadsheet().toast(
          res.message, '⚠️ Demande de précisions impossible', 12
        );
        log('WARN', 'traiterDecisionManuelle',
          `Demande de précisions refusée - ligne ${row} : ${res.message}`);
        return;
      }

      log('OK', 'traiterDecisionManuelle',
        `Demande ${demande.idDemande} - précisions demandées manuellement (niveau ${niveau})`);

      SpreadsheetApp.getActiveSpreadsheet().toast(
        `Demande de précisions envoyée à ${demande.prenom}. Vous serez re-notifié dès sa réponse.`,
        '💬 Précisions demandées', 10
      );
    }

  } catch (err) {
    log('ERREUR', 'traiterDecisionManuelle',
      `${err.toString()} | ligne ${row} | Stack: ${err.stack}`);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Erreur lors du traitement : ' + err.message,
      '⚠️ Erreur - consultez les logs', 20
    );
  } finally {
    lock.releaseLock();
  }
}


/**
 * Invalide les tokens des niveaux situés APRÈS le niveau de rejet.
 * Ordre : Superieur → Presidence
 */
function invaliderTokensRestants(sheet, row, niveauRejet) {
  const ordre = ['Superieur', 'Presidence'];
  const tokenParNiveau = {
    Superieur:  CONFIG.COL.TOKEN_SUP,
    Presidence: CONFIG.COL.TOKEN_PRES
  };

  const idx = ordre.indexOf(niveauRejet);

  for (let i = idx + 1; i < ordre.length; i++) {
    const colToken = tokenParNiveau[ordre[i]];
    const val = sheet.getRange(row, colToken).getValue().toString();
    if (val && !val.startsWith('INVALIDE_') && !val.startsWith('UTILISE_')) {
      ecrireColonne(sheet, row, colToken, 'INVALIDE_' + val);
    }
  }
}
