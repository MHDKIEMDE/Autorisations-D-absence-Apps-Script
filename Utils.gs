// ============================================================
// Utils.gs — Fonctions utilitaires partagées
// ============================================================

function log(niveau, contexte, message) {
  const ts  = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Dakar' });
  Logger.log(`[${niveau}][${contexte}] ${message} — ${ts}`);
}

function genererUUID() {
  return Utilities.getUuid();
}

function genererIdDemande(sheet) {
  const annee   = new Date().getFullYear();
  const prefixe = `ABT-${annee}-`;
  const lastRow = sheet.getLastRow();
  let maxNumero = 0;

  if (lastRow > 1) {
    const vals = sheet.getRange(2, CONFIG.COL.ID_DEMANDE, lastRow - 1, 1).getValues();
    vals.forEach(([val]) => {
      if (val && typeof val === 'string' && val.startsWith(prefixe)) {
        const num = parseInt(val.slice(prefixe.length), 10);
        if (!isNaN(num) && num > maxNumero) maxNumero = num;
      }
    });
  }

  return `${prefixe}${String(maxNumero + 1).padStart(4, '0')}`;
}

function getSheetReponses() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_REPONSES_ID);
  if (!ss) throw new Error(
    '[getSheetReponses] Spreadsheet introuvable. ' +
    'Vérifie CONFIG.SHEET_REPONSES_ID dans Config.gs. ' +
    'Valeur actuelle : "' + CONFIG.SHEET_REPONSES_ID + '"'
  );

  const sheet = ss.getSheetByName(CONFIG.ONGLET_REPONSES);
  if (!sheet) throw new Error(
    '[getSheetReponses] Onglet introuvable : "' + CONFIG.ONGLET_REPONSES + '". ' +
    'Onglets disponibles : ' + ss.getSheets().map(s => s.getName()).join(', ')
  );

  return sheet;
}

function lireDemande(sheet, row) {
  const r = sheet.getRange(row, 1, 1, CONFIG.COL.NB_PRECISIONS).getValues()[0];

  const dateDebutRaw  = r[CONFIG.COL.DATE_DEBUT  - 1];
  const heureDebutRaw = r[CONFIG.COL.HEURE_DEBUT - 1];
  const dateFinRaw    = r[CONFIG.COL.DATE_FIN    - 1];
  const heureFinRaw   = r[CONFIG.COL.HEURE_FIN   - 1];

  return {
    idDemande:      r[CONFIG.COL.ID_DEMANDE    - 1] || '',
    emailEmploye:   r[CONFIG.COL.EMAIL_EMPLOYE - 1] || '',
    nom:            r[CONFIG.COL.NOM           - 1] || '',
    prenom:         r[CONFIG.COL.PRENOM        - 1] || '',
    nomComplet:     `${r[CONFIG.COL.NOM - 1] || ''} ${r[CONFIG.COL.PRENOM - 1] || ''}`.trim(),
    departement:    (r[CONFIG.COL.DEPARTEMENT   - 1] || '').toString().trim(),
    typeAbsence:    r[CONFIG.COL.TYPE_ABSENCE   - 1] || '',
    famille:        r[CONFIG.COL.FAMILLE        - 1] || '',
    motifUrgence:   r[CONFIG.COL.MOTIF_URGENCE  - 1] || '',
    motif:          r[CONFIG.COL.MOTIF          - 1] || '',
    dateDebutRaw,
    heureDebutRaw,
    dateFinRaw,
    heureFinRaw,
    dateDebut:      dateDebutRaw  ? formatDate(dateDebutRaw)   : '',
    heureDebut:     heureDebutRaw ? formatHeure(heureDebutRaw) : '',
    dateFin:        dateFinRaw    ? formatDate(dateFinRaw)     : '',
    heureFin:       heureFinRaw   ? formatHeure(heureFinRaw)   : '',
    emailSuperieur: r[CONFIG.COL.EMAIL_SUP      - 1] || '',
    avisSuperieur:  r[CONFIG.COL.AVIS_SUP       - 1] || '',
    avisPres:       r[CONFIG.COL.AVIS_PRES      - 1] || '',
    commentaire:    r[CONFIG.COL.COMMENTAIRE    - 1] || '',
    tokenSup:       r[CONFIG.COL.TOKEN_SUP      - 1] || '',
    tokenPres:      r[CONFIG.COL.TOKEN_PRES     - 1] || '',
    statutGlobal:   r[CONFIG.COL.STATUT_GLOBAL  - 1] || '',
    dateCloture:    r[CONFIG.COL.DATE_CLOTURE   - 1] || null,
    driveDossierID: r[CONFIG.COL.DRIVE_DOSSIER  - 1] || '',
    driveDocID:     r[CONFIG.COL.DRIVE_DOC      - 1] || '',
    tokenPrecision:  r[CONFIG.COL.TOKEN_PRECISION  - 1] || '',
    niveauPrecision: r[CONFIG.COL.NIVEAU_PRECISION - 1] || '',
    nbPrecisions:    Number(r[CONFIG.COL.NB_PRECISIONS - 1]) || 0,
    nomOrg: ((CONFIG.SERVICE_SUP_MAP || {})[(r[CONFIG.COL.DEPARTEMENT - 1] || '').toString().trim()] || {}).nomOrg || CONFIG.NOM_ORG
  };
}

function trouverLigneParToken(token) {
  return trouverLigneParTokenOptimise(token);
}

function trouverLigneParTokenOptimise(token) {
  if (!token) return null;

  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const niveaux = [
    { col: CONFIG.COL.TOKEN_SUP,  niveau: 'Superieur'  },
    { col: CONFIG.COL.TOKEN_PRES, niveau: 'Presidence' }
  ];

  for (const { col, niveau } of niveaux) {
    const vals = sheet.getRange(2, col, lastRow - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) {
      let valCell   = (vals[i][0] || '').toString();
      let tokenBrut = valCell;
      if (tokenBrut.startsWith('UTILISE_'))  tokenBrut = tokenBrut.slice(8);
      if (tokenBrut.startsWith('INVALIDE_')) tokenBrut = tokenBrut.slice(9);
      if (tokenBrut === token) {
        return { row: i + 2, niveau, utilise: valCell !== token };
      }
    }
  }

  return null;
}

/**
 * Cherche une demande par son TOKEN DE PRÉCISION (colonne TOKEN_PRECISION).
 * Ce token est porté par le lien de réponse envoyé à l'employé quand un
 * validateur demande des précisions.
 *
 * @return {Object|null} { row, utilise } ou null si introuvable.
 *   utilise = true si le token a déjà été consommé (préfixe UTILISE_).
 */
function trouverLigneParTokenPrecision(token) {
  if (!token) return null;

  const sheet   = getSheetReponses();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const vals = sheet.getRange(2, CONFIG.COL.TOKEN_PRECISION, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    const valCell = (vals[i][0] || '').toString();
    let tokenBrut = valCell;
    if (tokenBrut.startsWith('UTILISE_'))  tokenBrut = tokenBrut.slice(8);
    if (tokenBrut.startsWith('INVALIDE_')) tokenBrut = tokenBrut.slice(9);
    if (tokenBrut && tokenBrut === token) {
      return { row: i + 2, utilise: valCell !== token };
    }
  }

  return null;
}

/**
 * Retourne le nom affiché d'un supérieur à partir de son email.
 * Cherche dans PERSONNEL.superieurs (valeurs, pas clés).
 */
function getNomSuperieur(email) {
  const sups = (CONFIG.PERSONNEL || {}).superieurs || {};
  const found = Object.values(sups).find(s => s.email === email);
  return found ? found.nom : (email || '');
}

/**
 * Résout l'email d'un supérieur à partir de la clé SERVICE_SUP_MAP.sup.
 * La clé sup est un identifiant interne (ex: 'SUP_EDITORIAL'), pas un email.
 */
function getEmailSuperieur(supKey) {
  if (!supKey) return '';
  const sups = (CONFIG.PERSONNEL || {}).superieurs || {};
  return (sups[supKey] || {}).email || '';
}

/**
 * Retourne LE président (unique) pour une demande, sous forme
 *   { emails: [unSeul], noms: [unSeul] } — un tableau d'un seul
 *   élément pour rester compatible avec les appelants existants.
 *
 * Résolution PAR DÉPARTEMENT :
 *   SERVICE_SUP_MAP[département].presidence → clé président
 *   → CONFIG.PERSONNEL.presidents[clé]
 *
 * Fallback : PERSONNEL.presidents.PRES_GENERAL si le département
 * ne pointe vers aucun président valide.
 *
 * @param {Object} demande  Objet renvoyé par lireDemande (utilise .departement)
 */
function getPresidencePourSup(demande) {
  const departement = (demande && demande.departement) || '';
  const serviceConf = (CONFIG.SERVICE_SUP_MAP || {})[departement] || {};
  const presidents  = (CONFIG.PERSONNEL || {}).presidents || {};

  // Clé du président normalement compétent pour ce département
  let cle = serviceConf.presidence && presidents[serviceConf.presidence]
    ? serviceConf.presidence
    : 'PRES_GENERAL';

  // Contrôle croisé : si le demandeur EST ce président, il ne peut pas
  // s'auto-valider — on bascule vers le président croisé (cf. Config.gs).
  const emailDemandeur = (demande && demande.emailEmploye || '')
    .toString().trim().toLowerCase();
  const emailPresNormal = ((presidents[cle] || {}).email || '')
    .toString().trim().toLowerCase();

  if (emailDemandeur && emailDemandeur === emailPresNormal) {
    const croise = ((CONFIG.PERSONNEL || {}).presidentCroise || {})[cle];
    if (croise && presidents[croise] && presidents[croise].email) {
      log('INFO', 'getPresidencePourSup',
        `Demandeur "${emailDemandeur}" = président "${cle}" — ` +
        `contrôle croisé, validation confiée à "${croise}"`);
      cle = croise;
    } else {
      log('WARN', 'getPresidencePourSup',
        `Président "${cle}" demande une absence mais aucun président ` +
        `croisé valide n'est configuré — il resterait son propre validateur.`);
    }
  }

  let pres = presidents[cle] || null;

  if (!pres || !pres.email) {
    pres = presidents.PRES_GENERAL || null;
    if (serviceConf.presidence) {
      log('WARN', 'getPresidencePourSup',
        `Président "${serviceConf.presidence}" introuvable pour ` +
        `département "${departement}" — fallback PRES_GENERAL`);
    }
  }

  return {
    emails: pres && pres.email ? [pres.email] : [],
    noms:   pres && pres.nom   ? [pres.nom]   : []
  };
}

/**
 * ⚠️ INACTIVE — conservée pour un éventuel retour au contrôle d'identité.
 * Le système sécurise désormais par TOKEN uniquement (déploiement
 * "Execute as: Me" + comptes mixtes). Voir doGet() dans WebApp.gs.
 *
 * Retourne la liste des emails AUTORISÉS à agir à un niveau donné pour
 * une demande précise.
 *   Superieur  → l'email du supérieur de CE département
 *   Presidence → le président (croisé si le demandeur est président)
 *
 * @return {string[]} emails en minuscules, sans doublon.
 */
function emailsAutorisesPourNiveau(demande, niveau) {
  let emails = [];
  if (niveau === 'Superieur') {
    if (demande.emailSuperieur) emails = [demande.emailSuperieur];
  } else if (niveau === 'Presidence') {
    emails = (getPresidencePourSup(demande).emails) || [];
  }
  return emails
    .map(e => (e || '').toString().trim().toLowerCase())
    .filter(Boolean)
    .filter((e, i, arr) => arr.indexOf(e) === i);
}

/**
 * Vérifie que l'utilisateur Google connecté est bien habilité à agir
 * sur cette demande, à ce niveau (ou, pour l'employé, qu'il est bien
 * le demandeur).
 *
 * ⚠️ Nécessite un déploiement web app en "Anyone with Google account",
 * sinon Session.getActiveUser().getEmail() renvoie une chaîne vide.
 *
 * @param {string[]} emailsAutorises  Emails légitimes (déjà en minuscules).
 * @return {Object} { ok: boolean, emailConnecte: string }
 */
function controlerIdentite(emailsAutorises) {
  let emailConnecte = '';
  try {
    emailConnecte = (Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (e) {
    emailConnecte = '';
  }
  const ok = !!emailConnecte && emailsAutorises.indexOf(emailConnecte) !== -1;
  return { ok, emailConnecte };
}

function formatDateHeure(date) {
  if (!date) return '—';
  try {
    const str = new Date(date).toLocaleDateString('fr-FR', {
      timeZone: 'Africa/Dakar',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return str.replace(/(\d{2}):(\d{2})$/, '$1h$2');
  } catch (e) { return String(date); }
}

function formatDate(date) {
  if (!date) return '';
  try {
    return new Date(date).toLocaleDateString('fr-FR', {
      timeZone: 'Africa/Dakar',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  } catch (e) { return String(date); }
}

function formatHeure(heure) {
  if (!heure) return '';
  try {
    const d = new Date(heure);
    return `${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
  } catch (e) { return String(heure); }
}

/**
 * Compare un libellé de formulaire à un type de base de façon
 * TOLÉRANTE : insensible à la casse/espaces et indépendante d'un
 * éventuel suffixe entre parenthèses.
 *
 * Permet de renommer une option du formulaire (ex:
 * "Urgence (sans délai — traitement immédiat)") sans casser la
 * logique qui repose sur le type de base ("Urgence").
 *
 *   estType("Urgence (sans délai…)", "Urgence")  → true
 *   estType("  urgence ",            "Urgence")  → true
 *   estType("Urgences",              "Urgence")  → false
 *
 * @param {string} valeur  Valeur lue dans le Sheet / le formulaire
 * @param {string} base    Type de base attendu (ex: "Urgence")
 */
function estType(valeur, base) {
  if (!valeur || !base) return false;
  // On retire un éventuel suffixe entre parenthèses, puis on normalise
  const v = valeur.toString().replace(/\s*\(.*$/, '').trim().toLowerCase();
  return v === base.toString().trim().toLowerCase();
}

/**
 * Construit le libellé "Motif / Absence" affiché aux validateurs.
 * Source unique de vérité — utilisée par les emails (Notifications.gs)
 * ET par la page web de validation (WebApp.gs), pour éviter toute
 * divergence d'affichage.
 *
 *   Famille  → sous-type famille (ou "Famille — <motif>" si "Autre")
 *   Urgence  → "Urgence — <motif d'urgence>"
 *   Autre    → motif libre
 *   sinon    → le type d'absence tel quel
 */
function libelleMotif(demande) {
  if (estType(demande.typeAbsence, 'Famille')) {
    return estType(demande.famille, 'Autre')
      ? `Famille — ${demande.motif || '—'}`
      : (demande.famille || 'Famille');
  }
  if (estType(demande.typeAbsence, 'Urgence')) {
    return demande.motifUrgence ? `Urgence — ${demande.motifUrgence}` : 'Urgence';
  }
  if (estType(demande.typeAbsence, 'Autre')) {
    return demande.motif || '—';
  }
  return demande.typeAbsence || '—';
}

function ecrireColonne(sheet, row, colIndex, valeur) {
  sheet.getRange(row, colIndex).setValue(valeur);
}

function ecrireColonneLien(sheet, row, colIndex, id, url) {
  const richText = SpreadsheetApp.newRichTextValue()
    .setText(id)
    .setLinkUrl(url)
    .build();
  sheet.getRange(row, colIndex).setRichTextValue(richText);
}

function heuresAvant(dateDebut) {
  return (new Date(dateDebut) - new Date()) / (1000 * 60 * 60);
}

/**
 * Compte le nombre de jours ouvrables entre maintenant et dateDebut.
 */
function joursOuvrables(dateDebut) {
  const maintenant = new Date();
  const fin        = new Date(dateDebut);

  if (fin <= maintenant) return 0;

  const feriesSet = new Set(CONFIG.JOURS_FERIES || []);
  let jours = 0;

  const cursor = new Date(maintenant);
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= fin) {
    const jour    = cursor.getDay();
    const dateStr = Utilities.formatDate(cursor, 'Africa/Dakar', 'yyyy-MM-dd');

    if (jour !== 0 && jour !== 6 && !feriesSet.has(dateStr)) {
      jours++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return jours;
}

function calculerDuree(demande) {
  if (!demande.dateDebutRaw || !demande.dateFinRaw) return 'N/A';

  function extractTime(raw) {
    const d = new Date(raw);
    return { h: isNaN(d) ? 0 : d.getHours(), m: isNaN(d) ? 0 : d.getMinutes() };
  }

  const debut = new Date(demande.dateDebutRaw);
  const fin   = new Date(demande.dateFinRaw);
  if (isNaN(debut) || isNaN(fin)) return 'N/A';

  const dDebut = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate());
  const dFin   = new Date(fin.getFullYear(),   fin.getMonth(),   fin.getDate());
  const diffJours = Math.round((dFin - dDebut) / 86400000);

  if (diffJours < 0) return 'N/A';

  if (diffJours === 0) {
    const t1 = demande.heureDebutRaw ? extractTime(demande.heureDebutRaw) : { h: 0, m: 0 };
    const t2 = demande.heureFinRaw   ? extractTime(demande.heureFinRaw)   : { h: 0, m: 0 };
    const diffMin = (t2.h * 60 + t2.m) - (t1.h * 60 + t1.m);
    if (diffMin <= 0) return 'N/A';
    // Journée standard 08h00–17h00 : 8h de travail effectif (1h de pause
    // déjeuner incluse dans la plage) — ne pas afficher "9h".
    if (t1.h === 8 && t1.m === 0 && t2.h === 17 && t2.m === 0) {
      return '1 jour (8h)';
    }
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  } else {
    const jours = diffJours + 1;
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }
}


// ============================================================
// Protection PAR LIGNE des cellules d'avis (colonnes P / Q)
//
// La protection par colonne ne suffit pas : n'importe quel supérieur
// de la liste pourrait éditer la colonne P d'une demande d'un autre
// service. On protège donc chaque cellule d'avis individuellement,
// avec pour seul éditeur LE validateur attendu de CETTE demande :
//   P → le supérieur résolu du département (col O)
//   Q → le président du périmètre (croisé si le demandeur est président)
//
// Les emails CONFIG.ADMINS sont toujours ajoutés (maintenance), et le
// propriétaire du Sheet garde l'accès (comportement natif Google).
// Une liste d'éditeurs vide = cellule verrouillée pour tout le monde.
// ============================================================

/**
 * Supprime la ou les protections posées exactement sur une cellule.
 */
function supprimerProtectionCellule(sheet, row, col) {
  const a1 = sheet.getRange(row, col).getA1Notation();
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter(p => p.getRange().getA1Notation() === a1)
    .forEach(p => p.remove());
}

/**
 * Pose une protection stricte sur UNE cellule d'avis.
 * @param {string[]} emails  Éditeurs autorisés (vide = verrouillée).
 */
function protegerCelluleAvis(sheet, row, col, emails, description) {
  supprimerProtectionCellule(sheet, row, col);

  const p = sheet.getRange(row, col).protect();
  p.setDescription(description || 'Réservé au validateur de cette demande');
  p.removeEditors(p.getEditors());

  const editeurs = (emails || [])
    .concat(CONFIG.ADMINS || [])
    .map(e => (e || '').toString().trim().toLowerCase())
    .filter(Boolean)
    .filter((e, i, arr) => arr.indexOf(e) === i);

  if (editeurs.length > 0) {
    try {
      p.addEditors(editeurs);
    } catch (err) {
      log('WARN', 'Protections',
        `addEditors(${editeurs.join(', ')}) impossible ligne ${row} : ${err}`);
    }
  }
}

/**
 * (Re)calcule les protections des cellules P et Q d'une ligne selon
 * l'état de la demande. À appeler à la création, après chaque avis
 * intermédiaire et à la clôture. Ne bloque jamais le workflow : toute
 * erreur est seulement journalisée.
 */
function appliquerProtectionsLigne(sheet, row) {
  try {
    const demande = lireDemande(sheet, row);
    if (!demande.idDemande) return;

    // Demande clôturée (ou rejetée automatiquement) → tout verrouiller
    if (demande.statutGlobal && demande.statutGlobal !== 'En cours') {
      protegerCelluleAvis(sheet, row, CONFIG.COL.AVIS_SUP,  [], 'Demande clôturée — réservé au script');
      protegerCelluleAvis(sheet, row, CONFIG.COL.AVIS_PRES, [], 'Demande clôturée — réservé au script');
      return;
    }

    // P — niveau Supérieur : éditable par le sup de CETTE ligne tant
    // que son avis est attendu ; verrouillé sinon (sauté ou déjà donné)
    const supActif = ['En attente', 'En attente de précisions']
      .includes((demande.avisSuperieur || '').toString());
    protegerCelluleAvis(
      sheet, row, CONFIG.COL.AVIS_SUP,
      supActif && demande.emailSuperieur ? [demande.emailSuperieur] : [],
      supActif ? 'Réservé : supérieur de cette demande' : 'Niveau Supérieur déjà traité'
    );

    // Q — niveau Présidence : le président compétent pour cette demande
    const pres = getPresidencePourSup(demande);
    protegerCelluleAvis(sheet, row, CONFIG.COL.AVIS_PRES, pres.emails,
      'Réservé : présidence de cette demande');

  } catch (err) {
    log('WARN', 'Protections',
      `appliquerProtectionsLigne ligne ${row} : ${err}`);
  }
}
