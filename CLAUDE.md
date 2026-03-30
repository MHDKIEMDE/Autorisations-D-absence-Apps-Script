# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Google Apps Script (GAS) web application** — an absence authorization management system for Massaka SAS (French-language). It runs entirely within Google Workspace (Sheets, Drive, Gmail, Docs) with no build system, package manager, or external dependencies.

## Development Workflow

### Deploying Changes

1. Open the Google Sheet → **Extensions → Apps Script**
2. Copy/paste modified `.gs` files into the Apps Script editor
3. Save and run `initialiserProjet()` if triggers or protections changed

### Deploying the Web App

- **Apps Script → Deploy → New deployment**
  - Type: **Web App**, Execute as: **Me**, Access: **Anyone**
- Copy the generated URL into `WEBAPP_URL` in [Config.gs](Config.gs)

### Initial Setup (one-time)

Run `initialiserProjet()` in the Apps Script editor — installs the 3 triggers below, writes column headers, sets dropdowns and column protections.

### Testing

1. Submit a test request via the linked Google Form
2. Verify columns V–AD are populated in the sheet
3. Verify email notifications arrive and validation links work
4. Use **Absences** menu → admin tools for manual recovery/testing

No linting or automated tests — validation is done manually via the Apps Script editor.

## Architecture

### Entry Points

| Trigger | Handler | Location |
|---|---|---|
| Form submission | `onFormSubmit()` | [Code.gs](Code.gs) |
| Sheet cell edit (installable) | `traiterDecisionManuelle()` | [Code.gs](Code.gs) |
| Daily time-based (08h00) | `verifierEtRelancer()` | [Relances.gs](Relances.gs) |
| Web app HTTP GET | `doGet()` | [WebApp.gs](WebApp.gs) |

### Validation Cascade

All requests flow through a configurable cascade. Each level receives a unique one-time token embedded in an email link. The same decision can also be made by editing the sheet directly (both modes coexist without conflict via token validation + LockService).

**Workflow circuits** — set per-service in `SERVICE_SUP_MAP`:

| Circuit | Flow |
|---|---|
| `SUP_RH_PRES` | Supervisor → RH → Presidency (full cascade) |
| `RH_PRES` | RH → Presidency (no supervisor) |
| `PRES` | Presidency only (single final validator) |
| `PRES_RH` | Presidency → RH (RH is final, e.g. Administration) |

Skipped levels are auto-marked `Approuvé` so the cascade always closes cleanly.

**Auto-rejection rule**: Any request with < 3 business days notice (excluding weekends and `JOURS_FERIES`) is rejected immediately on form submission without entering the cascade.

### Key Files

- **[Config.gs](Config.gs)** — Single source of truth for all parameters. This is the only file modified for a new deployment.
- **[Workflow.gs](Workflow.gs)** — Cascade decision logic (who approves next, when to close, routing rules)
- **[Code.gs](Code.gs)** — Trigger handlers (`onFormSubmit`, `traiterDecisionManuelle`)
- **[WebApp.gs](WebApp.gs)** — HTML UI for email-link validation (approve/reject buttons)
- **[Notifications.gs](Notifications.gs)** — HTML email generation with per-presidency theme support
- **[DriveManager.gs](DriveManager.gs)** — Drive folder/doc creation and status-based folder movement
- **[Relances.gs](Relances.gs)** — Daily reminder emails for pending validations
- **[Utils.gs](Utils.gs)** — Shared utilities: UUID generation, date math, business-day calculation, logging
- **[Setup.gs](Setup.gs)** — Admin menu, trigger installation, sheet protections

### Google Sheet Column Structure

Columns A–P are filled by the Google Form. Column Q is resolved by the script from `SERVICE_SUP_MAP`. Columns R–U are decision/comment columns. Columns V–AD are managed automatically by the script.

| Col | Source | Contents |
|---|---|---|
| A–P | Form | Employee info, dates, service |
| Q | Script | Supervisor email (auto-resolved from `SERVICE_SUP_MAP`) |
| R | Validator | Supervisor opinion (`En attente` / `Approuvé` / `Rejeté`) |
| S | Validator | RH opinion |
| T | Validator | Presidency opinion |
| U | Validator | Rejection reason / comment (unprotected, editable by all) |
| V | Script | Request ID (`MSK-YYYY-NNNN`) |
| W–Y | Script | One-time tokens for supervisor / RH / presidency |
| Z | Script | Global status (`En cours` / `Approuvé` / `Rejeté`) |
| AA | Script | Closure date |
| AB | Script | Drive folder ID |
| AC | Script | Google Doc ID |
| AD | Script | Last reminder date |

All column indices are centralized in `Config.gs` as `CONFIG.COL.*` constants (1-based). Never hardcode column numbers — always use `CONFIG.COL.*`.

### Routing Configuration (Config.gs)

- `SERVICE_SUP_MAP` — maps each service to `{ sup, workflow, nomOrg }`. `nomOrg` controls which org name appears in emails.
- `PRESIDENCE_MAP` — maps supervisor email to presidency email + visual theme (colors, font). Falls back to `EMAIL_PRESIDENCE` if the supervisor is not listed.
- `SUP_NOMS` — maps supervisor email to display name

### DriveManager — Known Behavior

`remplirTemplate()` retries `DocumentApp.openById()` up to 3 times with 2-second delays because Drive propagation after `makeCopy()` can lag. If the error **"Impossible d'accéder au document"** (line 71) persists, it means Drive took longer than 6 seconds to propagate the new file — use **Absences → Reprendre un traitement échoué** to retry.

### Notification Rules

- Employee always receives: submission receipt + final decision
- Intermediate approvals (Sup→RH, RH→Presidency) are **not** sent to the employee
- Any rejection at any level triggers immediate final notification

### Token Lifecycle

Tokens are UUID strings stored in columns W–Y. Their prefix encodes their state:

| Value | Meaning |
|---|---|
| `<uuid>` | Active — link is usable |
| `UTILISE_<uuid>` | Already used — decision recorded |
| `INVALIDE_<uuid>` | Cancelled (skipped level or downstream of a rejection) |

`trouverLigneParToken()` strips both prefixes before matching, so it always finds the row regardless of state. The `utilise` boolean in the returned object tells callers whether the token was already consumed.

### Dual-Trigger Architecture for Manual Validation

Two triggers coexist on the sheet edit event:

- **`onEdit` (simple trigger, Code.gs)** — Fires synchronously, cannot use LockService. Its sole job is to revert the cell value if `STATUT_GLOBAL` is already closed (last-resort guard). No workflow logic here.
- **`traiterDecisionManuelle` (installable trigger, Workflow.gs)** — The real handler. Uses `LockService.getScriptLock()` with a 5-second timeout to prevent race conditions, enforces validation order, sends email notifications, and closes the request.

Both run on every edit; the simple trigger is a safety net for closed requests while the installable trigger handles the active cascade.

### Admin Menu (Setup.gs — `onOpen`)

| Menu item | Function | Purpose |
|---|---|---|
| Filtrer par mois / année | `filtrerParMoisAnnee` | Hide rows outside a given period |
| Tout afficher | `toutAfficher` | Unhide all rows |
| Activer validation manuelle | `installerTriggerValidationManuelle` | Install the installable `onEdit` trigger if absent |
| Renvoyer une validation | `renvoyerValidationManuelle` | Manually re-send a validator notification |
| Reprendre un traitement échoué | `reprendreTraitement` | Retry Drive/Doc creation after a propagation failure |
| Nettoyer les triggers en double | `nettoyerTriggers` | Remove duplicate triggers |
| Reconfigurer les couleurs | `colorerStatuts` | Reapply conditional formatting on status columns |
| Reconfigurer les protections | `configurerProtections` | Rebuild column protections and dropdowns |
| Initialiser le projet | `initialiserProjet` | One-time setup: headers, 3 triggers, protections |

### Shared Data Object — `lireDemande(sheet, row)`

All functions pass a single `demande` object returned by `lireDemande()`. Key fields:

```js
{ idDemande, emailEmploye, matricule, nom, prenom, nomComplet,
  service, typePerm, typeAbsence, motifLong, nbJours,
  dateDebut, heureDebut, dateFin, heureFin,   // formatted strings
  dateDebutRaw, heureDebutRaw, dateFinRaw, heureFinRaw,  // raw Date objects
  dateDebutOrd, dateFinOrd,   // "Permission ordinaire" dates
  emailSuperieur, avisSuperieur, avisRH, avisPres,
  tokenSup, tokenRH, tokenPres,
  commentaire, statutGlobal, dateCloture,
  driveDossierID, driveDocID,
  nomOrg }   // resolved once from SERVICE_SUP_MAP
```

### Email Theme Resolution (`getThemeEmail` in Notifications.gs)

Priority order for per-org / per-supervisor visual theming:
1. `PRESIDENCE_MAP[emailSup]` — supervisor-specific override (key = supervisor email)
2. `PRESIDENCE_MAP` entry whose `nomOrg` matches `demande.nomOrg` — org-level fallback
3. Hard-coded defaults (teal palette)

To add a new organization's theme, add an entry keyed by `nomOrg` string to `PRESIDENCE_MAP` in Config.gs.

### Unknown Service Fallback

If a service value from the form is not found in `SERVICE_SUP_MAP`, `onFormSubmit` logs a warning and defaults to workflow `RH_PRES` with no supervisor. The request still processes; add the service to `SERVICE_SUP_MAP` to fix routing.
