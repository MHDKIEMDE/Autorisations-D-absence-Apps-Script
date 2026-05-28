// ============================================================
// Workflow.gs — Logique cascade de validation
// Système d'autorisation d'absence — Massaka SAS
// ============================================================
//
// Circuits :
//   SUP_PRES : Supérieur → Présidence (2 validateurs — 1er qui valide clôture)
//   PRES     : Présidence directement (2 validateurs — 1er qui valide clôture)
//
// Règle Présidence à 2 validateurs :
//   - Le premier qui approuve/rejette clôture le niveau
//   - Le second reçoit un email "X a déjà validé cette demande"
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

  const service  = sheet.getRange(row, CONFIG.COL.SERVICE).getValue().toString().trim();
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
    const labelNiveau = niveau === 'Superieur' ? 'Supérieur hiérarchique' : 'Présidence';
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
      // Passer à la Présidence — notifier les 2 validateurs
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      const tokenPres = sheet.getRange(row, CONFIG.COL.TOKEN_PRES).getValue();
      envoyerNotificationValidateur(lireDemande(sheet, row), 'Presidence', tokenPres);
      return {
        success: true,
        message: 'Demande approuvée. La présidence a été notifiée.'
      };

    } else if (niveau === 'Presidence') {
      // Notifier le second validateur présidence si différent de celui qui vient de valider
      _notifierSecondValidateurPresidence(lireDemande(sheet, row), token, demande);

      // Clôturer
      cloturerDemande(sheet, row, 'Approuvé', '');
      const demandeApprouvee = lireDemande(sheet, row);
      const { dossierID, docID } = creerDossierEtDoc(demandeApprouvee);
      ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOSSIER, dossierID,
        `https://drive.google.com/drive/folders/${dossierID}`);
      ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOC, docID,
        `https://docs.google.com/document/d/${docID}/edit`);
      mettreAJourDoc(lireDemande(sheet, row));
      envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Approuvé', '');
      log('OK', 'Workflow', `Demande ${demande.idDemande} clôturée : Approuvé`);
      return { success: true, message: "Demande approuvée. L'employé a été notifié." };
    }
  }

  // ----------------------------------------------------------
  // CAS : REJET
  // ----------------------------------------------------------
  if (decision === 'REJETE') {
    ecrireColonne(sheet, row, colStatut,             'Rejeté');
    ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE, motif.trim());

    invaliderTokensRestants(sheet, row, niveau);

    if (niveau === 'Presidence') {
      _notifierSecondValidateurPresidence(lireDemande(sheet, row), token, demande);
    }

    cloturerDemande(sheet, row, 'Rejeté', motif.trim());
    envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Rejeté', motif.trim());

    log('OK', 'Workflow',
      `Décision Rejeté enregistrée - ${niveau} - demande ${demande.idDemande}`);

    return {
      success: true,
      message: "Demande rejetée. L'employé a été notifié avec le motif."
    };
  }
}


/**
 * Notifie le second validateur présidence que le premier a déjà statué.
 */
function _notifierSecondValidateurPresidence(demande, tokenUtilise, demandeAvantCloture) {
  const pres = getPresidencePourSup(demande.emailSuperieur, demande.nomOrg);
  const emails = pres.emails || [];
  const noms   = pres.noms   || [];

  // Identifier l'email du validateur qui vient d'agir via son token
  // On notifie tous les autres emails présidence
  const nomOrg = demande.nomOrg || CONFIG.NOM_ORG;
  const theme  = getThemeEmail(nomOrg, demande.emailSuperieur);

  emails.forEach((email, i) => {
    if (!email) return;
    const nom = noms[i] || email;

    const htmlBody = `
      <!DOCTYPE html><html><head><meta charset="UTF-8">${cssEmail(theme)}</head>
      <body><div class="wrap">
        <div class="header">
          <div class="logo">⬡ ${nomOrg}</div>
          <div class="sous-titre">Système de gestion des absences</div>
          <div class="badge">Information — Décision enregistrée</div>
        </div>
        <div class="body">
          <p style="font-size:15px;margin-bottom:4px">Bonjour <strong>${nom}</strong>,</p>
          <p style="font-size:14px;color:#555555;margin-top:8px;line-height:1.6">
            La demande <strong>${demande.idDemande}</strong> de
            <strong>${demande.prenom} ${demande.nom}</strong>
            a déjà été traitée par un autre validateur présidence.
            <br><br>
            Aucune action n'est requise de votre part. Merci pour votre attention.
          </p>
          ${blocRecapitulatif(demande, theme)}
          <p class="note">Référence : <strong>${demande.idDemande}</strong></p>
        </div>
        <div class="footer">${nomOrg} — Système automatisé de gestion des absences</div>
      </div></body></html>
    `;

    GmailApp.sendEmail(
      email,
      `${nomOrg} – Déjà validée – ${demande.idDemande} – ${demande.prenom} ${demande.nom}`,
      '',
      { htmlBody: htmlBody, name: nomOrg + ' Système' }
    );
    log('OK', 'Workflow', `Notification second validateur → ${email} | ref=${demande.idDemande}`);
  });
}


/**
 * Clôture une demande.
 */
function cloturerDemande(sheet, row, statut, motif) {
  ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, statut);
  ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());
  log('OK', 'Workflow',
    `Demande ligne ${row} clôturée avec statut : ${statut}`);
}


/**
 * Trigger installable onEdit — Validation manuelle via le sheet.
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
      `Verrou non obtenu ligne ${row} — exécution simultanée ignorée`);
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

    if (nouvelleValeur !== 'Approuvé' && nouvelleValeur !== 'Rejeté') return;

    if (['Approuvé', 'Rejeté'].includes(ancienneValeur)) {
      log('WARN', 'traiterDecisionManuelle',
        `Ligne ${row} — décision "${ancienneValeur}" déjà en place (col ${col}) — ré-édition ignorée`);
      return;
    }

    const idLigne = sheet.getRange(row, CONFIG.COL.ID_DEMANDE).getValue().toString().trim();
    if (!idLigne) {
      log('WARN', 'traiterDecisionManuelle', `Ligne ${row} vide — décision ignorée`);
      return;
    }

    const statutGlobal = sheet.getRange(row, CONFIG.COL.STATUT_GLOBAL).getValue().toString();
    if (['Approuvé', 'Rejeté', 'Rejeté automatiquement'].includes(statutGlobal)) {
      log('WARN', 'traiterDecisionManuelle', `Demande ligne ${row} déjà clôturée — édition ignorée`);
      return;
    }

    const service  = sheet.getRange(row, CONFIG.COL.SERVICE).getValue().toString().trim();
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

    // ----------------------------------------------------------
    // CAS : APPROBATION
    // ----------------------------------------------------------
    if (nouvelleValeur === 'Approuvé') {
      log('OK', 'traiterDecisionManuelle',
        `Approuvé - ${niveau} - demande ${demande.idDemande}`);

      if (niveau === 'Superieur') {
        ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
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
        log('OK', 'traiterDecisionManuelle', `Demande ${demande.idDemande} clôturée : Approuvé`);
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Demande approuvée et clôturée. L\'employé a été notifié.',
          '✅ Approuvé — Dossier clôturé', 10
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
          'Veuillez d\'abord saisir le motif de rejet en colonne S, ' +
          'puis remettre "Rejeté" dans cette colonne.',
          '⚠️ Motif requis', 12
        );
        log('WARN', 'traiterDecisionManuelle',
          `Rejet sans motif bloqué — ligne ${row}, niveau ${niveau}`);
        return;
      }

      invaliderTokensRestants(sheet, row, niveau);
      cloturerDemande(sheet, row, 'Rejeté', motif);
      envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Rejeté', motif);

      log('OK', 'traiterDecisionManuelle',
        `Demande ${demande.idDemande} clôturée : Rejeté (niveau ${niveau})`);

      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Demande rejetée et clôturée. L\'employé a été notifié.',
        '❌ Rejeté — Dossier clôturé', 10
      );
    }

  } catch (err) {
    log('ERREUR', 'traiterDecisionManuelle',
      `${err.toString()} | ligne ${row} | Stack: ${err.stack}`);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      'Erreur lors du traitement : ' + err.message,
      '⚠️ Erreur — consultez les logs', 20
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
