// ============================================================
// Notifications.gs — Emails HTML
// Système d'autorisation d'absence — Massaka SAS
// ============================================================

/**
 * Retourne le thème visuel — toujours depuis CONFIG.THEME (une seule org).
 * Les paramètres nomOrg et emailSup sont conservés pour compatibilité.
 */
function getThemeEmail(nomOrg, emailSup) {
  const t   = CONFIG.THEME || {};
  const org = nomOrg || CONFIG.NOM_ORG;
  return {
    couleur:                     t.couleur                     || '#000000',
    couleurBadge:                t.couleurBadge                || '#008080',
    couleurTexteBadge:           t.couleurTexteBadge           || '#ffffff',
    couleurAccent:               t.couleurAccent               || '#005555',
    couleurTexte:                t.couleurTexte                || '#ffffff',
    couleurFondMotif:            t.couleurFondMotif            || '#f0f9fc',
    couleurFondDuree:            t.couleurFondDuree            || '#fff8e6',
    couleurLabelDuree:           t.couleurLabelDuree           || '#856404',
    couleurBoutonRejet:          t.couleurBoutonRejet          || '#dc3545',
    couleurBoutonApprouver:      t.couleurBoutonApprouver      || t.couleurAccent || '#005555',
    couleurTexteBoutonApprouver: t.couleurTexteBoutonApprouver || '#ffffff',
    couleurFondTableau:          t.couleurFondTableau          || '#f0f9fc',
    couleurTexteTableau:         t.couleurTexteTableau         || '#000000',
    couleurLabelOption1:         t.couleurLabelOption1         || t.couleurAccent || '#005555',
    couleurBoutonTableau:        t.couleurBoutonTableau        || t.couleurAccent || '#005555',
    couleurTexteBoutonTableau:   t.couleurTexteBoutonTableau   || '#ffffff',
    police:                      t.police                      || "'Montserrat', 'Segoe UI', Arial, sans-serif",
    nomOrg:                      org
  };
}

function cssEmail(theme) {
  const c   = theme.couleur;
  const ca  = theme.couleurAccent;
  const cb  = theme.couleurBadge;
  const ctb = theme.couleurTexteBadge || '#333333';
  const ct  = theme.couleurTexte;
  const cr  = theme.couleurBoutonRejet || '#dc3545';
  const p   = theme.police;
  return `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: ${p}; background: #f4f4f4; color: #333333; }
      .wrap { max-width: 620px; margin: 0 auto; background: #f4f4f4; padding: 24px 16px; }
      .header { background: ${c}; color: ${ct}; padding: 24px 32px; border-radius: 8px 8px 0 0; }
      .header .logo { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
      .header .sous-titre { font-size: 13px; opacity: .85; margin-top: 4px; }
      .header .badge {
        display: inline-block; background: ${cb}; color: ${ctb};
        font-size: 12px; font-weight: 700; padding: 3px 12px;
        border-radius: 20px; margin-top: 10px;
      }
      .body { background: #ffffff; padding: 28px 32px; border-radius: 0 0 8px 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,.08); }
      .section-title {
        font-size: 13px; font-weight: 700; color: ${ca};
        text-transform: uppercase; letter-spacing: .5px;
        border-bottom: 2px solid #f0f0f0; padding-bottom: 6px; margin: 20px 0 12px;
      }
      table.recap { width: 100%; border-collapse: collapse; font-size: 14px; }
      table.recap td { padding: 7px 4px; border-bottom: 1px solid #f5f5f5; vertical-align: top; }
      table.recap td:first-child { width: 42%; color: #666666; font-weight: 600; }
      table.recap td:last-child  { color: #222222; }
      .btn-block { margin: 24px 0 8px; }
      .btn {
        display: inline-block; padding: 13px 28px; font-size: 15px; font-weight: 700;
        border-radius: 6px; text-decoration: none; text-align: center;
        font-family: ${p};
      }
      .btn-ok  { background: ${ca}; color: #ffffff; }
      .btn-ko  { background: ${cr}; color: #ffffff; }
      .btn-full { display: block; width: 100%; }
      .note { font-size: 12px; color: #999999; margin-top: 20px; line-height: 1.5; }
      .result-ok { font-size: 22px; font-weight: 800; color: ${ca}; margin: 8px 0; }
      .result-ko { font-size: 22px; font-weight: 800; color: ${cr}; margin: 8px 0; }
      .motif-box {
        background: #fff5f5; border-left: 4px solid ${cr};
        padding: 12px 16px; border-radius: 4px; margin: 16px 0;
        font-size: 14px; color: #721c24;
      }
      .footer { text-align: center; font-size: 11px; color: #aaaaaa; margin-top: 20px; }
    </style>
  `;
}

function blocRecapitulatif(demande, theme) {
  const c   = theme ? theme.couleurAccent    : '#016579';
  const cfm = theme ? theme.couleurFondMotif : '#f0f9fc';
  const cfd = theme ? theme.couleurFondDuree : '#fff8e6';
  const cld = theme ? theme.couleurLabelDuree : '#856404';
  const cb  = theme ? theme.couleurBadge     : '#f8c542';

  const estOrdinaire = demande.typePerm === 'Permission ordinaire';

  const motif = estOrdinaire
    ? (demande.motifLong || '—')
    : (demande.typeAbsence || demande.motifLong || '—');

  const duree = estOrdinaire
    ? (demande.nbJours ? `${demande.nbJours} jour(s)` : '—')
    : calculerDuree(demande);

  const lignesDates = estOrdinaire ? `
      <tr><td>Du</td>             <td>${demande.dateDebutOrd || '—'}</td></tr>
      <tr><td>Au</td>             <td>${demande.dateFinOrd   || '—'}</td></tr>
      <tr><td>Nombre de jours</td><td>${demande.nbJours      || '—'}</td></tr>
  ` : `
      <tr><td>Du</td>             <td>${demande.dateDebut} à ${demande.heureDebut}</td></tr>
      <tr><td>Au</td>             <td>${demande.dateFin}   à ${demande.heureFin}</td></tr>
  `;

  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0 20px">
      <tr>
        <td style="width:60%;padding-right:8px;vertical-align:top">
          <div style="background:${cfm};border-left:4px solid ${c};padding:12px 16px;border-radius:5px;height:100%">
            <div style="font-size:10px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Motif</div>
            <div style="font-size:15px;font-weight:700;color:#111111">${motif}</div>
          </div>
        </td>
        <td style="width:40%;vertical-align:top">
          <div style="background:${cfd};border-left:4px solid ${cb};padding:12px 16px;border-radius:5px;height:100%">
            <div style="font-size:10px;font-weight:700;color:${cld};text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Durée</div>
            <div style="font-size:15px;font-weight:700;color:#333333">${duree}</div>
          </div>
        </td>
      </tr>
    </table>
    <div class="section-title">Détails de la demande</div>
    <table class="recap">
      <tr><td>Référence</td>          <td><strong>${demande.idDemande}</strong></td></tr>
      <tr><td>Employé</td>            <td>${demande.prenom} ${demande.nom}</td></tr>
      <tr><td>Type de permission</td> <td>${demande.typePerm}</td></tr>
      ${lignesDates}
    </table>
  `;
}


// ============================================================
// 1. Accusé de réception à l'employé
// ============================================================
function envoyerAccuseReceptionEmploye(demande) {
  const nomOrg   = demande.nomOrg || CONFIG.NOM_ORG;
  const theme    = getThemeEmail(nomOrg, demande.emailSuperieur);
  const workflow = ((CONFIG.SERVICE_SUP_MAP || {})[demande.service] || {}).workflow || 'PRES';

  const texteEtapes = {
    'SUP_PRES': 'Votre demande sera examinée successivement par votre supérieur hiérarchique, puis par la présidence.',
    'PRES':     'Votre demande sera examinée directement par la présidence.'
  }[workflow] || 'Votre demande est en cours de traitement.';

  const htmlBody = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">${cssEmail(theme)}</head>
    <body><div class="wrap">
      <div class="header">
        <div class="logo">⬡ ${nomOrg}</div>
        <div class="sous-titre">Système de gestion des absences</div>
        <div class="badge">Accusé de réception</div>
      </div>
      <div class="body">
        <p style="font-size:15px;margin-bottom:4px">
          Bonjour <strong>${demande.prenom} ${demande.nom}</strong>,
        </p>
        <p style="font-size:14px;color:#555555;margin-top:8px;line-height:1.6">
          Votre demande d'autorisation d'absence a bien été reçue et est en cours de traitement.
        </p>
        ${blocRecapitulatif(demande, theme)}
        <div class="section-title">Prochaines étapes</div>
        <p style="font-size:14px;color:#555555;line-height:1.6">
          ${texteEtapes}
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;border-collapse:collapse">
          <tr>
            <td style="background:${theme.couleurFondMotif || '#f0f9fc'};border-left:4px solid ${theme.couleurAccent};border-radius:6px;padding:12px 16px">
              <span style="font-size:13px;font-weight:700;color:${theme.couleurAccent};text-transform:uppercase;letter-spacing:.5px">ℹ️ Information</span><br>
              <span style="font-size:14px;color:#555555;line-height:1.6">
                Vous serez informé(e) uniquement en cas de rejet ou d'approbation finale.
              </span>
            </td>
          </tr>
        </table>
        <p class="note">
          Référence : <strong>${demande.idDemande}</strong><br>
          Pour toute question, contactez la direction.
        </p>
      </div>
      <div class="footer">${nomOrg} — Système automatisé de gestion des absences</div>
    </div></body></html>
  `;

  GmailApp.sendEmail(
    demande.emailEmploye,
    `${nomOrg} – Demande reçue – ${demande.idDemande}`,
    '',
    { htmlBody: htmlBody, name: nomOrg }
  );

  log('OK', 'Notifications', `Accusé réception → ${demande.emailEmploye} | org=${nomOrg} | ref=${demande.idDemande}`);
}


// ============================================================
// 2. Notification au validateur (Supérieur ou Présidence)
//    Pour la Présidence : envoie aux 2 emails avec le même token
// ============================================================
function envoyerNotificationValidateur(demande, niveau, token, estRelance) {

  const destinations = [];
  let labelNiveau = '';

  if (niveau === 'Superieur') {
    labelNiveau = 'Supérieur hiérarchique';
    const nomSup = getNomSuperieur(demande.emailSuperieur);
    destinations.push({ to: demande.emailSuperieur, nom: nomSup });

  } else if (niveau === 'Presidence') {
    labelNiveau = 'Présidence';
    const pres   = getPresidencePourSup(demande.emailSuperieur, demande.nomOrg);
    const emails = pres.emails || [];
    const noms   = pres.noms   || [];
    emails.forEach((email, i) => {
      if (email) destinations.push({ to: email, nom: noms[i] || email });
    });
  }

  const nomOrg = demande.nomOrg || CONFIG.NOM_ORG;
  const theme  = getThemeEmail(nomOrg, demande.emailSuperieur);
  const lienApprouver = `${CONFIG.WEBAPP_URL}?token=${token}&action=APPROUVE`;
  const lienRejeter   = `${CONFIG.WEBAPP_URL}?token=${token}`;

  const blocRelance = estRelance ? `
    <div style="background:#fff3cd;border-left:4px solid #ffc107;border-radius:6px;padding:10px 14px;margin-bottom:16px">
      <span style="font-size:13px;font-weight:700;color:#856404">⏰ Rappel — cette demande attend toujours votre validation.</span>
    </div>
  ` : '';

  destinations.forEach(({ to, nom }) => {
    if (!to) {
      log('WARN', 'Notifications', `Email manquant pour niveau ${niveau} — vérifiez Config.gs`);
      return;
    }

    const htmlBody = `
      <!DOCTYPE html><html><head><meta charset="UTF-8">${cssEmail(theme)}</head>
      <body><div class="wrap">
        <div class="header">
          <div class="logo">⬡ ${nomOrg}</div>
          <div class="sous-titre">Système de gestion des absences</div>
          <div class="badge">Action requise — ${labelNiveau}</div>
        </div>
        <div class="body">
          <p style="font-size:15px;margin-bottom:4px">
            Bonjour <strong>${nom}</strong>,
          </p>
          ${blocRelance}
          <p style="font-size:14px;color:#555555;margin-top:8px;line-height:1.6">
            Une demande d'autorisation d'absence nécessite votre validation
            en tant que <strong>${labelNiveau}</strong>.
          </p>
          ${blocRecapitulatif(demande, theme)}
          <div class="section-title">Votre décision</div>

          <div style="background:${theme.couleurFondTableau || '#f0f9fc'};border:2px solid ${theme.couleurAccent};border-radius:10px;padding:20px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:800;color:${theme.couleurLabelOption1 || theme.couleurAccent};text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px">
              ✏️ Option 1 — Directement dans le tableau (recommandé)
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:8px;overflow:hidden">
              <tr>
                <td bgcolor="${theme.couleurBoutonTableau || theme.couleurAccent}" style="background:${theme.couleurBoutonTableau || theme.couleurAccent};border-radius:8px">
                  <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_REPONSES_ID}/edit"
                     style="display:block;text-align:center;padding:14px 20px;color:${theme.couleurTexteBoutonTableau || theme.couleurTexte || '#ffffff'};text-decoration:none;font-weight:800;font-size:15px;letter-spacing:.3px">
                    Ouvrir le tableau de suivi
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size:13px;color:${theme.couleurTexteTableau || '#555555'};margin-top:12px;line-height:1.6">
              Trouvez la ligne <strong>${demande.idDemande}</strong>, saisissez votre motif en colonne S si vous rejetez,
              puis choisissez <strong>Approuvé</strong> ou <strong>Rejeté</strong> dans la colonne qui vous correspond.
            </p>
          </div>

          <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px">
            <div style="font-size:12px;font-weight:700;color:#666666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
              Option 2 — Liens rapides (usage unique)
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px">
              <tr>
                <td bgcolor="${theme.couleurBoutonApprouver || theme.couleurAccent}" style="background:${theme.couleurBoutonApprouver || theme.couleurAccent};border-radius:6px">
                  <a href="${lienApprouver}"
                     style="display:block;text-align:center;padding:12px;color:${theme.couleurTexteBoutonApprouver || theme.couleurTexte};text-decoration:none;font-weight:700;font-size:14px">
                    ✅ APPROUVER
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="${theme.couleurBoutonRejet || '#dc3545'}" style="background:${theme.couleurBoutonRejet || '#dc3545'};border-radius:6px">
                  <a href="${lienRejeter}"
                     style="display:block;text-align:center;padding:12px;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px">
                    ❌ REJETER (avec motif)
                  </a>
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:#999999;margin-top:10px;line-height:1.5">
              Ces liens sont à usage unique. Le premier validateur qui clique clôture la décision.
            </p>
          </div>
          <p class="note">
            Référence : <strong>${demande.idDemande}</strong> —
            Employé : ${demande.prenom} ${demande.nom}
          </p>
        </div>
        <div class="footer">${nomOrg} — Système automatisé de gestion des absences</div>
      </div></body></html>
    `;

    GmailApp.sendEmail(
      to,
      `${estRelance ? 'Relance – ' : ''}${nomOrg} – À valider – ${demande.idDemande} – ${demande.prenom} ${demande.nom}`,
      '',
      { htmlBody: htmlBody, name: nomOrg }
    );

    log('OK', 'Notifications', `Validateur notifié → ${to} | niveau=${niveau} | org=${nomOrg} | ref=${demande.idDemande}`);
  });
}


// ============================================================
// 3. Confirmation finale à l'employé
// ============================================================
function envoyerConfirmationFinaleEmploye(demande, decision, motif) {
  const nomOrg      = demande.nomOrg || CONFIG.NOM_ORG;
  const theme       = getThemeEmail(nomOrg, demande.emailSuperieur);
  const estApprouve = decision === 'Approuve' || decision === 'Approuvé';

  const sujet = estApprouve
    ? `${nomOrg} – Absence approuvée – ${demande.idDemande}`
    : `${nomOrg} – Absence refusée – ${demande.idDemande}`;

  const iconResultat  = estApprouve ? '✅' : '❌';
  const texteResultat = estApprouve ? 'Votre demande a été approuvée' : 'Votre demande a été refusée';

  const blocMotif = (!estApprouve && motif) ? `
    <div class="motif-box">
      <strong>Motif du refus :</strong><br>${motif}
    </div>
  ` : '';

  const blocDoc = (estApprouve && demande.driveDocID) ? `
    <div class="section-title">Document officiel</div>
    <div style="background:${theme.couleurFondMotif || '#f0f9fc'};border-left:4px solid ${theme.couleurAccent || '#016579'};border-radius:6px;padding:14px 16px;margin-top:8px">
      <div style="font-size:13px;font-weight:700;color:${theme.couleurAccent || '#016579'};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📎 Pièce jointe</div>
      <p style="font-size:14px;color:#333333;line-height:1.6;margin:0">
        Votre autorisation d'absence est jointe en pièce jointe (PDF).<br>
        Conservez-la comme justificatif officiel.
      </p>
    </div>
  ` : '';

  const htmlBody = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">${cssEmail(theme)}</head>
    <body><div class="wrap">
      <div class="header">
        <div class="logo">⬡ ${nomOrg}</div>
        <div class="sous-titre">Système de gestion des absences</div>
        <div class="badge">${estApprouve ? 'Décision finale — Approuvé' : 'Décision finale — Refusé'}</div>
      </div>
      <div class="body">
        <p style="font-size:15px;margin-bottom:4px">
          Bonjour <strong>${demande.prenom} ${demande.nom}</strong>,
        </p>
        <div style="padding:16px 0 8px">
          <div style="font-size:24px;margin-bottom:4px">${iconResultat} <span class="${estApprouve ? 'result-ok' : 'result-ko'}">${texteResultat}</span></div>
        </div>
        ${blocMotif}
        ${blocRecapitulatif(demande, theme)}
        ${blocDoc}
        <p class="note">
          ${estApprouve
            ? 'Conservez ce document comme justificatif. Pour toute question, contactez la direction.'
            : 'Pour contester cette décision, contactez la direction en mentionnant la référence.'
          }<br>
          Référence : <strong>${demande.idDemande}</strong>
        </p>
      </div>
      <div class="footer">${nomOrg} — Système automatisé de gestion des absences</div>
    </div></body></html>
  `;

  const options = { htmlBody: htmlBody, name: nomOrg };

  if (estApprouve && demande.driveDocID) {
    try {
      const pdf = DriveApp.getFileById(demande.driveDocID)
        .getAs('application/pdf');
      pdf.setName(`${demande.idDemande} - ${demande.nomComplet}.pdf`);
      options.attachments = [pdf];
    } catch (e) {
      log('WARN', 'Notifications', `Impossible de joindre le PDF pour ${demande.idDemande} : ${e}`);
    }
  }

  GmailApp.sendEmail(demande.emailEmploye, sujet, '', options);
  log('OK', 'Notifications', `Confirmation finale → ${demande.emailEmploye} | decision=${decision} | org=${nomOrg} | ref=${demande.idDemande}`);
}
