// ============================================================
// Notifications.gs — Emails HTML
// Systeme d'autorisation d'absence — Massaka
// ============================================================
// Toute la configuration email est dans Config.gs (CONFIG).
// ============================================================

// Themes definis dans Config.gs → CONFIG.THEMES_ORG

// Retourne le theme a partir du nomOrg du demandeur.
// nomOrg est calcule une seule fois dans lireDemande (via SERVICE_SUP_MAP).
// Priorite : PRESIDENCE_MAP[emailSup] > PRESIDENCE_MAP par nomOrg > THEMES_ORG
function getThemeEmail(nomOrg, emailSup) {
  const map = CONFIG.PRESIDENCE_MAP || {};

  // 1. Lookup par email du superviseur (clé directe dans PRESIDENCE_MAP)
  const presBySup = emailSup ? map[emailSup] : null;
  if (presBySup && presBySup.couleur) {
    return {
      couleur:            presBySup.couleur,
      couleurBadge:       presBySup.couleurBadge       || '#f8c542',
      couleurTexteBadge:  presBySup.couleurTexteBadge  || '#333333',
      couleurAccent:      presBySup.couleurAccent      || presBySup.couleur,
      couleurTexte:       presBySup.couleurTexte       || '#ffffff',
      couleurFondMotif:    presBySup.couleurFondMotif    || '#f0f9fc',
      couleurFondDuree:    presBySup.couleurFondDuree    || '#fff8e6',
      couleurLabelDuree:   presBySup.couleurLabelDuree   || '#856404',
      couleurBoutonRejet:          presBySup.couleurBoutonRejet          || '#dc3545',
      couleurBoutonApprouver:      presBySup.couleurBoutonApprouver      || presBySup.couleurAccent || presBySup.couleur,
      couleurTexteBoutonApprouver: presBySup.couleurTexteBoutonApprouver || presBySup.couleurTexte  || '#ffffff',
      couleurFondTableau:        presBySup.couleurFondTableau        || '#f0f9fc',
      couleurTexteTableau:       presBySup.couleurTexteTableau       || '#555555',
      couleurLabelOption1:       presBySup.couleurLabelOption1       || presBySup.couleurAccent || presBySup.couleur,
      couleurBoutonTableau:      presBySup.couleurBoutonTableau      || presBySup.couleurAccent || presBySup.couleur,
      couleurTexteBoutonTableau: presBySup.couleurTexteBoutonTableau || presBySup.couleurTexte  || '#ffffff',
      police:                    presBySup.police                    || "'Montserrat', 'Segoe UI', Arial, sans-serif",
      nomOrg:             presBySup.nomOrg             || nomOrg || CONFIG.NOM_ORG
    };
  }

  // 2. Lookup par nomOrg dans les valeurs de PRESIDENCE_MAP
  //    Permet d'appliquer le bon theme meme quand la cle est l'email du president
  //    (et non l'email du superviseur) — cas RH, Presidence, relances, etc.
  const org = nomOrg || CONFIG.NOM_ORG;
  const presByOrg = Object.values(map).find(p => p.nomOrg === org);
  if (presByOrg && presByOrg.couleur) {
    return {
      couleur:            presByOrg.couleur,
      couleurBadge:       presByOrg.couleurBadge       || '#f8c542',
      couleurTexteBadge:  presByOrg.couleurTexteBadge  || '#333333',
      couleurAccent:      presByOrg.couleurAccent      || presByOrg.couleur,
      couleurTexte:       presByOrg.couleurTexte       || '#ffffff',
      couleurFondMotif:    presByOrg.couleurFondMotif    || '#f0f9fc',
      couleurFondDuree:    presByOrg.couleurFondDuree    || '#fff8e6',
      couleurLabelDuree:   presByOrg.couleurLabelDuree   || '#856404',
      couleurBoutonRejet:          presByOrg.couleurBoutonRejet          || '#dc3545',
      couleurBoutonApprouver:      presByOrg.couleurBoutonApprouver      || presByOrg.couleurAccent || presByOrg.couleur,
      couleurTexteBoutonApprouver: presByOrg.couleurTexteBoutonApprouver || presByOrg.couleurTexte  || '#ffffff',
      couleurFondTableau:        presByOrg.couleurFondTableau        || '#f0f9fc',
      couleurTexteTableau:       presByOrg.couleurTexteTableau       || '#555555',
      couleurLabelOption1:       presByOrg.couleurLabelOption1       || presByOrg.couleurAccent || presByOrg.couleur,
      couleurBoutonTableau:      presByOrg.couleurBoutonTableau      || presByOrg.couleurAccent || presByOrg.couleur,
      couleurTexteBoutonTableau: presByOrg.couleurTexteBoutonTableau || presByOrg.couleurTexte  || '#ffffff',
      police:                    presByOrg.police                    || "'Montserrat', 'Segoe UI', Arial, sans-serif",
      nomOrg:              org
    };
  }

  // 3. Aucune entree trouvee — retourne les valeurs par defaut
  return { nomOrg: org };
}

// CSS partage injecte dans tous les emails HTML
function cssEmail(theme) {
  const c   = theme.couleur;                        // fond entête
  const ca  = theme.couleurAccent;                  // boutons Approuver, titres section
  const cb  = theme.couleurBadge;                   // fond badge
  const ctb = theme.couleurTexteBadge || '#333333'; // texte badge
  const ct  = theme.couleurTexte;                   // texte entête
  const cr  = theme.couleurBoutonRejet || '#dc3545'; // bouton Rejeter
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

// Bloc HTML recapitulatif — adapté selon le type de permission et le theme
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
// 1. Accuse de reception a l'employe
// ============================================================
function envoyerAccuseReceptionEmploye(demande) {
  const nomOrg   = demande.nomOrg || CONFIG.NOM_ORG;
  const theme    = getThemeEmail(nomOrg, demande.emailSuperieur);
  const workflow = ((CONFIG.SERVICE_SUP_MAP || {})[demande.service] || {}).workflow || 'SUP_RH_PRES';

  const texteEtapes = {
    'SUP_RH_PRES': 'Votre demande sera examinée successivement par votre supérieur hiérarchique, le service RH, puis la présidence.',
    'RH_PRES':     'Votre demande sera examinée par le service RH, puis validée par la présidence.',
    'PRES':        'Votre demande sera examinée directement par la présidence.',
    'PRES_RH':     'Votre demande sera examinée en premier par la présidence, puis validée définitivement par le service RH.'
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
            <td style="background:${theme.couleurFondTableau || '#f0f9fc'};border-left:4px solid ${theme.couleurAccent};border-radius:6px;padding:12px 16px">
              <span style="font-size:13px;font-weight:700;color:${theme.couleurAccent};text-transform:uppercase;letter-spacing:.5px">ℹ️ Information</span><br>
              <span style="font-size:14px;color:${theme.couleurTexteTableau || '#555555'};line-height:1.6">
                Vous serez informé(e) uniquement en cas de rejet ou d'approbation finale.
              </span>
            </td>
          </tr>
        </table>
        <p class="note">
          Référence : <strong>${demande.idDemande}</strong><br>
          Pour toute question, contactez le service RH.
        </p>
      </div>
      <div class="footer">${nomOrg} — Système automatisé de gestion des absences</div>
    </div></body></html>
  `;

  GmailApp.sendEmail(
    demande.emailEmploye,
    `[${nomOrg}] Demande reçue – ${demande.idDemande}`,
    '',
    { htmlBody: htmlBody, name: nomOrg + ' RH' }
  );

  log('OK', 'Notifications', `Accuse reception → ${demande.emailEmploye} | org=${nomOrg} | service=${demande.service} | ref=${demande.idDemande}`);
}


// ============================================================
// 2. Notification au validateur (superieur / RH / Presidence)
//    Config emails directement dans Config.gs — plus besoin du sheet.
// ============================================================
function envoyerNotificationValidateur(demande, niveau, token) {

  const destinations = [];
  let labelNiveau = '';

  if (niveau === 'Superieur') {
    labelNiveau = 'Supérieur hiérarchique';
    const nomSup = getNomSuperieur(demande.emailSuperieur);
    destinations.push({ to: demande.emailSuperieur, nom: nomSup });

  } else if (niveau === 'RH') {
    labelNiveau = 'Responsable RH';
    destinations.push({ to: CONFIG.EMAIL_RH, nom: CONFIG.NOM_RH });

  } else if (niveau === 'Presidence') {
    labelNiveau = 'Présidence';
    const pres = getPresidencePourSup(demande.emailSuperieur);
    destinations.push({ to: pres.email, nom: pres.nom });
  }

  const nomOrg = demande.nomOrg || CONFIG.NOM_ORG;
  const theme  = getThemeEmail(nomOrg, demande.emailSuperieur);
  const lienApprouver = `${CONFIG.WEBAPP_URL}?token=${token}&action=APPROUVE`;
  const lienRejeter   = `${CONFIG.WEBAPP_URL}?token=${token}`;

  destinations.forEach(({ to, nom }) => {
    if (!to) {
      log('WARN', 'Notifications', `Email manquant pour niveau ${niveau} — verifie Config.gs`);
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
          <p style="font-size:14px;color:#555555;margin-top:8px;line-height:1.6">
            Une demande d'autorisation d'absence nécessite votre validation
            en tant que <strong>${labelNiveau}</strong>.
          </p>
          ${blocRecapitulatif(demande, theme)}
          <div class="section-title">Votre décision</div>

          <!-- Option 1 : Validation directe dans le tableau (recommandée) -->
          <div style="background:${theme.couleurFondTableau || '#f0f9fc'};border:2px solid ${theme.couleurAccent};border-radius:10px;padding:20px;margin-bottom:16px">
            <div style="font-size:13px;font-weight:800;color:${theme.couleurLabelOption1 || theme.couleurAccent};text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px">
              ✏️ Option 1 — Directement dans le tableau (recommandé)
            </div>
            <a href="https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_REPONSES_ID}/edit"
               style="display:block;text-align:center;padding:14px 20px;color:${theme.couleurTexteBoutonTableau || theme.couleurTexte};background:${theme.couleurBoutonTableau || theme.couleurAccent};border-radius:8px;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:.3px">
              Ouvrir le tableau de suivi
            </a>
            <p style="font-size:13px;color:${theme.couleurTexteTableau || '#555555'};margin-top:12px;line-height:1.6">
              Trouvez la ligne <strong>${demande.idDemande}</strong>, saisissez votre motif en colonne U si vous rejetez,
              puis choisissez <strong>Approuvé</strong> ou <strong>Rejeté</strong> dans la colonne qui vous correspond.
            </p>
          </div>

          <!-- Option 2 : Liens rapides par email -->
          <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px">
            <div style="font-size:12px;font-weight:700;color:#666666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">
              🔗 Option 2 — Liens rapides (usage unique)
            </div>
            <div class="btn-block">
              <a href="${lienApprouver}"
                 style="display:block;text-align:center;padding:12px;color:${theme.couleurTexteBoutonApprouver || theme.couleurTexte};background:${theme.couleurBoutonApprouver || theme.couleurAccent};border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
                ✅ APPROUVER
              </a>
            </div>
            <div class="btn-block" style="margin-top:8px">
              <a href="${lienRejeter}"
                 style="display:block;text-align:center;padding:12px;color:#ffffff;background:${theme.couleurBoutonRejet || '#dc3545'};border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;">
                ❌ REJETER (avec motif)
              </a>
            </div>
            <p style="font-size:12px;color:#999999;margin-top:10px;line-height:1.5">
              Ces liens sont à usage unique. Pour rejeter, un motif sera demandé.
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
      `[${nomOrg}] A valider – ${demande.idDemande} – ${demande.prenom} ${demande.nom}`,
      '',
      { htmlBody: htmlBody, name: nomOrg + ' RH' }
    );

    log('OK', 'Notifications', `Validateur notifie → ${to} | niveau=${niveau} | org=${nomOrg} | ref=${demande.idDemande}`);
  });
}


// ============================================================
// 3. Confirmation finale a l'employe
//    Uniquement en cas de rejet (tout niveau) ou approbation Presidence.
// ============================================================
function envoyerConfirmationFinaleEmploye(demande, decision, motif) {
  const nomOrg      = demande.nomOrg || CONFIG.NOM_ORG;
  const theme       = getThemeEmail(nomOrg, demande.emailSuperieur);
  const estApprouve = decision === 'Approuve' || decision === 'Approuvé';

  const sujet = estApprouve
    ? `[${nomOrg}] Absence approuvee – ${demande.idDemande}`
    : `[${nomOrg}] Absence refusee – ${demande.idDemande}`;

  const iconResultat  = estApprouve ? '✅' : '❌';
  const texteResultat = estApprouve ? 'Votre demande a été approuvée' : 'Votre demande a été refusée';

  const blocMotif = (!estApprouve && motif) ? `
    <div class="motif-box">
      <strong>Motif du refus :</strong><br>${motif}
    </div>
  ` : '';

  const blocDoc = (estApprouve && demande.driveDocID) ? `
    <div class="section-title">Document officiel</div>
    <p style="font-size:14px;color:#555555;line-height:1.6;margin-top:8px">
      Votre autorisation d'absence signée est jointe en pièce jointe (PDF).<br>
      Conservez-la comme justificatif officiel.
    </p>
  ` : '';

  const htmlBody = `
    <!DOCTYPE html><html><head><meta charset="UTF-8">${cssEmail(theme)}</head>
    <body><div class="wrap">
      <div class="header">
        <div class="logo">⬡ ${nomOrg}</div>
        <div class="sous-titre">Système de gestion des absences</div>
        <div class="badge">${estApprouve ? 'Decision finale — Approuve' : 'Decision finale — Refuse'}</div>
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
            ? 'Conservez ce document comme justificatif. Pour toute question, contactez le service RH.'
            : 'Pour contester cette decision, contactez le service RH en mentionnant la reference.'
          }<br>
          Référence : <strong>${demande.idDemande}</strong>
        </p>
      </div>
      <div class="footer">${nomOrg} — Système automatisé de gestion des absences</div>
    </div></body></html>
  `;

  const options = { htmlBody: htmlBody, name: nomOrg + ' RH' };

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
