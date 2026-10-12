# BuilderTrend KPI Frontend

Read-only demo website that reads the sample KPI Google Sheet and shows a
weekly dashboard, a sortable/filterable KPI table, an exception queue, and
per-job detail. Built for the BuilderTrend KPI interview exercise — no auth,
no write-back, no database.

Full build brief for agents: see [AGENT.md](./AGENT.md).

**Source sheet:** https://docs.google.com/spreadsheets/d/1cjmWCRs_isWJHEmHsbJVOJ7_17K0akFOxUnh-6Y_HGE/edit
(primary tabs: `Merged_KPI`, `Weekly_Summary`)

## How the sheet is read

`js/data.js` tries each source in order and uses the first one that returns
**both** sheets. The header badge always shows which source is active:

1. **Google Sheets API** — only if `apiKey` is set in `js/config.js`.
   `GET https://sheets.googleapis.com/v4/spreadsheets/<ID>/values/<Sheet>!A:Z?key=…`
2. **Google Sheet CSV** — the `gviz/tq?tqx=out:csv` endpoint (or a custom
   "Publish to web" CSV URL from `csvUrls` in `js/config.js`). Requires the
   sheet to be shared as *anyone with the link — viewer*.
3. **Local CSV files** — `data/Merged_KPI.csv`, `data/Weekly_Summary.csv`.
4. **Bundled sample data** — `data/sample-data.js`, so the demo also works
   from `file://` and when the sheet is still private.

If a strategy returns the Google sign-in/permission HTML page instead of data,
it is discarded and the next strategy is tried.

## Run locally

Any static server works — the CSV files must be served over HTTP(S), not
`file://` (otherwise the site silently falls back to the bundled sample):

```bash
cd buildertrend-kpi-frontend
python3 -m http.server 8000
# open http://localhost:8000/
```

No build step, no dependencies. Routes are hash-based (`#/dashboard`,
`#/table`, `#/exceptions`, `#/job/J123`).

## Configure the sheet / API key

Edit `js/config.js`:

```js
window.KPI_CONFIG = {
  sheetId: "1cjmWCRs_isWJHEmHsbJVOJ7_17K0akFOxUnh-6Y_HGE",
  apiKey: "",        // optional: public key restricted to the Sheets API
  csvUrls: {         // optional: per-sheet "Publish to web" CSV links
    // Merged_KPI: "https://docs.google.com/spreadsheets/d/<ID>/pub?gid=0&single=true&output=csv",
    // Weekly_Summary: "https://docs.google.com/spreadsheets/d/<ID>/pub?gid=…&single=true&output=csv",
  },
  sheets: { merged: "Merged_KPI", summary: "Weekly_Summary" },
};
```

- **Easiest (recommended for the demo):** in Google Sheets use
  *File → Share → Publish to web* (or share as anyone-with-the-link viewer)
  and paste the two CSV links into `csvUrls` — or just share the sheet and
  leave the defaults, the `gviz` endpoint is tried automatically.
- **Sheets API:** create a key in Google Cloud Console restricted to the
  Sheets API and set `apiKey`. For a pure-static deploy the key is visible in
  the page; restrict it by HTTP referrer to your Cloudflare domain, or proxy
  it through a Worker.

## Sample data

`data/Merged_KPI.csv` and `data/Weekly_Summary.csv` are checked-in sample data
(3 jobs × 3 weeks × 4 cost codes = 36 lines, 8 needing review) including the
deliberate mismatches from the brief (J123 Framing Labor 10-12, J123 Plumbing
Rough 10-12, J456 Flooring 10-12). They are generated — do not hand-edit:

```bash
python3 scripts/generate_sample_data.py
```

This also regenerates `data/sample-data.js` (the same CSVs embedded for
offline/`file://` use).

## Deploy to Cloudflare Pages

**Option A — dashboard upload (fastest):** Cloudflare dashboard → Workers &
Pages → Create → Pages → Upload assets → drag in this folder (or zip it).
No build command, no output directory to set.

**Option B — wrangler:**

```bash
npx wrangler pages deploy . --project-name buildertrend-kpi-frontend
```

(`wrangler.toml` sets `pages_build_output_dir = "."`.) Then add a custom
domain from one of the existing Cloudflare domains under the project's
*Custom domains* tab.

## Layout

```
index.html            entry point, header/nav/shell
css/styles.css        navy / gold / cream theme, responsive
js/config.js          sheet ID, API key, CSV URLs  ← edit this to go live
js/format.js          CSV parsing, number/date formatting, chips
js/data.js            sheet loading + fallback chain
js/views.js           dashboard, KPI table, exception queue, job detail
js/app.js             hash router, header badge, refresh
data/                 sample CSVs + embedded sample-data.js
scripts/              sample-data generator
```

"Mark reviewed" in the exception queue is stored in the browser's
`localStorage` only — it is a demo affordance, nothing is written back to the
sheet.
