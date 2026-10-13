/* Small formatting + CSV helpers shared by every view. */
(function () {
  "use strict";

  const CONFIG = window.KPI_CONFIG || {};
  const moneyFmt = new Intl.NumberFormat(CONFIG.locale || "en-US", {
    style: "currency",
    currency: CONFIG.currency || "USD",
    maximumFractionDigits: 2,
  });
  const money0Fmt = new Intl.NumberFormat(CONFIG.locale || "en-US", {
    style: "currency",
    currency: CONFIG.currency || "USD",
    maximumFractionDigits: 0,
  });
  const numberFmt = new Intl.NumberFormat(CONFIG.locale || "en-US");

  const F = {};

  F.esc = function (value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  /* --- CSV --- */

  // Minimal RFC-4180 parser: quoted fields, "" escapes, \r\n or \n.
  F.parseCsv = function (text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (inQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }
    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim());
    return rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
      const obj = {};
      header.forEach((key, index) => {
        obj[key] = r[index] === undefined ? "" : r[index].trim();
      });
      return obj;
    });
  };

  F.csvToRows = function (csvText, kind) {
    const rows = F.parseCsv(csvText);
    return kind === "summary" ? rows.map(F.normalizeSummary) : rows.map(F.normalizeMerged);
  };

  /* --- Normalization (strings -> numbers, ISO dates) --- */

  function toNumber(value) {
    if (value === "" || value === null || value === undefined) return null;
    const cleaned = String(value).replace(/[$,\s%]/g, "");
    if (cleaned === "" || cleaned === "-") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  F.normalizeMerged = function (raw) {
    const row = { ...raw };
    [
      "Budget", "Actual_BT", "Actual_Secondary", "Mismatch_Amount", "Production_Plan",
      "Production_Actual", "Production_Variance_Pct", "Cost_Variance_Pct",
      "Labor_Hours_Est", "Labor_Hours_Actual", "Labor_Variance_Pct",
      "Change_Order_This_Week",
    ].forEach((key) => {
      row[key] = toNumber(raw[key]);
    });
    row.Week_Ending = (raw.Week_Ending || "").slice(0, 10);
    row._key = [row.Job_ID, row.Cost_Code, row.Week_Ending].join("|");
    return row;
  };

  F.normalizeSummary = function (raw) {
    const row = { ...raw };
    ["Total_Budget", "Total_Actual_BT", "Overall_Cost_Variance_Pct"].forEach((key) => {
      row[key] = toNumber(raw[key]);
    });
    ["Lines_Needing_Review", "Clean_Lines"].forEach((key) => {
      row[key] = toNumber(raw[key]) || 0;
    });
    row.Week_Ending = (raw.Week_Ending || "").slice(0, 10);
    return row;
  };

  /* --- Display formatting --- */

  F.money = function (value, opts) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return (opts && opts.compact ? money0Fmt : moneyFmt).format(value);
  };

  F.signedMoney = function (value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const text = moneyFmt.format(Math.abs(value));
    if (value > 0) return "+" + text;
    if (value < 0) return "-" + text;
    return text;
  };

  F.number = function (value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (digits !== undefined) {
      return value.toLocaleString(CONFIG.locale || "en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    }
    return numberFmt.format(value);
  };

  F.pct = function (value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const d = digits === undefined ? 2 : digits;
    const sign = value > 0 ? "+" : "";
    return sign + value.toFixed(d) + "%";
  };

  F.pctPlain = function (value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    const d = digits === undefined ? 2 : digits;
    return value.toFixed(d) + "%";
  };

  const dateFmt = new Intl.DateTimeFormat(CONFIG.locale || "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  F.dateLabel = function (iso) {
    if (!iso) return "—";
    const date = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) return iso;
    return dateFmt.format(date);
  };

  F.dateShort = function (iso) {
    if (!iso) return "—";
    const date = new Date(iso + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(CONFIG.locale || "en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  F.timeLabel = function (date) {
    if (!date) return "";
    return date.toLocaleTimeString(CONFIG.locale || "en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /* --- Chips --- */

  const CHIP_CLASS = {
    OK: "chip--ok",
    Clean: "chip--ok",
    Mismatch: "chip--mismatch",
    "Needs Review": "chip--review",
    "Has Exceptions": "chip--review",
    "No Secondary": "chip--nosecondary",
    Behind: "chip--behind",
    "Over Budget": "chip--over",
  };

  F.chip = function (value) {
    if (value === null || value === undefined || value === "") return '<span class="muted">—</span>';
    const cls = CHIP_CLASS[value] || "chip--info";
    return `<span class="chip ${cls}">${F.esc(value)}</span>`;
  };

  // The brief says Status is "Clean" / "Needs Review", but the live
  // Weekly_Summary tab uses "Has Exceptions" — treat both as review state.
  F.isReviewStatus = function (status) {
    return status === "Needs Review" || status === "Has Exceptions";
  };

  // Colors a value as "bad" (red) or "good" (green).
  // higherIsWorse: true for cost/labor variance, false for production output.
  F.signClass = function (value, higherIsWorse) {
    if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "";
    const worse = higherIsWorse === false ? value < 0 : value > 0;
    return worse ? "bad" : "good";
  };

  /* --- Small utilities --- */

  F.unique = function (values) {
    return Array.from(new Set(values.filter(Boolean))).sort();
  };

  F.groupBy = function (items, keyFn) {
    const map = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  };

  F.sum = function (items, valueFn) {
    return items.reduce((total, item) => {
      const value = valueFn(item);
      return total + (value === null || value === undefined || Number.isNaN(value) ? 0 : value);
    }, 0);
  };

  F.storage = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* localStorage unavailable (private mode) — the demo still works. */
      }
    },
  };

  window.KPIFormat = F;
})();
