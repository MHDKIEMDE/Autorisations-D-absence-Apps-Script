// ============================================================
// Workflow.gs — Logique cascade de validation
// Système d'autorisation d'absence — Massaka
// ============================================================
//
// Règle de notification à l'employé :
//   ❌ PAS de notification lors des approbations intermédiaires
//      (Supérieur → RH → Présidence)
//   ✅ Notification UNIQUEMENT si :
//      a) Rejet à n'importe quel niveau
//      b) Approbation finale par la Présidence
// ============================================================


/**
 * Traite la décision d'un validateur (approbation ou rejet).
 *
 * @param {string} token    - Token UUID du validateur
 * @param {string} decision - 'APPROUVE' | 'REJETE'
 * @param {string} motif    - Motif de rejet (obligatoire si REJETE)
 * @returns {{ success: boolean, alreadyUsed?: boolean, message: string }}
 */
function traiterDecision(token, decision, motif) {
  log('INFO', 'Workflow', `Traitement décision - token: ${token.substring(0, 8)}...`);

  // ----------------------------------------------------------
  // 1. Retrouver la ligne à partir du token
  // ----------------------------------------------------------
  const resultat = trouverLigneParToken(token);
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

  // ----------------------------------------------------------
  // 2. Vérifier que ce niveau est bien "En attente"
  //    (protection anti double-clic / double envoi)
  // ----------------------------------------------------------
  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'RH':         CONFIG.COL.AVIS_RH,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[niveau];

  const statutActuel = sheet.getRange(row, colStatut).getValue();

  if (statutActuel !== 'En attente') {
    const labelNiveau = niveau === 'Superieur'  ? 'Supérieur hiérarchique'
                      : niveau === 'RH'         ? 'RH'
                      :                           'Présidence';
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
  // 3. Valider le motif si rejet
  // ----------------------------------------------------------
  if (decision === 'REJETE' && (!motif || motif.trim() === '')) {
    return { success: false, message: 'Le motif de rejet est obligatoire.' };
  }

  // ----------------------------------------------------------
  // 4a. CAS : APPROBATION
  // ----------------------------------------------------------
  if (decision === 'APPROUVE') {
    ecrireColonne(sheet, row, colStatut, 'Approuvé');
    log('OK', 'Workflow',
      `Décision Approuvé enregistrée - ${niveau} - demande ${demande.idDemande}`);

    if (niveau === 'Superieur') {
      // Passer au RH — PAS de notification à l'employé
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH, 'En attente');
      const tokenRH = sheet.getRange(row, CONFIG.COL.TOKEN_RH).getValue();
      envoyerNotificationValidateur(lireDemande(sheet, row), 'RH', tokenRH);
      return {
        success: true,
        message: 'Demande approuvée. Le service RH a été notifié.'
      };

    } else if (niveau === 'RH') {
      // Passer à la Présidence — PAS de notification à l'employé
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      const tokenPres = sheet.getRange(row, CONFIG.COL.TOKEN_PRES).getValue();
      envoyerNotificationValidateur(lireDemande(sheet, row), 'Presidence', tokenPres);
      return {
        success: true,
        message: 'Demande approuvée. La présidence a été notifiée.'
      };

    } else if (niveau === 'Presidence') {
      // Invalider le token pour éviter que le 2e contact Présidence revalide
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRES, 'UTILISE_' + token);

      // Clôturer la demande
      cloturerDemande(sheet, row, 'Approuvé', '');

      // Créer le dossier Drive + doc uniquement à l'approbation finale
      const demandeApprouvee = lireDemande(sheet, row);
      const { dossierID, docID } = creerDossierEtDoc(demandeApprouvee);
      ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOSSIER, dossierID,
        `https://drive.google.com/drive/folders/${dossierID}`);
      ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOC, docID,
        `https://docs.google.com/document/d/${docID}/edit`);
      mettreAJourDoc(lireDemande(sheet, row));

      // ✅ Notifier l'employé — approbation finale uniquement ici
      envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Approuvé', '');

      log('OK', 'Workflow', `Demande ${demande.idDemande} clôturée : Approuvé`);
      return {
        success: true,
        message: "Demande approuvée. L'employé a été notifié."
      };
    }
  }

  // ----------------------------------------------------------
  // 4b. CAS : REJET
  // ----------------------------------------------------------
  if (decision === 'REJETE') {
    // Enregistrer la décision et le motif
    ecrireColonne(sheet, row, colStatut,             'Rejeté');
    ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE, motif.trim());

    // Invalider tous les tokens des niveaux suivants (ils ne seront jamais utilisés)
    invaliderTokensRestants(sheet, row, niveau);

    // Clôturer la demande
    cloturerDemande(sheet, row, 'Rejeté', motif.trim());

    // ✅ Notifier l'employé — rejet à tout niveau
    envoyerConfirmationFinaleEmploye(lireDemande(sheet, row), 'Rejeté', motif.trim());

    log('OK', 'Workflow',
      `Décision Rejeté enregistrée - ${niveau} - demande ${demande.idDemande}`);
    log('OK', 'Workflow',
      `Demande ${demande.idDemande} clôturée : Rejeté`);

    return {
      success: true,
      message: "Demande rejetée. L'employé a été notifié avec le motif."
    };
  }
}


/**
 * Clôture une demande : écrit le statut global et la date de clôture.
 *
 * @param {Sheet}  sheet  - Sheet des réponses
 * @param {number} row    - Numéro de ligne
 * @param {string} statut - 'Approuvé' | 'Rejeté'
 * @param {string} motif  - Motif (pour traçabilité — déjà écrit en colonne T avant cet appel)
 */
function cloturerDemande(sheet, row, statut, motif) {
  ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, statut);
  ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());
  log('OK', 'Workflow',
    `Demande ligne ${row} clôturée avec statut : ${statut}`);
}


/**
 * Trigger installable onEdit — Validation manuelle via le sheet.
 *
 * Déclenché quand un validateur saisit "Approuvé" ou "Rejeté"
 * directement dans les colonnes AVIS_SUP (Q), AVIS_RH (R) ou AVIS_PRES (S).
 *
 * Pour un rejet, le motif doit être saisi en colonne T (COMMENTAIRE)
 * AVANT de mettre "Rejeté" dans la colonne d'avis.
 *
 * Installation : menu Absences → "Activer validation manuelle (Sheet)"
 */
function traiterDecisionManuelle(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.ONGLET_REPONSES) return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < 2) return;

  // ----------------------------------------------------------
  // Verrou exclusif — protège contre :
  //   • deux triggers "traiterDecisionManuelle" en doublon
  //   • deux validateurs éditant simultanément
  // Si le verrou n'est pas obtenu en 5 s, l'exécution est ignorée
  // (le simple trigger "onEdit" aura déjà bloqué la 2e modification).
  // ----------------------------------------------------------
  const lock = LockService.getScriptLock();
  const verrouillee = lock.tryLock(5000);
  if (!verrouillee) {
    log('WARN', 'traiterDecisionManuelle',
      `Verrou non obtenu ligne ${row} — exécution simultanée ignorée`);
    return;
  }

  // Tout le traitement est dans try/finally pour garantir
  // la libération du verrou, même en cas de return anticipé.
  try {
    // Mapping colonne → niveau
    const colsNiveau = {};
    colsNiveau[CONFIG.COL.AVIS_SUP]  = 'Superieur';
    colsNiveau[CONFIG.COL.AVIS_RH]   = 'RH';
    colsNiveau[CONFIG.COL.AVIS_PRES] = 'Presidence';

    if (!(col in colsNiveau)) return;
    const niveau = colsNiveau[col];

    const nouvelleValeur = (e.value    || '').toString().trim();
    const ancienneValeur = (e.oldValue !== undefined ? e.oldValue : '').toString().trim();

    if (nouvelleValeur !== 'Approuvé' && nouvelleValeur !== 'Rejeté') return;

    // Garde 1 : ré-édition d'une cellule déjà décidée
    //   Couvre le cas "lien email utilisé en premier puis tentative d'édition sheet"
    //   pour les niveaux intermédiaires où statutGlobal reste "En cours".
    if (['Approuvé', 'Rejeté'].includes(ancienneValeur)) {
      log('WARN', 'traiterDecisionManuelle',
        `Ligne ${row} — décision "${ancienneValeur}" déjà en place (col ${col}) — ré-édition ignorée`);
      return;
    }

    // Garde 2 : ligne vide — pas de demande réelle sur cette ligne
    const idLigne = sheet.getRange(row, CONFIG.COL.ID_DEMANDE).getValue().toString().trim();
    if (!idLigne) {
      log('WARN', 'traiterDecisionManuelle', `Ligne ${row} vide — décision ignorée`);
      return;
    }

    // Garde 3 : demande globalement clôturée (niveau final ou rejet)
    const statutGlobal = sheet.getRange(row, CONFIG.COL.STATUT_GLOBAL).getValue().toString();
    if (['Approuvé', 'Rejeté', 'Rejeté automatiquement'].includes(statutGlobal)) {
      log('WARN', 'traiterDecisionManuelle', `Demande ligne ${row} déjà clôturée — édition ignorée`);
      return;
    }

    // Garde 4 : respect de l'ordre hiérarchique
    if (niveau === 'RH') {
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
    if (niveau === 'Presidence') {
      const avisRH = sheet.getRange(row, CONFIG.COL.AVIS_RH).getValue().toString();
      if (avisRH !== 'Approuvé') {
        e.range.setValue(ancienneValeur || 'En attente');
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Le service RH doit d\'abord approuver cette demande.',
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
        const tokenRH = sheet.getRange(row, CONFIG.COL.TOKEN_RH).getValue();
        envoyerNotificationValidateur(lireDemande(sheet, row), 'RH', tokenRH);
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Décision enregistrée. Le service RH a été notifié par email.',
          '✅ Approuvé', 6
        );

      } else if (niveau === 'RH') {
        const tokenPres = sheet.getRange(row, CONFIG.COL.TOKEN_PRES).getValue();
        envoyerNotificationValidateur(lireDemande(sheet, row), 'Presidence', tokenPres);
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Décision enregistrée. La Présidence a été notifiée par email.',
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

      // Motif obligatoire — bloquer si colonne T est vide
      if (!motif) {
        e.range.setValue(ancienneValeur || 'En attente');
        SpreadsheetApp.getActiveSpreadsheet().toast(
          'Veuillez d\'abord saisir le motif de rejet en colonne T, ' +
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

      const avertMotif = motif ? '' : ' ⚠️ Aucun motif saisi en colonne T.';
      SpreadsheetApp.getActiveSpreadsheet().toast(
        'Demande rejetée et clôturée. L\'employé a été notifié.' + avertMotif,
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
    // Libération garantie du verrou dans tous les cas (return, exception, succès)
    lock.releaseLock();
  }
}


/**
 * Invalide les tokens des niveaux situés APRÈS le niveau de rejet.
 * Cela empêche les validateurs suivants d'utiliser un lien devenu caduc.
 *
 * Ordre : Superieur (0) → RH (1) → Presidence (2)
 *
 * @param {Sheet}  sheet       - Sheet des réponses
 * @param {number} row         - Numéro de ligne
 * @param {string} niveauRejet - Niveau qui a rejeté ('Superieur'|'RH'|'Presidence')
 */
function invaliderTokensRestants(sheet, row, niveauRejet) {
  const ordre     = ['Superieur', 'RH', 'Presidence'];
  const colTokens = [
    CONFIG.COL.TOKEN_SUP,
    CONFIG.COL.TOKEN_RH,
    CONFIG.COL.TOKEN_PRES
  ];

  const idx = ordre.indexOf(niveauRejet);

  for (let i = idx + 1; i < ordre.length; i++) {
    const val = sheet.getRange(row, colTokens[i]).getValue().toString();
    // Ne préfixer que si le token n'est pas déjà invalide
    if (val && !val.startsWith('INVALIDE_') && !val.startsWith('UTILISE_')) {
      ecrireColonne(sheet, row, colTokens[i], 'INVALIDE_' + val);
    }
  }
}
