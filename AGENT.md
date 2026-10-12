# BuilderTrend KPI Frontend — Agent Instructions

This folder contains everything an agent needs to build a simple Cloudflare-hosted website that reads the sample KPI Google Sheet and presents a dashboard + exception queue.

## Goal

Build a lightweight, static or lightly dynamic frontend that:

1. Reads data from the Google Sheet (primarily `Merged_KPI` and `Weekly_Summary`).
2. Shows a clean dashboard of weekly KPIs.
3. Shows a sortable/filterable KPI table with flag highlighting.
4. Shows an exception queue (rows where Status = "Needs Review").
5. Is easy to host on one of David’s existing Cloudflare domains / Pages or Workers.

This is a **mock / demo** for a job interview assignment. It does not need auth, write-back, or production hardening beyond what is reasonable for a demo.

## Source of Truth (Google Sheet)

**Sheet URL:** https://docs.google.com/spreadsheets/d/1cjmWCRs_isWJHEmHsbJVOJ7_17K0akFOxUnh-6Y_HGE/edit

**File ID:** `1cjmWCRs_isWJHEmHsbJVOJ7_17K0akFOxUnh-6Y_HGE`

### Sheets to use

| Sheet Name | Purpose | Recommended Use |
|------------|---------|-----------------|
| `Merged_KPI` | Main detailed data with all flags | Primary table + exception queue |
| `Weekly_Summary` | One row per job/week with totals | Dashboard cards |
| `Notes_For_Frontend` | Column mapping notes | Reference only |

### Merged_KPI columns (row 1 headers)

| Col | Name | Notes |
|-----|------|-------|
| A | Job_ID | |
| B | Job_Name | |
| C | Cost_Code | |
| D | Cost_Code_Name | |
| E | Week_Ending | Date |
| F | Budget | Currency |
| G | Actual_BT | From BuilderTrend |
| H | Actual_Secondary | From other Google Sheet |
| I | Mismatch_Amount | G - H |
| J | Mismatch_Flag | "Mismatch" / "OK" / "No Secondary" |
| K | Production_Plan | |
| L | Production_Actual | |
| M | Production_Variance_Pct | |
| N | Production_Flag | "Behind" / "OK" |
| O | Cost_Variance_Pct | |
| P | Cost_Flag | "Over Budget" / "OK" |
| Q | Labor_Hours_Est | |
| R | Labor_Hours_Actual | |
| S | Labor_Variance_Pct | |
| T | Change_Order_This_Week | |
| U | Status | "Clean" or "Needs Review" |
| V | Agent_Review_Note | Weekly agent note |

### Weekly_Summary columns

Job_ID, Job_Name, Week_Ending, Total_Budget, Total_Actual_BT, Overall_Cost_Variance_Pct, Lines_Needing_Review, Clean_Lines, Status

## Recommended Tech Stack (keep it simple)

Prefer the simplest thing that works well on Cloudflare:

- **Option A (preferred for demo):** Static HTML + CSS + vanilla JS that fetches a published CSV or uses the Google Sheets API (public read).
- **Option B:** Cloudflare Pages + a small Worker that proxies the Sheets API (hides the key if needed).
- **Option C:** Simple React/Vite or Svelte app if the agent prefers, still deployed to Pages.

Do **not** over-engineer. No database, no auth, no complex state management required.

### Data access options (pick one)

1. **Published CSV (easiest for demo)**  
   Publish the sheet to the web as CSV and fetch it. Note: published CSV is public.

2. **Google Sheets API (recommended)**  
   - Use a public API key restricted to the Sheets API.  
   - Endpoint pattern:  
     `https://sheets.googleapis.com/v4/spreadsheets/1cjmWCRs_isWJHEmHsbJVOJ7_17K0akFOxUnh-6Y_HGE/values/Merged_KPI!A1:V`  
   - Store the key in a Cloudflare Worker secret or environment variable if using a proxy; for a pure client demo it can be in the frontend if the sheet is shared appropriately.

3. **Apps Script web app** (optional alternative) that returns JSON.

## Required Views

### 1. Dashboard
- Cards or summary metrics pulled from `Weekly_Summary` (or aggregated from Merged_KPI).
- Examples: total jobs this week, number of lines needing review, average cost variance, production status overview.
- Simple charts are nice but not required (a few colored numbers/cards are enough).

### 2. KPI Table
- Full table of `Merged_KPI` data.
- Sortable columns.
- Visual highlighting:
  - Status = "Needs Review" → red / warning background
  - Mismatch_Flag = "Mismatch" → highlight
  - Production_Flag = "Behind" → yellow
  - Cost_Flag = "Over Budget" → highlight
- Filter controls: by Job, by Status, by Week.

### 3. Exception Queue
- Filtered view of rows where Status = "Needs Review".
- Show the Agent_Review_Note.
- Optional: simple local "Mark reviewed" or comment (localStorage only is fine for the mock).

### 4. Optional Job Detail
- Click a job to see its rows across weeks.

## Design Guidelines

- Clean, professional, construction/business appropriate.
- Dark navy / gold / cream palette is fine (matches the presentation), or a simple neutral SaaS look.
- Responsive enough to look good on desktop (primary) and tablet.
- Clear visual distinction between Clean and Needs Review.
- Include a small header noting this is a demo connected to the sample KPI sheet.

## Deployment

- Target: Cloudflare Pages (or Workers Sites).
- David has existing Cloudflare domains; the agent should make the site easy to deploy via `wrangler` or the Cloudflare dashboard.
- Include a `README.md` with:
  - How to run locally
  - How to configure the Sheet ID / API key
  - How to deploy to Cloudflare

## Sample Data Behavior to Demonstrate

The sheet contains deliberate mismatches so the UI should show flags for:
- J123 Framing Labor (week ending 2026-10-12) — Actual_BT vs Secondary mismatch
- J123 Plumbing Rough (2026-10-12) — small difference
- J456 Flooring (2026-10-12) — secondary missing change order

The exception queue and highlighting should make these obvious.

## Deliverables the Agent Should Produce

1. Working website (HTML/CSS/JS or small framework).
2. `README.md` with setup, local run, and Cloudflare deploy instructions.
3. Any config file needed (e.g. `wrangler.toml` if using Workers/Pages).
4. Clear comments or a short note on how the Sheet is read.

## Out of Scope

- Writing back to the Sheet (read-only is fine).
- Real authentication.
- Full OpenClaw / BuilderTrend browser automation (that lives elsewhere).
- Production monitoring or error handling beyond basic fetch error display.

## Related Context (for the agent’s understanding)

This frontend is the visual layer for an agentic workflow that:
- Uses OpenClaw + the existing `elevateson/buildertrend-openclaw` skill to extract from BuilderTrend via browser.
- Reconciles against a secondary Google Sheet.
- Lands clean data in the KPI Sheet.
- Has a weekly stronger-model review that writes notes and flags.
- Only escalates mismatches/outliers to a human.

The website is the QoL view of the final Sheet.

---

**Start here:** Read the Sheet structure above, decide on data access method, then scaffold the three main views (Dashboard, KPI Table, Exception Queue). Keep it simple and deployable.
