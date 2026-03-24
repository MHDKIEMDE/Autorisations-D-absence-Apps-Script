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
    return page(pageAccueil());
  }

  if (action === 'APPROUVE') {
    const res = traiterDecision(token, 'APPROUVE', '');
    if (res.alreadyUsed) return page(pageDejaUtilise(res));
    return page(pageResultat(res));
  }

  if (action === 'REJETE') {
    const res = traiterDecision(token, 'REJETE', motif);
    if (res.alreadyUsed) return page(pageDejaUtilise(res));
    return page(pageResultat(res));
  }

  // Affichage du formulaire de decision
  const found = trouverLigneParToken(token);
  if (!found) {
    return page(pageDejaUtilise({
      message: "La reponse pour cette demande a deja ete envoyee. Ce lien n'est plus actif."
    }));
  }

  const sheet     = getSheetReponses();
  const colStatut = {
    'Superieur':  CONFIG.COL.AVIS_SUP,
    'RH':         CONFIG.COL.AVIS_RH,
    'Presidence': CONFIG.COL.AVIS_PRES
  }[found.niveau];

  if (sheet.getRange(found.row, colStatut).getValue() !== 'En attente') {
    return page(pageDejaUtilise({
      message: "La reponse pour cette demande a deja ete envoyee a ce niveau. Ce lien n'est plus actif."
    }));
  }

  const demande = lireDemande(sheet, found.row);
  return HtmlService
    .createHtmlOutput(cssCommun() + pageFormulaire(demande, token, found.niveau))
    .setTitle('Validation – ' + CONFIG.NOM_ORG)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function cssCommun() {
  return `<style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f4; color: #333333; min-height: 100vh; }
    .header { background: #016579; color: #ffffff; padding: 22px 32px; }
    .header h1 { font-size: 21px; font-weight: 900; letter-spacing: .5px; }
    .header .sous-titre { font-size: 13px; opacity: .82; margin-top: 3px; }
    .header .badge-niveau {
      display: inline-block; background: #f8c542; color: #333333;
      font-size: 12px; font-weight: 700; padding: 3px 14px;
      border-radius: 20px; margin-top: 10px;
    }
    .container { max-width: 640px; margin: 28px auto; padding: 0 16px 56px; }
    .card { background: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,.08); padding: 22px 24px; margin-bottom: 18px; }
    .card h2 { font-size: 15px; color: #016579; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 14px; }
    .info-row { display: flex; padding: 7px 0; border-bottom: 1px solid #f7f7f7; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .lbl { width: 44%; color: #666666; font-weight: 600; }
    .val { width: 56%; color: #222222; }
    .btn { display: block; width: 100%; padding: 13px; font-size: 15px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px; font-family: 'Segoe UI', Arial, sans-serif; }
    .btn-ok { background: #016579; color: #ffffff; }
    .btn-ko { background: #dc3545; color: #ffffff; }
    textarea { width: 100%; height: 110px; padding: 10px; border: 1px solid #cccccc; border-radius: 5px; font-size: 14px; margin-top: 10px; resize: vertical; font-family: 'Segoe UI', Arial, sans-serif; }
    textarea:focus { outline: none; border-color: #016579; }
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


function pageFormulaire(demande, token, niveau) {
  const labelNiveau = {
    'Superieur':  'Superieur hierarchique',
    'RH':         'Responsable RH',
    'Presidence': 'Presidence'
  }[niveau];

  const motif = demande.typeAbsence || demande.motifLong || '—';
  const duree = calculerDuree(demande);

  return `
    <div class="header">
      <h1>⬡ ${CONFIG.NOM_ORG}</h1>
      <div class="sous-titre">Systeme de gestion des absences</div>
      <div class="badge-niveau">Niveau : ${labelNiveau}</div>
    </div>
    <div class="container">
      <div class="card">
        <h2>Demande a valider</h2>
        <span class="badge-att">En attente de votre decision</span>
        <div class="info-row"><span class="lbl">Reference</span>          <span class="val"><strong>${demande.idDemande}</strong></span></div>
        <div class="info-row"><span class="lbl">Employe</span>            <span class="val">${demande.prenom} ${demande.nom}</span></div>
        <div class="info-row"><span class="lbl">Matricule</span>          <span class="val">${demande.matricule || '—'}</span></div>
        <div class="info-row"><span class="lbl">Service / Poste</span>    <span class="val">${demande.service || '—'}</span></div>
        <div class="info-row"><span class="lbl">Type de permission</span> <span class="val">${demande.typePerm}</span></div>
        <div class="info-row"><span class="lbl">Motif / Absence</span>    <span class="val">${motif}</span></div>
        <div class="info-row"><span class="lbl">Du</span>                 <span class="val">${demande.dateDebut} a ${demande.heureDebut}</span></div>
        <div class="info-row"><span class="lbl">Au</span>                 <span class="val">${demande.dateFin} a ${demande.heureFin}</span></div>
        <div class="info-row"><span class="lbl">Duree</span>              <span class="val">${duree}</span></div>
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
          <p class="alerte-rejet">Le motif est obligatoire — il sera communique a l'employe.</p>
          <form method="GET" action="${CONFIG.WEBAPP_URL}" onsubmit="return validerMotif()">
            <input type="hidden" name="token"  value="${token}">
            <input type="hidden" name="action" value="REJETE">
            <textarea name="motif" id="motifRejet" placeholder="Motif de rejet (obligatoire)..." maxlength="800"></textarea>
            <button type="submit" class="btn btn-ko">REJETER LA DEMANDE</button>
          </form>
        </div>
      </div>
      <div class="footer-page">${CONFIG.NOM_ORG} — Systeme automatise de gestion des absences</div>
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


function pageDejaUtilise(res) {
  return `
    <div class="header"><h1>⬡ ${CONFIG.NOM_ORG}</h1><div class="sous-titre">Systeme de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">📩</div>
      <div class="result-titre" style="color:#016579">Reponse deja envoyee</div>
      <p class="result-msg">${res.message}</p>
      <p class="note-bas">Si vous pensez qu'il s'agit d'une erreur, contactez le service RH.</p>
    </div>
    <div class="footer-page">${CONFIG.NOM_ORG} — Systeme automatise de gestion des absences</div>`;
}


function pageResultat(res) {
  const icone  = res.success ? '✅' : '❌';
  const couleur = res.success ? '#016579' : '#dc3545';
  const titre  = res.success ? 'Decision enregistree' : 'Action impossible';
  return `
    <div class="header"><h1>⬡ ${CONFIG.NOM_ORG}</h1><div class="sous-titre">Systeme de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">${icone}</div>
      <div class="result-titre" style="color:${couleur}">${titre}</div>
      <p class="result-msg">${res.message}</p>
      <p class="note-bas">Vous pouvez fermer cette fenetre.</p>
    </div>
    <div class="footer-page">${CONFIG.NOM_ORG} — Systeme automatise de gestion des absences</div>`;
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
    <div class="header"><h1>⬡ ${CONFIG.NOM_ORG}</h1><div class="sous-titre">Systeme de gestion des absences</div></div>
    <div class="result-box">
      <div class="ico">⚠️</div>
      <div class="result-titre" style="color:#dc3545">${titre}</div>
      <p class="result-msg">${message}</p>
      <p class="note-bas">Si vous avez recu ce lien par email, verifiez qu'il n'a pas ete tronque.</p>
    </div>
    <div class="footer-page">${CONFIG.NOM_ORG} — Systeme automatise de gestion des absences</div>`;
}


function page(contenu) {
  return HtmlService
    .createHtmlOutput(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${CONFIG.NOM_ORG} – Gestion des absences</title>
  ${cssCommun()}
</head>
<body>${contenu}</body>
</html>`)
    .setTitle(CONFIG.NOM_ORG + ' – Gestion des absences')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
