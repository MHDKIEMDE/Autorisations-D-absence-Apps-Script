// ============================================================
// WebApp.gs — Interface HTML de validation (doGet)
// ============================================================
// Routes :
//   ?token=XXX                 → formulaire de decision
//   ?token=XXX&action=APPROUVE → approbation directe
//   ?token=XXX&action=REJETE   → rejet avec motif
// ============================================================

function doGet(e) {
  const token  = (e.parameter.token  || '').trim();
  const action = (e.parameter.action || '').trim();
  const motif  = (e.parameter.motif  || '').trim();

  if (!token) {
    return page(pageAccueil(), null);
  }

  // Résoudre le thème depuis le token AVANT traiterDecision
  // (traiterDecision modifie l'état — le token peut ne plus être lisible après)
  let theme = null, nomOrg = CONFIG.NOM_ORG;
  let sheet = null, demande = null;
  const found = trouverLigneParToken(token);
  if (found) {
    sheet   = getSheetReponses();
    demande = lireDemande(sheet, found.row);
    nomOrg  = demande.nomOrg || CONFIG.NOM_ORG;
    theme   = getThemeEmail(nomOrg, demande.emailSuperieur);
  }

  if (action === 'APPROUVE') {
    const res = traiterDecision(token, 'APPROUVE', '');
    if (res.alreadyUsed) return page(pageDejaUtilise(res, nomOrg, theme), theme);
    return page(pageResultat(res, nomOrg, theme), theme);
  }

  if (action === 'REJETE') {
    const res = traiterDecision(token, 'REJETE', motif);
    if (res.alreadyUsed) return page(pageDejaUtilise(res, nomOrg, theme), theme);
    return page(pageResultat(res, nomOrg, theme), theme);
  }

  // Affichage du formulaire de décision
  if (!found) {
    return page(pageDejaUtilise({
      message: "La réponse pour cette demande a déjà été envoyée. Ce lien n'est plus actif."
    }, nomOrg, theme), theme);
  }

  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'RH':         CONFIG.COL.AVIS_RH,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[found.niveau];

  if (sheet.getRange(found.row, colStatut).getValue() !== 'En attente') {
    return page(pageDejaUtilise({
      message: "La réponse pour cette demande a déjà été envoyée à ce niveau. Ce lien n'est plus actif."
    }, nomOrg, theme), theme);
  }

  return page(pageFormulaire(demande, token, found.niveau, nomOrg), theme);
}


function cssCommun(theme) {
  const hBg   = (theme && theme.couleur)            || '#016579';
  const hCol  = (theme && theme.couleurTexte)       || '#ffffff';
  const badge = (theme && theme.couleurBadge)       || '#f8c542';
  const bText = (theme && theme.couleurTexteBadge)  || '#333333';
  const acc   = (theme && theme.couleurAccent)      || '#016579';
  const rej   = (theme && theme.couleurBoutonRejet) || '#dc3545';
  const pol   = (theme && theme.police)             || "'Segoe UI', Arial, sans-serif";

  return `<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${pol}; background: #f4f4f4; color: #333333; min-height: 100vh; }
    .header { background: ${hBg}; color: ${hCol}; padding: 22px 32px; }
    .header h1 { font-size: 21px; font-weight: 900; letter-spacing: .5px; }
    .header .sous-titre { font-size: 13px; opacity: .82; margin-top: 3px; }
    .header .badge-niveau {
      display: inline-block; background: ${badge}; color: ${bText};
      font-size: 12px; font-weight: 700; padding: 3px 14px;
      border-radius: 20px; margin-top: 10px;
    }
    .container { max-width: 640px; margin: 28px auto; padding: 0 16px 56px; }
    .card { background: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.08); padding: 22px 24px; margin-bottom: 18px; }
    .card h2 { font-size: 15px; color: ${acc}; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 14px; }
    .info-row { display: flex; padding: 7px 0; border-bottom: 1px solid #f7f7f7; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .lbl { width: 44%; color: #666666; font-weight: 600; }
    .val { width: 56%; color: #222222; }
    .btn { display: block; width: 100%; padding: 13px; font-size: 15px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; font-family: ${pol}; }
    .btn-ok { background: ${acc}; color: #ffffff; }
    .btn-ko { background: ${rej}; color: #ffffff; }
    textarea { width: 100%; height: 110px; padding: 10px; border: 1px solid #cccccc; border-radius: 5px; font-size: 14px; margin-top: 10px; resize: vertical; font-family: ${pol}; }
    textarea:focus { outline: none; border-color: ${acc}; }
    .zone-rejet { background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 6px; padding: 16px; }
    .alerte-rejet { font-size: 13px; color: #721c24; font-weight: 600; margin-bottom: 4px; }
    .badge-att { display: inline-block; background: #fff3cd; color: #856404; font-size: 12px; font-weight: 700; padding: 3px 12px; border-radius: 12px; margin-bottom: 14px; }
    .result-box { background: #ffffff; border-radius: 8px; padding: 44px 32px; text-align: center; max-width: 480px; margin: 56px auto; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
    .ico { font-size: 54px; margin-bottom: 16px; }
    .result-titre { font-size: 20px; font-weight: 800; margin-bottom: 10px; }
    .result-msg { font-size: 14px; color: #555555; line-height: 1.65; }
    .note-bas { margin-top: 18px; font-size: 12px; color: #aaaaaa; }
    .footer-page { text-align: center; font-size: 11px; color: #aaaaaa; margin-top: 32px; padding-bottom: 16px; }
  </style>`;
}


function pageFormulaire(demande, token, niveau, nomOrg) {
  const org = nomOrg || CONFIG.NOM_ORG;
  const labelNiveau = {
    'Superieur':  'Supérieur hiérarchique',
    'RH':         'Responsable RH',
    'Presidence': 'Présidence'
  }[niveau];

  const motif = demande.typeAbsence || demande.motifLong || '—';
  const duree = calculerDuree(demande);

  return `
    <div class="header">
      <h1>⬡ ${org}</h1>
      <div class="sous-titre">Système de gestion des absences</div>
      <div class="badge-niveau">Niveau : ${labelNiveau}</div>
    </div>
    <div class="container">
      <div class="card">
        <h2>Demande à valider</h2>
        <span class="badge-att">En attente de votre décision</span>
        <div class="info-row"><span class="lbl">Référence</span>          <span class="val"><strong>${demande.idDemande}</strong></span></div>
        <div class="info-row"><span class="lbl">Employé</span>            <span class="val">${demande.prenom} ${demande.nom}</span></div>
        <div class="info-row"><span class="lbl">Matricule</span>          <span class="val">${demande.matricule || '—'}</span></div>
        <div class="info-row"><span class="lbl">Service / Poste</span>    <span class="val">${demande.service || '—'}</span></div>
        <div class="info-row"><span class="lbl">Type de permission</span> <span class="val">${demande.typePerm}</span></div>
        <div class="info-row"><span class="lbl">Motif / Absence</span>    <span class="val">${motif}</span></div>
        <div class="info-row"><span class="lbl">Du</span>                 <span class="val">${demande.dateDebut} à ${demande.heureDebut}</span></div>
        <div class="info-row"><span class="lbl">Au</span>                 <span class="val">${demande.dateFin} à ${demande.heureFin}</span></div>
        <div class="info-row"><span class="lbl">Durée</span>              <span class="val">${duree}</span></div>
      </div>
      <div class="card">
        <h2>Approuver la demande</h2>
        <form method="GET" action="${CONFIG.WEBAPP_URL}">
          <input type="hidden" name="token"  value="${token}">
          <input type="hidden" name="action" value="APPROUVE">
          <button type="submit" class="btn btn-ok">APPROUVER LA DEMANDE</button>
        </form>
      </div>
      <div class="card">
        <h2>Rejeter la demande</h2>
        <div class="zone-rejet">
          <p class="alerte-rejet">Le motif est obligatoire — il sera communiqué à l'employé.</p>
          <form method="GET" action="${CONFIG.WEBAPP_URL}" onsubmit="return validerMotif()">
            <input type="hidden" name="token"  value="${token}">
            <input type="hidden" name="action" value="REJETE">
            <textarea name="motif" id="motifRejet" placeholder="Motif de rejet (obligatoire)..." maxlength="800"></textarea>
            <button type="submit" class="btn btn-ko">REJETER LA DEMANDE</button>
          </form>
        </div>
      </div>
      <div class="footer-page">${org} — Système automatisé de gestion des absences</div>
    </div>
    <script>
      function validerMotif() {
        var m = document.getElementById('motifRejet').value.trim();
        if (!m) { alert('Veuillez saisir un motif de rejet.'); return false; }
        var btn = document.querySelector('.btn-ko');
        btn.disabled = true; btn.textContent = 'Envoi en cours...';
        return true;
      }
    </script>`;
}


function pageDejaUtilise(res, nomOrg, theme) {
  const org = nomOrg || CONFIG.NOM_ORG;
  const acc = (theme && theme.couleurAccent) || '#016579';
  return `
    <div class="header"><h1>⬡ ${org}</h1><div class="sous-titre">Système de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">📩</div>
      <div class="result-titre" style="color:${acc}">Réponse déjà envoyée</div>
      <p class="result-msg">${res.message}</p>
      <p class="note-bas">Si vous pensez qu'il s'agit d'une erreur, contactez le service RH.</p>
    </div>
    <div class="footer-page">${org} — Système automatisé de gestion des absences</div>`;
}


function pageResultat(res, nomOrg, theme) {
  const org    = nomOrg || CONFIG.NOM_ORG;
  const acc    = (theme && theme.couleurAccent) || '#016579';
  const icone  = res.success ? '✅' : '❌';
  const couleur = res.success ? acc : '#dc3545';
  const titre  = res.success ? 'Décision enregistrée' : 'Action impossible';
  return `
    <div class="header"><h1>⬡ ${org}</h1><div class="sous-titre">Système de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">${icone}</div>
      <div class="result-titre" style="color:${couleur}">${titre}</div>
      <p class="result-msg">${res.message}</p>
      <p class="note-bas">Vous pouvez fermer cette fenêtre.</p>
    </div>
    <div class="footer-page">${org} — Système automatisé de gestion des absences</div>`;
}


function pageAccueil() {
  return `
    <div class="header">
      <h1>⬡ ${CONFIG.NOM_ORG}</h1>
      <div class="sous-titre">Système de gestion des absences</div>
    </div>
    <div class="result-box" style="max-width:520px">
      <div class="ico">📋</div>
      <div class="result-titre" style="color:#016579">Portail de validation des absences</div>
      <p class="result-msg" style="margin-top:12px">
        Cette page est réservée aux validateurs ayant reçu un <strong>lien de validation</strong> par email.
        <br><br>
        Si vous êtes validateur, utilisez le lien reçu dans votre email de notification.
      </p>
      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eeeeee">
        <p style="font-size:13px;color:#666666;margin-bottom:12px;font-weight:600">
          Accès direct au tableau de suivi
        </p>
        <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_REPONSES_ID}/edit"
           style="display:inline-block;padding:12px 28px;background:#016579;color:#ffffff;
                  border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
          📊 Tableau de suivi
        </a>
      </div>
      <p class="note-bas" style="margin-top:20px">
        Pour toute question, contactez le service RH :<br>
        <a href="mailto:${CONFIG.EMAIL_RH}" style="color:#016579">${CONFIG.EMAIL_RH}</a>
      </p>
    </div>
    <div class="footer-page">${CONFIG.NOM_ORG} — Système automatisé de gestion des absences</div>
  `;
}


function pageErreur(titre, message) {
  return `
    <div class="header"><h1>⬡ ${CONFIG.NOM_ORG}</h1><div class="sous-titre">Système de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">⚠️</div>
      <div class="result-titre" style="color:#dc3545">${titre}</div>
      <p class="result-msg">${message}</p>
      <p class="note-bas">Si vous avez reçu ce lien par email, vérifiez qu'il n'a pas été tronqué.</p>
    </div>
    <div class="footer-page">${CONFIG.NOM_ORG} — Système automatisé de gestion des absences</div>`;
}


function page(contenu, theme) {
  return HtmlService
    .createHtmlOutput(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${CONFIG.NOM_ORG} – Gestion des absences</title>
  ${cssCommun(theme)}
</head>
<body>${contenu}</body>
</html>`)
    .setTitle(CONFIG.NOM_ORG + ' – Gestion des absences')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
