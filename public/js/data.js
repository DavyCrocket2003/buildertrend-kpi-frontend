/* Data loading.

   The site tries the live Google Sheet first and falls back to bundled sample
   data, so the demo always renders something. Strategies, in order:

     1. Google Sheets API      (needs KPI_CONFIG.apiKey)
     2. Published/gviz CSV     (needs the sheet shared "anyone with the link")
     3. Local CSV files        (data/<SheetName>.csv)
     4. Bundled sample data    (data/sample-data.js)

   Each strategy must supply BOTH sheets or it is discarded.
*/
(function () {
  "use strict";

  const CONFIG = window.KPI_CONFIG;
  const F = window.KPIFormat;
  const SAMPLE = window.KPI_SAMPLE_DATA || {};

  const store = {
    merged: [],
    summary: [],
    source: null,       // human label
    sourceKind: null,   // "live" | "local" | "sample"
    sourceDetail: null, // URL / path shown in the badge tooltip
    loadedAt: null,
    error: null,
  };

  async function fetchText(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const text = await response.text();
    // Google returns an HTML sign-in / permission page when the sheet is private.
    if (/^\s*<(!DOCTYPE|html)/i.test(text)) {
      throw new Error(`Got an HTML page instead of data (sheet not shared?): ${url}`);
    }
    return text;
  }

  async function fetchJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      const message = (body && body.error && body.error.message) || `HTTP ${response.status}`;
      throw new Error(`${message} (${url})`);
    }
    return body;
  }

  function csvFromSheetValues(json) {
    const values = json.values || [];
    return values
      .map((row) => row.map((cell) => {
        const text = cell === null || cell === undefined ? "" : String(cell);
        return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
      }).join(","))
      .join("\n");
  }

  const strategies = [
    {
      kind: "live",
      label: "Live · Google Sheets API",
      async load(sheetName) {
        if (!CONFIG.apiKey) throw new Error("No API key configured");
        const range = encodeURIComponent(`${sheetName}!A:Z`);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${range}?key=${encodeURIComponent(CONFIG.apiKey)}`;
        const json = await fetchJson(url);
        return { text: csvFromSheetValues(json), detail: url };
      },
    },
    {
      kind: "live",
      label: "Live · Google Sheet CSV",
      async load(sheetName) {
        const custom = CONFIG.csvUrls && CONFIG.csvUrls[sheetName];
        const url = custom ||
          `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        const text = await fetchText(url);
        return { text, detail: url };
      },
    },
    {
      kind: "local",
      label: "Local CSV · data/",
      async load(sheetName) {
        const url = `data/${sheetName}.csv`;
        const text = await fetchText(url);
        return { text, detail: url };
      },
    },
    {
      kind: "sample",
      label: "Sample data (bundled)",
      async load(sheetName) {
        const text = SAMPLE[sheetName];
        if (!text) throw new Error(`No bundled sample for ${sheetName}`);
        return { text, detail: "data/sample-data.js" };
      },
    },
  ];

  async function load() {
    const sheetMerged = CONFIG.sheets.merged;
    const sheetSummary = CONFIG.sheets.summary;
    const failures = [];

    for (const strategy of strategies) {
      try {
        const [merged, summary] = await Promise.all([
          strategy.load(sheetMerged),
          strategy.load(sheetSummary),
        ]);
        store.merged = F.csvToRows(merged.text, "merged");
        store.summary = F.csvToRows(summary.text, "summary");
        store.source = strategy.label;
        store.sourceKind = strategy.kind;
        store.sourceDetail = summary.detail;
        store.loadedAt = new Date();
        store.error = null;
        if (!store.merged.length) throw new Error(`${strategy.label} returned no rows`);
        return store;
      } catch (err) {
        failures.push(`${strategy.label}: ${err.message}`);
      }
    }

    store.error = failures.join(" · ");
    store.source = "Unavailable";
    store.sourceKind = "error";
    return store;
  }

  window.KPIData = {
    store,
    load,
    /* Cached view of the data; `refresh: true` re-fetches from the network. */
    async get(options) {
      if (options && options.refresh) return load();
      if (!store.loadedAt && !store.error) return load();
      return store;
    },
    refresh: load,
    sheetUrl() {
      return `https://docs.google.com/spreadsheets/d/${CONFIG.sheetId}/edit`;
    },
  };
})();
