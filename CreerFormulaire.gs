// ============================================================
// CreerFormulaire.gs — Génère le Google Form des demandes
// Exécuter UNE SEULE FOIS depuis l'éditeur Apps Script :
//     creerFormulaire()
// ============================================================
//
// ⚠️  Dans Google Forms, l'ordre des COLONNES du Sheet suit
//     l'ordre d'AFFICHAGE des questions. Ici, on crée les items
//     dans leur ordre d'affichage final (aucun moveItem), ce qui
//     garantit l'alignement avec CONFIG.COL.
//
// Colonnes générées (zone formulaire) :
//   A Horodateur · B Email · C Nom · D Prénom · E Département
//   F Type d'absence · G Type d'absence (famille) · H Motif urgence
//   I Motif (Autre) · J Date de début · K Durée
//   L Heure début · M Heure fin · N Date de fin
//
// Navigation (sections) :
//   S1 Infos générales (Nom, Prénom, Département)
//   S2 Type d'absence ── routage par choix :
//        • Famille            → S3
//        • Urgence            → S4
//        • Autre              → S5
//        • (les autres)       → S6 (Date)
//   S3 Type d'absence (famille)  → S6
//   S4 Motif de l'urgence        → S6
//   S5 Motif (Autre)             → S6
//   S6 Date de début + Durée ── routage par choix :
//        • Toute la journée   → Envoi (heures + date fin injectées par script)
//        • Personnaliser      → S7
//   S7 Heure début · Heure fin · Date de fin → Envoi
// ============================================================

function creerFormulaire() {

  // ----------------------------------------------------------
  // 0. Données de référence
  // ----------------------------------------------------------
  const TITRE = "Formulaire de demande d'autorisation d'absence — " + CONFIG.NOM_ORG;

  const departements = Object.keys(CONFIG.SERVICE_SUP_MAP || {});  // CpD, Digitale, Technique, SAF

  // Types d'absence — libellés EXACTS (alignés avec TYPES_SANS_DELAI)
  const typesAbsence = [
    'Maladie d\'un proche',
    'Famille',
    'Administration',
    'Activités judiciaires',
    'Motif syndical',
    'Urgence',
    'Autre'
  ];

  // Sous-types Famille — libellés EXACTS (clés de CONFIG.DUREES_FAMILLE)
  const sousTypesFamille = Object.keys(CONFIG.DUREES_FAMILLE || {});

  // ----------------------------------------------------------
  // 1. Créer le formulaire
  // ----------------------------------------------------------
  const form = FormApp.create(TITRE);
  form.setDescription(
    'Vous devez soumettre votre demande au moins ' +
    (CONFIG.DELAI_MIN_JOURS_OUVRABLES || 3) +
    ' jours ouvrables avant la date effective (sauf cas d\'urgence).'
  );
  form.setCollectEmail(true);        // → colonne B
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);

  // ----------------------------------------------------------
  // 2. SECTION 1 — Informations générales (page d'accueil)
  // ----------------------------------------------------------
  form.addSectionHeaderItem()
    .setTitle('Informations générales')
    .setHelpText('Renseignez votre identité et votre département. ' +
                 'Ces informations identifient votre demande.');

  form.addTextItem().setTitle('Nom').setRequired(true);        // C
  form.addTextItem().setTitle('Prénom(s)').setRequired(true);  // D
  form.addListItem()
    .setTitle('Département')
    .setHelpText('Sélectionnez le département auquel vous êtes rattaché(e).')
    .setChoiceValues(departements)
    .setRequired(true);                                         // E

  // ----------------------------------------------------------
  // 3. SECTION 2 — Type d'absence
  // ----------------------------------------------------------
  form.addPageBreakItem()
    .setTitle('Type d\'absence')
    .setHelpText('Permission exceptionnelle, sans retenue sur salaire ni sur le ' +
                 'congé annuel, dans la limite de 10 jours par an (non cumulables). ' +
                 'Choisissez le motif correspondant à votre situation.');

  const itemType = form.addMultipleChoiceItem()
    .setTitle('Type d\'absence')
    .setHelpText('Une seule réponse possible.');               // F

  // ----------------------------------------------------------
  // 4. SECTION 3 — Type d'absence (famille)
  // ----------------------------------------------------------
  const pageFamille = form.addPageBreakItem()
    .setTitle('Motif familial')
    .setHelpText('Précisez l\'événement familial concerné. La durée d\'absence ' +
                 'correspondante est indiquée entre parenthèses et appliquée ' +
                 'automatiquement à votre demande.');

  const itemFamille = form.addMultipleChoiceItem()
    .setTitle('Type d\'absence (famille)')
    .setHelpText('La date de fin est calculée automatiquement selon la durée indiquée.')
    .setRequired(true);                                         // G

  // ----------------------------------------------------------
  // 5. SECTION 4 — Motif de l'urgence
  // ----------------------------------------------------------
  const pageUrgence = form.addPageBreakItem()
    .setTitle('Motif de l\'urgence (sans délai — traitement immédiat)')
    .setHelpText('Les demandes pour motif d\'urgence ne sont pas soumises au délai ' +
                 'de préavis habituel : elles sont traitées immédiatement. ' +
                 'Décrivez brièvement la situation.');

  form.addTextItem()
    .setTitle('Motif de votre urgence')
    .setHelpText('Expliquez en quelques mots la nature de l\'urgence.')
    .setRequired(true);                                         // H

  // ----------------------------------------------------------
  // 6. SECTION 5 — Motif (Autre)
  // ----------------------------------------------------------
  const pageAutre = form.addPageBreakItem()
    .setTitle('Précisez votre motif')
    .setHelpText('Décrivez le motif de votre absence afin de permettre son examen ' +
                 'par votre hiérarchie.');

  form.addTextItem()
    .setTitle('Motif / précisions')
    .setHelpText('Soyez précis(e) : ce champ aide les validateurs à statuer.')
    .setRequired(true);                                         // I

  // ----------------------------------------------------------
  // 7. SECTION 6 — Date de début + Durée
  // ----------------------------------------------------------
  const pageDate = form.addPageBreakItem()
    .setTitle('Dates de l\'absence')
    .setHelpText('Indiquez la date de début, puis choisissez la durée de votre absence.');

  form.addDateItem()
    .setTitle('Date de début')
    .setHelpText('Premier jour de votre absence.')
    .setRequired(true);                                         // J

  const itemDuree = form.addMultipleChoiceItem()
    .setTitle('Durée de l\'absence')
    .setHelpText('« Toute la journée » applique les horaires 08h00–17h00. ' +
                 '« Personnaliser » vous permet de préciser un créneau et une date de fin.');  // K

  // ----------------------------------------------------------
  // 8. SECTION 7 — Créneau personnalisé
  // ----------------------------------------------------------
  const pagePerso = form.addPageBreakItem()
    .setTitle('Créneau personnalisé')
    .setHelpText('Précisez les horaires et la date de fin de votre absence.');

  form.addTimeItem().setTitle('Heure de début').setRequired(true);  // L
  form.addTimeItem().setTitle('Heure de fin').setRequired(true);    // M
  form.addDateItem()
    .setTitle('Date de fin')
    .setHelpText('Dernier jour de votre absence.')
    .setRequired(true);                                         // N

  // ----------------------------------------------------------
  // 9. ROUTAGE
  // ----------------------------------------------------------

  // --- Type d'absence → sections cibles ---
  const choixType = typesAbsence.map(function (t) {
    if (t === 'Famille') return itemType.createChoice(t, pageFamille);
    if (t === 'Urgence') return itemType.createChoice(t, pageUrgence);
    if (t === 'Autre')   return itemType.createChoice(t, pageAutre);
    return itemType.createChoice(t, pageDate);   // Maladie, Administration, Activités jud., Motif syndical
  });
  itemType.setChoices(choixType).setRequired(true);

  // --- Sous-type Famille → sections cibles ---
  //   • sous-types à durée fixe → page Date (fin calculée par script)
  //   • "Autre" → page "Précisez le motif" (pas de durée prédéfinie)
  const choixFamille = sousTypesFamille.map(function (s) {
    return itemFamille.createChoice(s, pageDate);
  });
  choixFamille.push(itemFamille.createChoice('Autre', pageAutre));
  itemFamille.setChoices(choixFamille).setRequired(true);

  // --- Durée → routage ---
  const choixJournee = itemDuree.createChoice(
    'Toute la journée', FormApp.PageNavigationType.SUBMIT);
  const choixPerso = itemDuree.createChoice('Personnaliser', pagePerso);
  itemDuree.setChoices([choixJournee, choixPerso]).setRequired(true);

  // --- Fins de section → convergent vers la page Date ---
  pageFamille.setGoToPage(pageDate);
  pageUrgence.setGoToPage(pageDate);
  pageAutre.setGoToPage(pageDate);
  // pageDate : navigation portée par le choix "Durée".
  pagePerso.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  // ----------------------------------------------------------
  // 10. Lier au Sheet de réponses
  // ----------------------------------------------------------
  if (CONFIG.SHEET_REPONSES_ID && CONFIG.SHEET_REPONSES_ID.indexOf('REMPLACER') === -1) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, CONFIG.SHEET_REPONSES_ID);
  }

  // ----------------------------------------------------------
  // 11. URLs
  // ----------------------------------------------------------
  const urlEdit = form.getEditUrl();
  const urlPub  = form.getPublishedUrl();
  Logger.log('Formulaire créé.');
  Logger.log('Édition : ' + urlEdit);
  Logger.log('Public  : ' + urlPub);

  try {
    SpreadsheetApp.getUi().alert(
      'Formulaire créé !\n\n' +
      'Édition :\n' + urlEdit + '\n\n' +
      'Lien public :\n' + urlPub + '\n\n' +
      'ÉTAPES SUIVANTES :\n' +
      '1. Vérifiez la ligne 1 du Sheet : colonnes A→N alignées sur CONFIG.COL.\n' +
      '2. Lancez initialiserProjet() (en-têtes, protections, triggers).\n' +
      '3. Test : une demande "Toute la journée", une "Urgence", une "Famille", une "Autre".'
    );
  } catch (e) {
    Logger.log('[INFO] Alert ignorée (exécution hors UI).');
  }
}
