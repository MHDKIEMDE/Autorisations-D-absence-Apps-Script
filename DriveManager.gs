// ============================================================
// DriveManager.gs — Gestion Google Drive
// ============================================================
// Structure des dossiers Drive :
//   Racine/
//     Accepté/
//       [MSK-2026-0001 - Nom Prenom]/  ← dossier de la demande
//         [MSK-2026-0001 - Nom Prenom] ← Google Doc
// ============================================================

// Utilitaire : retourne le sous-dossier par nom, le crée si absent
function getOuCreerSousDossier(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}


function creerDossierEtDoc(demande) {
  log('INFO', 'DriveManager', `Creation dossier/doc pour ${demande.idDemande}`);

  const dossierRacine = DriveApp.getFolderById(CONFIG.DRIVE_DOSSIER_RACINE);

  // Dossier de la demande directement dans "Accepté"
  const dossierAccepte = getOuCreerSousDossier(dossierRacine, 'Accepté');
  const nomDossier     = `${demande.idDemande} - ${demande.nomComplet}`;
  const dossierDemande = dossierAccepte.createFolder(nomDossier);
  log('INFO', 'DriveManager', `Dossier cree : ${dossierDemande.getId()} - ${nomDossier}`);

  // Copier le template
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

  const docCopie = templateFichier.makeCopy(
    `${demande.idDemande} - ${demande.nomComplet}`,
    dossierDemande
  );
  log('INFO', 'DriveManager', `Doc cree : ${docCopie.getId()} | type: ${docCopie.getMimeType()} | pour ${demande.idDemande}`);

  // Remplir le template
  remplirTemplate(docCopie.getId(), demande);

  return {
    dossierID: dossierDemande.getId(),
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
    '{{MATRICULE}}':       demande.matricule         || '',
    '{{SERVICE}}':         demande.service           || '',
    '{{TYPE_PERMISSION}}': demande.typePerm          || '',
    '{{TYPE_ABSENCE}}':    demande.typeAbsence  || demande.motifLong  || '',
    '{{DATE_DEBUT}}':      demande.dateDebut         || '',
    '{{HEURE_DEBUT}}':     demande.heureDebut        || '',
    '{{DATE_FIN}}':        demande.dateFin           || '',
    '{{HEURE_FIN}}':       demande.heureFin          || '',
    '{{NB_JOURS}}':           demande.nbJours        ? String(demande.nbJours) : '',
    '{{NB_JOURS_ORDINAIRE}}':    demande.nbJours   ? String(demande.nbJours) : '',
    '{{NB_JOURS_EXCEPTIONNEL}}': calculerDuree(demande),
    '{{MOTIF}}':              demande.motifLong   || demande.typeAbsence || '',
    '{{MOTIF_EXCEPTIONNEL}}': demande.typeAbsence || '',
    '{{MOTIF_ORDINAIRE}}':    demande.motifLong   || '',
    '{{DATE_DEBUT_ORDINAIRE}}': demande.dateDebutOrd || '',
    '{{DATE_FIN_ORDINAIRE}}':   demande.dateFinOrd   || '',
    '{{DATE_SOUMISSION}}':    formatDateHeure(new Date())
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
    body.replaceText('{{AVIS_RH}}',         demande.avisRH        || '—');
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
