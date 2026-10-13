/* Configuration for the BuilderTrend KPI demo site.

   Edit these values to point the site at the real Google Sheet.
   See README.md for what each source needs in order to work.
*/
window.KPI_CONFIG = {
  // Google Sheet that holds Merged_KPI / Weekly_Summary / Notes_For_Frontend.
  sheetId: "1cjmWCRs_isWJHEmHsbJVOJ7_17K0akFOxUnh-6Y_HGE",

  // Optional: a public Google API key restricted to the Sheets API.
  // When set, the site reads the sheet through the official Sheets API.
  apiKey: "",

  // Optional: hand-built CSV URLs per sheet (e.g. a "Publish to web" link).
  // Leave empty to use the gviz CSV endpoint automatically.
  csvUrls: {
    // Merged_KPI: "https://docs.google.com/spreadsheets/d/<ID>/pub?gid=0&single=true&output=csv",
    // Weekly_Summary: "https://docs.google.com/spreadsheets/d/<ID>/pub?gid=123&single=true&output=csv",
  },

  // Sheet (tab) names used by the app.
  sheets: {
    merged: "Merged_KPI",
    summary: "Weekly_Summary",
  },

  // Currency / locale used for formatting.
  currency: "USD",
  locale: "en-US",
};
