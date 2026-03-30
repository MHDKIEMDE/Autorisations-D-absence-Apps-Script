// ============================================================
// Code.gs — Trigger onFormSubmit + rejet automatique 72h
// Système d'autorisation d'absence — Massaka
// ============================================================

function onFormSubmit(e) {
  const sheet = e.range.getSheet();
  const row   = e.range.getRow();
  log('INFO', 'onFormSubmit', `Nouvelle demande reçue - ligne ${row}`);

  try {
    // ----------------------------------------------------------
    // 1. Lire les données brutes nécessaires à la règle 72h
    // ----------------------------------------------------------
    const typePerm     = sheet.getRange(row, CONFIG.COL.TYPE_PERM).getValue();
    // "Permission ordinaire" stocke ses dates dans DATE_DEBUT_ORD (col O), pas DATE_DEBUT (col I)
    const colDateDebut = (typePerm === 'Permission ordinaire')
      ? CONFIG.COL.DATE_DEBUT_ORD
      : CONFIG.COL.DATE_DEBUT;
    const dateDebut  = sheet.getRange(row, colDateDebut).getValue();
    const heureDebut = sheet.getRange(row, CONFIG.COL.HEURE_DEBUT).getValue();

    // ----------------------------------------------------------
    // 1b. Résoudre le supérieur hiérarchique et le workflow depuis le service
    //     Le formulaire ne collecte plus l'email du supérieur :
    //     il est déterminé automatiquement via SERVICE_SUP_MAP.
    // ----------------------------------------------------------
    const service       = sheet.getRange(row, CONFIG.COL.SERVICE).getValue().toString().trim();
    const serviceConfig = (CONFIG.SERVICE_SUP_MAP || {})[service] || {};
    const emailSup      = serviceConfig.sup  || '';
    // Service inconnu : fallback RH_PRES (évite de bloquer un envoi vers un supérieur inexistant)
    const workflow      = serviceConfig.workflow || 'RH_PRES';

    if (!serviceConfig.workflow) {
      log('WARN', 'onFormSubmit',
        `Service "${service}" absent de SERVICE_SUP_MAP — workflow RH_PRES appliqué par défaut, ligne ${row}`);
    }

    ecrireColonne(sheet, row, CONFIG.COL.EMAIL_SUP, emailSup);

    // ----------------------------------------------------------
    // 2. Générer l'ID de demande en premier (toujours)
    //    Verrou scriptLock : garantit qu'aucune soumission simultanée
    //    ne lit le même maxNumero et ne génère un ID en double.
    //    Le verrou couvre lecture + écriture (les deux doivent être atomiques).
    // ----------------------------------------------------------
    const lockID = LockService.getScriptLock();
    lockID.waitLock(15000); // attend jusqu'à 15 s si une autre soumission est en cours
    const idDemande = genererIdDemande(sheet);
    ecrireColonne(sheet, row, CONFIG.COL.ID_DEMANDE, idDemande);
    lockID.releaseLock();
    log('INFO', 'onFormSubmit', `ID généré : ${idDemande}`);

    // ----------------------------------------------------------
    // 3. RÈGLE MÉTIER : Rejet automatique si délai insuffisant
    //    Applicable à TOUTES les permissions sans exception.
    //    Le délai est exprimé en JOURS OUVRABLES (hors week-ends
    //    et jours fériés listés dans CONFIG.JOURS_FERIES).
    //    Pour toute urgence, contacter la RH directement.
    // ----------------------------------------------------------
    {
      const dateHeureDebut = new Date(dateDebut);
      if (heureDebut) {
        const h = heureDebut.getHours   ? heureDebut.getHours()   : 0;
        const m = heureDebut.getMinutes ? heureDebut.getMinutes() : 0;
        dateHeureDebut.setHours(h, m, 0, 0);
      }

      const nbJoursOuvr  = joursOuvrables(dateHeureDebut);
      const delaiMin     = CONFIG.DELAI_MIN_JOURS_OUVRABLES || 3;
      log('INFO', 'rejetDelai',
        `Vérification délai pour ${idDemande} : ${nbJoursOuvr} jour(s) ouvrable(s) avant début`);

      if (nbJoursOuvr < delaiMin) {
        log('WARN', 'rejetDelai',
          `Demande ${idDemande} rejetée automatiquement : ` +
          `${nbJoursOuvr} jour(s) ouvrable(s) < ${delaiMin} requis`);

        ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,    '');
        ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,     '');
        ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES,   '');
        ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE,
          `Demande soumise avec un délai insuffisant : ${nbJoursOuvr} jour(s) ouvrable(s) ` +
          `avant le début de l'absence (minimum requis : ${delaiMin} jours ouvrables).`);
        ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, 'Rejeté automatiquement');
        ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());

        envoyerConfirmationFinaleEmploye(
          lireDemande(sheet, row),
          'Rejeté',
          `Demande hors délai (${delaiMin} jours ouvrables requis). Contactez les RH en cas d'urgence.`
        );
        envoyerNotificationFinaleRH(
          lireDemande(sheet, row),
          'Rejeté',
          `Rejet automatique — délai insuffisant (${nbJoursOuvr} jour(s) ouvrable(s), minimum requis : ${delaiMin}).`
        );

        log('OK', 'onFormSubmit',
          `Demande ${idDemande} clôturée : Rejeté automatiquement - ligne ${row}`);
        return;
      }
    }

    // ----------------------------------------------------------
    // 4. Générer les 3 tokens (UUID uniques)
    // ----------------------------------------------------------
    const tokenSup  = genererUUID();
    const tokenRH   = genererUUID();
    const tokenPres = genererUUID();
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP,  tokenSup);
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_RH,   tokenRH);
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRES, tokenPres);
    log('INFO', 'initTokens', `Tokens générés pour ${idDemande}`);

    // ----------------------------------------------------------
    // 5. Initialiser les statuts selon le workflow du service
    //    Les niveaux sautés sont marqués "Approuvé" (non applicable)
    //    et leur token est immédiatement invalidé.
    //
    //    SUP_RH_PRES : Supérieur → RH → Présidence  (circuit complet)
    //    RH_PRES     : RH → Présidence              (pas de supérieur)
    //    PRES        : Présidence directement        (ex : service RH)
    // ----------------------------------------------------------
    let premierNiveau; // premier validateur à notifier
    if (workflow === 'RH_PRES') {
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  'Approuvé');   // niveau sauté
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP, 'INVALIDE_' + tokenSup);
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,   'En attente');
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      premierNiveau = 'RH';
    } else if (workflow === 'PRES_RH') {
      // Présidence valide en premier, RH est validateur final
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  'Approuvé');   // niveau sauté
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP, 'INVALIDE_' + tokenSup);
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,   'En attente'); // validateur final
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente'); // premier validateur
      premierNiveau = 'Presidence';
    } else if (workflow === 'PRES') {
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  'Approuvé');   // niveau sauté
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP, 'INVALIDE_' + tokenSup);
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,   'Approuvé');   // niveau sauté
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_RH,  'INVALIDE_' + tokenRH);
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      premierNiveau = 'Presidence';
    } else {
      // SUP_RH_PRES — circuit complet (défaut)
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  'En attente');
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_RH,   'En attente');
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      premierNiveau = 'Superieur';
    }
    ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, 'En cours');

    // ----------------------------------------------------------
    // 6. Notifier le premier validateur selon le workflow du service
    //    (le dossier Drive est créé uniquement à l'approbation finale)
    // ----------------------------------------------------------
    // Construire l'objet demande une seule fois et injecter emailSup directement
    // (évite un problème de timing entre ecrireColonne et getValues)
    const demande = Object.assign(lireDemande(sheet, row), { emailSuperieur: emailSup });

    const tokenPremier = { Superieur: tokenSup, RH: tokenRH, Presidence: tokenPres }[premierNiveau];
    envoyerNotificationValidateur(demande, premierNiveau, tokenPremier);
    log('INFO', 'onFormSubmit',
      `Workflow "${workflow}" — premier validateur notifié : ${premierNiveau}`);

    // ----------------------------------------------------------
    // 8. Accusé de réception à l'employé
    // ----------------------------------------------------------
    envoyerAccuseReceptionEmploye(demande);

    log('OK', 'onFormSubmit',
      `Demande ${idDemande} initialisée avec succès - ligne ${row}`);

  } catch (err) {
    log('ERREUR', 'onFormSubmit', `${err.toString()} | Stack: ${err.stack}`);
  }
}


// ============================================================
// onEdit (simple) — Bloque toute re-modification une fois la décision prise.
// Le traitement du workflow est assuré par le trigger installable
// "traiterDecisionManuelle" (installé via le menu Absences).
// ============================================================
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.ONGLET_REPONSES) return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < 2) return;

  const colsSurveillees = [CONFIG.COL.AVIS_SUP, CONFIG.COL.AVIS_RH, CONFIG.COL.AVIS_PRES];
  if (!colsSurveillees.includes(col)) return;

  const ancienneValeur = (e.oldValue !== undefined ? e.oldValue : '').toString();
  const statutGlobal   = sheet.getRange(row, CONFIG.COL.STATUT_GLOBAL).getValue().toString();

  // Bloquer si aucune demande active sur cette ligne
  if (statutGlobal !== 'En cours') {
    e.range.setValue(ancienneValeur);
    const motif = statutGlobal
      ? 'La décision pour cette demande est déjà enregistrée (' + statutGlobal + ').'
      : 'Aucune demande active sur cette ligne.';
    SpreadsheetApp.getActiveSpreadsheet().toast(
      motif + ' Aucune modification n\'est autorisée.',
      '⚠️ Modification refusée',
      10
    );
    log('WARN', 'onEdit',
      `Modification annulée - ligne ${row}, col ${col}, statut: "${statutGlobal || 'vide'}"`);
  }
}


// ============================================================
// STUBS — Implémentés dans DriveManager.gs et Notifications.gs
// Ces déclarations évitent les erreurs "undefined" si Code.gs
// est chargé avant les autres fichiers dans l'éditeur Apps Script.
// ============================================================

// -- DriveManager.gs --
// function creerDossierEtDoc(demande)            → { dossierID, docID }
// function deplacerVersDossierStatut(id, nom, s) → void

// -- Notifications.gs --
// function envoyerNotificationValidateur(demande, niveau, token) → void
// function envoyerAccuseReceptionEmploye(demande)                → void
// function envoyerConfirmationFinaleEmploye(demande, dec, motif) → void