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
Run `initialiserProjet()` in the Apps Script editor — installs triggers, creates the admin menu, sets column protections.

### Testing
1. Submit a test request via the linked Google Form
2. Verify columns U–AC are populated in the sheet
3. Verify email notifications arrive and validation links work
4. Use **Absences** menu → admin tools for manual recovery/testing

### No linting or automated tests — validation is done manually via Google Apps Script editor.

## Architecture

### Entry Points

| Trigger | Handler | Location |
|---|---|---|
| Form submission | `onFormSubmit()` | [Code.gs](Code.gs) |
| Sheet cell edit | `onEdit()` | [Code.gs](Code.gs) |
| Daily time-based | reminders | [Relances.gs](Relances.gs) |
| Web app HTTP GET | `doGet()` | [WebApp.gs](WebApp.gs) |

### Validation Cascade

All requests flow through a 3-level cascade: **Supervisor → RH → Presidency**. Each level receives a unique one-time token embedded in an email link. The same decision can also be made by editing the sheet directly (both modes coexist without conflict via token validation + LockService).

**Auto-rejection rule**: Any request with < 3 business days notice (excluding weekends and `JOURS_FERIES`) is rejected immediately on form submission without entering the cascade.

### Key Files

- **[Config.gs](Config.gs)** — Single source of truth for all parameters. This is the only file modified for a new deployment.
- **[Workflow.gs](Workflow.gs)** — Cascade decision logic (who approves next, when to close, routing rules)
- **[Code.gs](Code.gs)** — Trigger handlers (`onFormSubmit`, `onEdit`)
- **[WebApp.gs](WebApp.gs)** — HTML UI for email-link validation (approve/reject buttons)
- **[Notifications.gs](Notifications.gs)** — HTML email generation with per-presidency theme support
- **[DriveManager.gs](DriveManager.gs)** — Drive folder/doc creation and status-based folder movement
- **[Relances.gs](Relances.gs)** — Daily reminder emails for pending validations
- **[Utils.gs](Utils.gs)** — Shared utilities: UUID generation, date math, business-day calculation, logging
- **[Setup.gs](Setup.gs)** — Admin menu, trigger installation, sheet protections

### Google Sheet Column Structure

Columns A–P are filled by the Google Form. Columns Q–T are filled by validators. Columns U–AC are managed automatically by the script.

| Range | Source | Contents |
|---|---|---|
| A–P | Form | Employee info, dates, service, supervisor email |
| Q | Validator | Supervisor opinion (`En attente` / `Approuvé` / `Rejeté`) |
| R | Validator | RH opinion |
| S | Validator | Presidency opinion |
| T | Validator | Rejection reason (required when rejected) |
| U | Script | Request ID (`MSK-YYYY-NNNN`) |
| V–X | Script | One-time tokens for supervisor / RH / presidency |
| Y | Script | Global status (`En cours` / `Approuvé` / `Rejeté`) |
| Z | Script | Closure date |
| AA–AB | Script | Drive folder ID / document ID |
| AC | Script | Last reminder date |

All column indices are centralized in `Config.gs` as `COL_*` constants.

### Routing Configuration (Config.gs)

- `SERVICE_SUP_MAP` — maps each service/department to its supervisor email
- `PRESIDENCE_MAP` — maps supervisor email to the appropriate presidency email
- `SUP_NOMS` — maps supervisor email to display name
- Theme customization (colors, org name) per presidency is supported in `Notifications.gs`

### Notification Rules

- Employee always receives: submission receipt + final decision
- Intermediate approvals (Sup→RH, RH→Presidency) are **not** sent to the employee
- Any rejection at any level triggers immediate final notification
