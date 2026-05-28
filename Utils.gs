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
  const prefixe = `MSK-${annee}-`;
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
  const r = sheet.getRange(row, 1, 1, CONFIG.COL.DRIVE_DOC).getValues()[0];

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
    service:        (r[CONFIG.COL.SERVICE - 1] || '').toString().trim(),
    typePerm:       r[CONFIG.COL.TYPE_PERM     - 1] || '',
    typeAbsence:    r[CONFIG.COL.TYPE_ABSENCE  - 1] || '',
    motifLong:      r[CONFIG.COL.MOTIF_LONG    - 1] || '',
    nbJours:        r[CONFIG.COL.NB_JOURS      - 1] || '',
    dateDebutRaw,
    heureDebutRaw,
    dateFinRaw,
    heureFinRaw,
    dateDebut:      dateDebutRaw  ? formatDate(dateDebutRaw)   : '',
    heureDebut:     heureDebutRaw ? formatHeure(heureDebutRaw) : '',
    dateFin:        dateFinRaw    ? formatDate(dateFinRaw)     : '',
    heureFin:       heureFinRaw   ? formatHeure(heureFinRaw)   : '',
    dateDebutOrd:   r[CONFIG.COL.DATE_DEBUT_ORD - 1] ? formatDate(r[CONFIG.COL.DATE_DEBUT_ORD - 1]) : '',
    dateFinOrd:     r[CONFIG.COL.DATE_FIN_ORD   - 1] ? formatDate(r[CONFIG.COL.DATE_FIN_ORD   - 1]) : '',
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
    nomOrg: ((CONFIG.SERVICE_SUP_MAP || {})[(r[CONFIG.COL.SERVICE - 1] || '').toString().trim()] || {}).nomOrg || CONFIG.NOM_ORG
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

function getNomSuperieur(email) {
  return CONFIG.SUP_NOMS[email] || email;
}

/**
 * Retourne la Présidence compétente pour un superviseur donné.
 * Retourne un objet { emails: [], noms: [] }.
 */
function getPresidencePourSup(emailSup, nomOrg) {
  const map = CONFIG.PRESIDENCE_MAP || {};
  // 1. Override par email du superviseur
  if (emailSup && map[emailSup] && map[emailSup].emails) return map[emailSup];
  // 2. Fallback par organisation
  if (nomOrg && map[nomOrg] && map[nomOrg].emails) return map[nomOrg];
  // 3. Défaut global
  return {
    emails: CONFIG.EMAILS_PRESIDENCE || [],
    noms:   CONFIG.NOMS_PRESIDENCE   || []
  };
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
  if (!demande.dateDebutRaw || !demande.dateFinRaw) {
    return demande.nbJours ? `${demande.nbJours} jour(s)` : 'N/A';
  }

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

  if (diffJours < 0) {
    return demande.nbJours ? `${demande.nbJours} jour(s)` : 'N/A';
  }

  if (diffJours === 0) {
    const t1 = demande.heureDebutRaw ? extractTime(demande.heureDebutRaw) : { h: 0, m: 0 };
    const t2 = demande.heureFinRaw   ? extractTime(demande.heureFinRaw)   : { h: 0, m: 0 };
    const diffMin = (t2.h * 60 + t2.m) - (t1.h * 60 + t1.m);
    if (diffMin <= 0) return demande.nbJours ? `${demande.nbJours} jour(s)` : 'N/A';
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
  } else {
    const jours = diffJours + 1;
    return `${jours} jour${jours > 1 ? 's' : ''}`;
  }
}
