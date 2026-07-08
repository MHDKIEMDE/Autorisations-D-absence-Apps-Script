// ============================================================
// DriveManager.gs — Gestion Google Drive
// ============================================================
// Structure des dossiers Drive :
//   Racine/
//     Accepté/
//       [Nom Prenom]/               ← dossier de la personne (réutilisé)
//         [ABT-2026-0001 - Nom Prenom].pdf ← PDF figé de la demande
//
//   Archive ADMIN (DRIVE_DOSSIER_ARCHIVE)/
//     [ABT-2026-0001 - Nom Prenom].pdf ← copie PDF, accès admins uniquement
//
// Cycle de vie d'une demande approuvée :
//   1. creerDossierEtDoc()  → copie le template en Google Doc et le remplit
//   2. mettreAJourDoc()     → inscrit les avis / dates dans le Doc
//   3. (email de confirmation joint le PDF généré à la volée)
//   4. finaliserEnPDF()     → convertit le Doc en PDF, archive une copie
//                             pour les admins, puis SUPPRIME le Doc.
// ============================================================

// Utilitaire : retourne le sous-dossier par nom exact, le crée si absent
function getOuCreerSousDossier(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

// Utilitaire : retourne le sous-dossier par nom insensible à la casse, le crée si absent
function getOuCreerSousDossierInsensible(parent, nom) {
  const nomLower = nom.toLowerCase();
  const it = parent.getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (f.getName().toLowerCase() === nomLower) return f;
  }
  return parent.createFolder(nom);
}


function creerDossierEtDoc(demande) {
  log('INFO', 'DriveManager', `Creation dossier/doc pour ${demande.idDemande}`);

  const dossierRacine   = DriveApp.getFolderById(CONFIG.DRIVE_DOSSIER_RACINE);
  const dossierAccepte  = getOuCreerSousDossier(dossierRacine, 'Accepté');

  // Chercher ou créer le dossier de la personne (insensible à la casse)
  const dossierPersonne = getOuCreerSousDossierInsensible(dossierAccepte, demande.nomComplet);
  log('INFO', 'DriveManager', `Dossier personne : ${dossierPersonne.getId()} - ${demande.nomComplet}`);

  // Copier le template directement dans le dossier de la personne
  const dossierTemplate = DriveApp.getFolderById(CONFIG.DRIVE_DOSSIER_TEMPLATE);
  const templateIt      = dossierTemplate.getFiles();

  if (!templateIt.hasNext()) {
    throw new Error(
      'Aucun template trouve dans DRIVE_DOSSIER_TEMPLATE. ' +
      'Verifiez que le dossier contient un fichier Google Doc.'
    );
  }

  // Sélectionner le premier fichier et avertir s'il y en a plusieurs
  const templateFichier = templateIt.next();
  if (templateIt.hasNext()) {
    log('WARN', 'DriveManager',
      `DRIVE_DOSSIER_TEMPLATE contient plusieurs fichiers — ` +
      `seul "${templateFichier.getName()}" est utilisé. ` +
      `Supprimez les autres fichiers du dossier template pour éviter toute confusion.`);
  }

  const nomDoc   = `${demande.idDemande} - ${demande.nomComplet}`;
  const docCopie = templateFichier.makeCopy(nomDoc, dossierPersonne);
  log('INFO', 'DriveManager', `Doc cree : ${docCopie.getId()} | type: ${docCopie.getMimeType()} | pour ${demande.idDemande}`);

  // Remplir le template
  remplirTemplate(docCopie.getId(), demande);

  return {
    dossierID: dossierPersonne.getId(),
    docID:     docCopie.getId()
  };
}


function remplirTemplate(docId, demande) {
  // Drive peut mettre plusieurs secondes a propager un nouveau fichier apres makeCopy()
  // On attend d'abord que DriveApp voie le fichier, puis on ouvre avec DocumentApp
  // Délai croissant : 2s, 3s, 4s, 5s, 6s entre chaque tentative = ~40s max
  let doc;
  for (let tentative = 1; tentative <= 6; tentative++) {
    try {
      DriveApp.getFileById(docId); // échoue vite si le fichier n'est pas encore indexé
      doc = DocumentApp.openById(docId);
      break;
    } catch (e) {
      if (tentative === 6) throw e;
      log('WARN', 'DriveManager', `Propagation Drive en attente (tentative ${tentative}/6) pour ${docId}`);
      Utilities.sleep((tentative + 1) * 1000);
    }
  }
  const body = doc.getBody();

  const remplacements = {
    '{{ID_DEMANDE}}':      demande.idDemande        || '',
    '{{NOM}}':             demande.nom               || '',
    '{{PRENOM}}':          demande.prenom            || '',
    '{{SERVICE}}':         demande.departement       || '',
    '{{TYPE_ABSENCE}}':    demande.typeAbsence       || '',
    '{{MOTIF_EXCEPTIONNEL}}': libelleMotif(demande),
    '{{DATE_DEBUT}}':      demande.dateDebut         || '',
    '{{HEURE_DEBUT}}':     demande.heureDebut        || '',
    '{{DATE_FIN}}':        demande.dateFin           || '',
    '{{HEURE_FIN}}':       demande.heureFin          || '',
    '{{NB_JOURS_EXCEPTIONNEL}}': calculerDuree(demande),
    '{{DATE_SOUMISSION}}': formatDateHeure(new Date())
  };

  Object.entries(remplacements).forEach(([balise, valeur]) => {
    body.replaceText(balise, valeur);
  });

  doc.saveAndClose();
  log('OK', 'DriveManager', `Template rempli pour ${demande.idDemande}`);
}


function mettreAJourDoc(demande) {
  if (!demande.driveDocID) {
    log('WARN', 'DriveManager', `mettreAJourDoc : pas de driveDocID pour ${demande.idDemande}`);
    return;
  }

  try {
    const doc  = DocumentApp.openById(demande.driveDocID);
    const body = doc.getBody();

    body.replaceText('{{AVIS_SUPERIEUR}}',  demande.avisSuperieur || 'En attente');
    body.replaceText('{{AVIS_PRESIDENCE}}', demande.avisPres      || '—');
    body.replaceText('{{COMMENTAIRE}}',     demande.commentaire   || '');

    if (demande.dateCloture) {
      body.replaceText('{{DATE_CLOTURE}}', formatDateHeure(new Date(demande.dateCloture)));
    }

    doc.saveAndClose();
    log('OK', 'DriveManager', `Doc mis a jour pour ${demande.idDemande}`);
  } catch (e) {
    log('WARN', 'DriveManager', `Impossible de mettre a jour le doc ${demande.driveDocID} : ${e}`);
  }
}


// ============================================================
// finaliserEnPDF(sheet, row, demande)
// ------------------------------------------------------------
// Étape FINALE d'une demande approuvée. À appeler APRÈS
// mettreAJourDoc() et APRÈS l'envoi de l'email de confirmation
// (l'email joint encore le PDF généré depuis le Doc).
//
//   1. Convertit le Google Doc rempli en PDF dans le dossier
//      de la personne (dossier racine, classé par nom).
//   2. Dépose une COPIE du PDF dans le dossier d'archive ADMIN
//      (DRIVE_DOSSIER_ARCHIVE), accessible aux seuls admins.
//   3. SUPPRIME le Google Doc original (plus besoin d'éditer).
//   4. Met à jour la colonne DRIVE_DOC pour pointer vers le PDF.
//
// Tolérante aux erreurs : en cas d'échec, on log et on conserve
// le Doc (rien n'est supprimé) pour permettre une reprise.
// ============================================================
function finaliserEnPDF(sheet, row, demande) {
  if (!demande.driveDocID) {
    log('WARN', 'DriveManager', `finaliserEnPDF : pas de driveDocID pour ${demande.idDemande}`);
    return;
  }

  try {
    const doc            = DriveApp.getFileById(demande.driveDocID);
    const nomPdf         = `${demande.idDemande} - ${demande.nomComplet}.pdf`;
    const blobPdf        = doc.getAs('application/pdf').setName(nomPdf);

    // 1. PDF dans le dossier de la personne (dossier racine par nom)
    const dossierPersonne = DriveApp.getFolderById(demande.driveDossierID);
    const pdfPersonne     = dossierPersonne.createFile(blobPdf);
    log('OK', 'DriveManager', `PDF cree (dossier personne) : ${pdfPersonne.getId()} pour ${demande.idDemande}`);

    // 2. Copie PDF dans l'archive admin (si configurée)
    const idArchive = CONFIG.DRIVE_DOSSIER_ARCHIVE;
    if (idArchive && idArchive !== 'REMPLACER_PAR_ID_DOSSIER_ARCHIVE') {
      try {
        const dossierArchive = DriveApp.getFolderById(idArchive);
        dossierArchive.createFile(blobPdf);
        log('OK', 'DriveManager', `PDF archive (admin) pour ${demande.idDemande}`);
      } catch (eArch) {
        log('WARN', 'DriveManager',
          `Impossible d'archiver le PDF dans DRIVE_DOSSIER_ARCHIVE pour ${demande.idDemande} : ${eArch}`);
      }
    } else {
      log('WARN', 'DriveManager',
        `DRIVE_DOSSIER_ARCHIVE non configuré — pas de copie archive pour ${demande.idDemande}`);
    }

    // 3. Supprimer le Google Doc original (corbeille)
    doc.setTrashed(true);
    log('OK', 'DriveManager', `Doc original supprime pour ${demande.idDemande}`);

    // 4. La colonne DRIVE_DOC pointe désormais vers le PDF
    ecrireColonneLien(sheet, row, CONFIG.COL.DRIVE_DOC, pdfPersonne.getId(),
      `https://drive.google.com/file/d/${pdfPersonne.getId()}/view`);

  } catch (e) {
    log('WARN', 'DriveManager',
      `finaliserEnPDF a échoué pour ${demande.idDemande} (Doc conservé) : ${e}`);
  }
}


// Deplace le dossier de la demande vers le sous-dossier statut dans la racine
// statut : 'Accepté' | 'Rejeté'
function deplacerVersDossierStatut(dossierDemandeId, statut) {
  const dossierRacine  = DriveApp.getFolderById(CONFIG.DRIVE_DOSSIER_RACINE);
  const dossierDemande = DriveApp.getFolderById(dossierDemandeId);
  const dossierCible   = getOuCreerSousDossier(dossierRacine, statut);

  // Ajouter dans le dossier cible
  dossierCible.addFolder(dossierDemande);

  // Retirer de l'ancien parent (En attente)
  const parents = dossierDemande.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getId() !== dossierCible.getId()) {
      parent.removeFolder(dossierDemande);
    }
  }

  log('OK', 'DriveManager', `Dossier ${dossierDemandeId} deplace vers "${statut}"`);
}
