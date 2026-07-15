// ============================================================
// Code.gs - Trigger onFormSubmit + rejet automatique 72h
// Système d'autorisation d'absence - Massaka SAS
// ============================================================

function onFormSubmit(e) {
  const sheet = e.range.getSheet();
  const row   = e.range.getRow();
  log('INFO', 'onFormSubmit', `Nouvelle demande reçue - ligne ${row}`);

  try {
    // ----------------------------------------------------------
    // 1. Normaliser dates / heures selon le cas
    //
    //    Priorité :
    //    a) Sous-type Famille à durée prédéfinie (DUREES_FAMILLE)
    //       → date fin = début + (N-1) jours calendaires, journée 08h-17h
    //    b) Durée "Toute la journée" → journée 08h-17h, fin = début
    //    c) "Personnaliser" → garde-fou date fin (défaut = début)
    // ----------------------------------------------------------
    const H08 = new Date(1899, 11, 30, 8,  0, 0);  // base GAS pour TimeOfDay
    const H17 = new Date(1899, 11, 30, 17, 0, 0);

    const familleVal  = sheet.getRange(row, CONFIG.COL.FAMILLE).getValue().toString().trim();
    const dureeFamille = (CONFIG.DUREES_FAMILLE || {})[familleVal];  // nombre de jours ou undefined
    const dDebut      = sheet.getRange(row, CONFIG.COL.DATE_DEBUT).getValue();

    if (dureeFamille && dDebut) {
      // a) Famille à durée fixe - fin calculée, journée entière
      const dFinCalc = new Date(dDebut);
      dFinCalc.setDate(dFinCalc.getDate() + (dureeFamille - 1));
      ecrireColonne(sheet, row, CONFIG.COL.HEURE_DEBUT, H08);
      ecrireColonne(sheet, row, CONFIG.COL.HEURE_FIN,   H17);
      ecrireColonne(sheet, row, CONFIG.COL.DATE_FIN,    dFinCalc);
      log('INFO', 'onFormSubmit',
        `Famille "${familleVal}" - durée ${dureeFamille}j, date fin calculée, ligne ${row}`);

    } else {
      const duree = sheet.getRange(row, CONFIG.COL.DUREE).getValue().toString().trim();
      if (/journ[ée]e/i.test(duree)) {
        // b) Toute la journée
        if (dDebut) {
          ecrireColonne(sheet, row, CONFIG.COL.HEURE_DEBUT, H08);
          ecrireColonne(sheet, row, CONFIG.COL.HEURE_FIN,   H17);
          ecrireColonne(sheet, row, CONFIG.COL.DATE_FIN,    dDebut);
          log('INFO', 'onFormSubmit',
            `Durée "Toute la journée" - heures 08h00-17h00 et date fin injectées, ligne ${row}`);
        }
      } else {
        // c) Personnaliser - garde-fou date fin
        const dFin = sheet.getRange(row, CONFIG.COL.DATE_FIN).getValue();
        if (!dFin && dDebut) {
          ecrireColonne(sheet, row, CONFIG.COL.DATE_FIN, dDebut);
          log('INFO', 'onFormSubmit',
            `Date de fin absente - défaut = date de début, ligne ${row}`);
        }
      }
    }

    // Forcer l'affichage HEURE sur cette ligne : sans ça, les heures
    // 08h00/17h00 (objets Date basés sur 1899) s'affichent comme une
    // date "30/12/1899" dans le Sheet au lieu de "08:00:00" / "17:00:00".
    sheet.getRange(row, CONFIG.COL.HEURE_DEBUT).setNumberFormat('HH:mm:ss');
    sheet.getRange(row, CONFIG.COL.HEURE_FIN).setNumberFormat('HH:mm:ss');

    // ----------------------------------------------------------
    // 1b. Lire les données brutes pour la règle de délai
    // ----------------------------------------------------------
    const dateDebut    = sheet.getRange(row, CONFIG.COL.DATE_DEBUT).getValue();
    const heureDebut   = sheet.getRange(row, CONFIG.COL.HEURE_DEBUT).getValue();
    const typeAbsence  = sheet.getRange(row, CONFIG.COL.TYPE_ABSENCE).getValue().toString().trim();

    // ----------------------------------------------------------
    // 1c. Résoudre le supérieur et le workflow depuis le département
    // ----------------------------------------------------------
    const service       = sheet.getRange(row, CONFIG.COL.DEPARTEMENT).getValue().toString().trim();
    const serviceConfig = (CONFIG.SERVICE_SUP_MAP || {})[service] || {};
    // sup est une clé interne (ex: 'SUP_CPD') - résolution de l'email via PERSONNEL
    const emailSup      = getEmailSuperieur(serviceConfig.sup);
    const workflow      = serviceConfig.workflow || 'PRES';

    if (!serviceConfig.workflow) {
      log('WARN', 'onFormSubmit',
        `Service "${service}" absent de SERVICE_SUP_MAP - workflow PRES appliqué par défaut, ligne ${row}`);
    }

    ecrireColonne(sheet, row, CONFIG.COL.EMAIL_SUP, emailSup);

    // ----------------------------------------------------------
    // 2. Générer l'ID de demande
    // ----------------------------------------------------------
    const lockID = LockService.getScriptLock();
    lockID.waitLock(15000);
    const idDemande = genererIdDemande(sheet);
    ecrireColonne(sheet, row, CONFIG.COL.ID_DEMANDE, idDemande);
    lockID.releaseLock();
    log('INFO', 'onFormSubmit', `ID généré : ${idDemande}`);

    // ----------------------------------------------------------
    // 3. Rejet automatique si délai insuffisant
    //    Exemption : les types listés dans TYPES_SANS_DELAI
    //    (ex: "Urgence") sautent ce contrôle et entrent
    //    directement dans le circuit de validation.
    // ----------------------------------------------------------
    const typesSansDelai = CONFIG.TYPES_SANS_DELAI || [];
    // Comparaison TOLÉRANTE : reconnaît "Urgence" même si l'option du
    // formulaire a été renommée (ex: "Urgence (sans délai - …)").
    const exemptDelai    = typesSansDelai.some(t => estType(typeAbsence, t));

    if (exemptDelai) {
      log('INFO', 'rejetDelai',
        `Demande ${idDemande} exemptée du contrôle de délai (type "${typeAbsence}")`);
    }

    if (!exemptDelai) {
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

        ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  '');
        ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, '');
        ecrireColonne(sheet, row, CONFIG.COL.COMMENTAIRE,
          `Demande soumise avec un délai insuffisant : ${nbJoursOuvr} jour(s) ouvrable(s) ` +
          `avant le début de l'absence (minimum requis : ${delaiMin} jours ouvrables).`);
        ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, 'Rejeté automatiquement');
        ecrireColonne(sheet, row, CONFIG.COL.DATE_CLOTURE,  new Date());

        appliquerProtectionsLigne(sheet, row);   // verrouille P et Q (demande close)

        envoyerConfirmationFinaleEmploye(
          lireDemande(sheet, row),
          'Rejeté',
          `Demande hors délai (${delaiMin} jours ouvrables requis).`
        );

        log('OK', 'onFormSubmit',
          `Demande ${idDemande} clôturée : Rejeté automatiquement - ligne ${row}`);
        return;
      }
    }

    // ----------------------------------------------------------
    // 4. Générer les tokens (SUP + PRES uniquement)
    // ----------------------------------------------------------
    const tokenSup  = genererUUID();
    const tokenPres = genererUUID();
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP,  tokenSup);
    ecrireColonne(sheet, row, CONFIG.COL.TOKEN_PRES, tokenPres);
    log('INFO', 'initTokens', `Tokens générés pour ${idDemande}`);

    // ----------------------------------------------------------
    // 5. Initialiser les statuts selon le workflow
    //
    //    SUP_PRES : Supérieur → Présidence
    //    PRES     : Présidence directement
    //
    //    Anti auto-validation : si le demandeur EST lui-même le
    //    supérieur du service (ex: la responsable CpD demande une
    //    absence), on saute le niveau Supérieur - il ne peut pas
    //    s'auto-approuver - et on démarre directement à la Présidence.
    //
    //    Sup vide (en congé / non configuré) : le niveau Supérieur
    //    est validé par défaut et la demande part directement à la
    //    Présidence - elle ne reste jamais bloquée sans validateur.
    //
    //    Sup = président : si l'email du sup est celui du président
    //    du périmètre (remplacement temporaire), inutile de le faire
    //    valider deux fois - envoi direct en validation finale.
    // ----------------------------------------------------------
    const emailEmploye = sheet.getRange(row, CONFIG.COL.EMAIL_EMPLOYE)
                              .getValue().toString().trim().toLowerCase();
    const demandeurEstSup = !!emailSup &&
      emailEmploye === emailSup.toString().trim().toLowerCase();

    const supVide = !emailSup;

    const presInfo = getPresidencePourSup({ departement: service, emailEmploye: emailEmploye });
    const supEstPresident = !!emailSup && (presInfo.emails || []).some(e =>
      e.toString().trim().toLowerCase() === emailSup.toString().trim().toLowerCase());

    // Demandeur = membre de la présidence (président OU vice-présidente,
    // quel que soit le département choisi) : un subordonné ne valide pas
    // la demande de la présidence - niveau Supérieur sauté, la demande
    // part directement chez le président croisé (cf. presidentCroise).
    const presidentsCfg = ((CONFIG.PERSONNEL || {}).presidents) || {};
    const demandeurEstPresident = Object.values(presidentsCfg).some(p =>
      ((p && p.email) || '').toString().trim().toLowerCase() === emailEmploye);

    if (demandeurEstPresident) {
      log('INFO', 'onFormSubmit',
        `Demandeur "${emailEmploye}" = membre de la présidence - ` +
        `niveau Supérieur sauté, envoi direct en validation croisée, ligne ${row}`);
    } else if (demandeurEstSup) {
      log('INFO', 'onFormSubmit',
        `Demandeur "${emailEmploye}" = supérieur du service "${service}" - ` +
        `niveau Supérieur sauté, envoi direct à la Présidence, ligne ${row}`);
    } else if (supVide && workflow !== 'PRES') {
      log('WARN', 'onFormSubmit',
        `Email du supérieur vide pour le service "${service}" (congé ou ` +
        `Config.gs incomplet) - niveau Supérieur validé par défaut, ` +
        `envoi direct à la Présidence, ligne ${row}`);
    } else if (supEstPresident) {
      log('INFO', 'onFormSubmit',
        `Supérieur du service "${service}" = président du périmètre ` +
        `("${emailSup}") - niveau Supérieur sauté, envoi direct en ` +
        `validation finale, ligne ${row}`);
    }

    let premierNiveau;
    if (workflow === 'PRES' || demandeurEstSup || supVide ||
        supEstPresident || demandeurEstPresident) {
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  'Approuvé');
      ecrireColonne(sheet, row, CONFIG.COL.TOKEN_SUP, 'INVALIDE_' + tokenSup);
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      premierNiveau = 'Presidence';
    } else {
      // SUP_PRES - circuit complet (défaut)
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_SUP,  'En attente');
      ecrireColonne(sheet, row, CONFIG.COL.AVIS_PRES, 'En attente');
      premierNiveau = 'Superieur';
    }
    ecrireColonne(sheet, row, CONFIG.COL.STATUT_GLOBAL, 'En cours');

    // Protection par ligne : seul le validateur de CETTE demande peut
    // éditer sa cellule d'avis (P = sup du département, Q = président)
    appliquerProtectionsLigne(sheet, row);

    // ----------------------------------------------------------
    // 6. Notifier le premier validateur
    // ----------------------------------------------------------
    const demande = Object.assign(lireDemande(sheet, row), { emailSuperieur: emailSup });
    const tokenPremier = { Superieur: tokenSup, Presidence: tokenPres }[premierNiveau];
    envoyerNotificationValidateur(demande, premierNiveau, tokenPremier);
    log('INFO', 'onFormSubmit',
      `Workflow "${workflow}" - premier validateur notifié : ${premierNiveau}`);

    // ----------------------------------------------------------
    // 7. Accusé de réception à l'employé
    // ----------------------------------------------------------
    envoyerAccuseReceptionEmploye(demande);

    log('OK', 'onFormSubmit',
      `Demande ${idDemande} initialisée avec succès - ligne ${row}`);

  } catch (err) {
    log('ERREUR', 'onFormSubmit', `${err.toString()} | Stack: ${err.stack}`);
  }
}


// ============================================================
// onEdit (simple) - Bloque toute re-modification après décision.
// ============================================================
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.ONGLET_REPONSES) return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row < 2) return;

  const colsSurveillees = [CONFIG.COL.AVIS_SUP, CONFIG.COL.AVIS_PRES];
  if (!colsSurveillees.includes(col)) return;

  const ancienneValeur = (e.oldValue !== undefined ? e.oldValue : '').toString();
  const statutGlobal   = sheet.getRange(row, CONFIG.COL.STATUT_GLOBAL).getValue().toString();

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
