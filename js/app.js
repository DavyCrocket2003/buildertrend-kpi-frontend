/* Router + header wiring. Boots the app and keeps the data source badge fresh. */
(function () {
  "use strict";

  const F = window.KPIFormat;
  const Data = window.KPIData;
  const Views = window.KPIViews;
  const CONFIG = window.KPI_CONFIG;

  const app = document.getElementById("app");
  const sourceBadge = document.getElementById("source-badge");
  const sourceLabel = document.getElementById("source-label");
  const updatedAt = document.getElementById("updated-at");
  const refreshBtn = document.getElementById("refresh-btn");
  const exceptionCount = document.getElementById("nav-exception-count");
  const sheetLink = document.getElementById("sheet-link");

  let booted = false;
  let lastRoute = null;

  sheetLink.href = Data.sheetUrl();

  function parseRoute() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const [name, param] = hash.split("/");
    return {
      name: name || "dashboard",
      param: param ? decodeURIComponent(param) : null,
    };
  }

  function setActiveTab(name) {
    const active = ["dashboard", "table", "exceptions", "job"].indexOf(name) !== -1 ? name : "dashboard";
    document.querySelectorAll("#nav a[data-route]").forEach((link) => {
      const route = link.getAttribute("data-route");
      link.classList.toggle("active", route === active || (active === "job" && route === "table"));
    });
  }

  function updateBadge() {
    const count = Views.openExceptionCount();
    exceptionCount.textContent = String(count);
    exceptionCount.hidden = count === 0;
  }

  function updateHeader(data) {
    sourceBadge.classList.remove("is-live", "is-sample", "is-error");
    if (data.error) {
      sourceBadge.classList.add("is-error");
      sourceLabel.textContent = "Data unavailable";
      sourceBadge.title = data.error;
      updatedAt.textContent = "";
      return;
    }
    sourceBadge.classList.add(data.sourceKind === "live" ? "is-live" : "is-sample");
    sourceLabel.textContent = data.source;
    sourceBadge.title = data.sourceDetail || data.source;
    updatedAt.textContent = data.loadedAt
      ? `Updated ${F.timeLabel(data.loadedAt)}`
      : "";
  }

  function renderError(data) {
    const localHint = window.location.protocol === "file:"
      ? "You are viewing the site from <code>file://</code>. Serve it over HTTP (<code>python3 -m http.server</code>) so the CSV files can load, or keep the bundled sample data script included."
      : "The bundled sample data in <code>data/sample-data.js</code> should always load — check the browser console.";
    app.innerHTML = `
      <div class="state-panel">
        <h2>No KPI data could be loaded</h2>
        <p class="hint">${F.esc(data.error || "Unknown error")}</p>
        <p class="hint">${localHint}</p>
        <p class="hint">To read the live sheet, share it as “anyone with the link — viewer”, or set <code>KPI_CONFIG.apiKey</code> in <code>js/config.js</code>.</p>
        <div class="actions">
          <button type="button" class="btn btn-gold" id="retry-btn">Retry</button>
          <a class="btn btn-outline" href="${F.esc(Data.sheetUrl())}" target="_blank" rel="noopener">Open source sheet</a>
        </div>
      </div>`;
    app.querySelector("#retry-btn").addEventListener("click", () => reload(true));
  }

  async function render() {
    const data = await Data.get();
    updateHeader(data);

    if (data.error || !data.merged.length) {
      renderError(data);
      return;
    }

    const route = parseRoute();
    setActiveTab(route.name);
    updateBadge();

    switch (route.name) {
      case "table":
        Views.table(app);
        break;
      case "exceptions":
        Views.exceptions(app);
        break;
      case "job":
        Views.job(app, route.param || "");
        break;
      case "dashboard":
      default:
        Views.dashboard(app);
        break;
    }

    const routeKey = `${route.name}/${route.param || ""}`;
    if (booted && routeKey !== lastRoute) window.scrollTo(0, 0);
    lastRoute = routeKey;
    booted = true;
  }

  async function reload(refreshNetwork) {
    if (refreshNetwork) await Data.refresh();
    await render();
  }

  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    refreshBtn.textContent = "Refreshing…";
    try {
      await reload(true);
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = "Refresh data";
    }
  });

  // Keeps the header badge in sync when a line is marked reviewed.
  app.addEventListener("kpi:exceptions-changed", updateBadge);

  window.addEventListener("hashchange", () => {
    render();
  });

  if (!window.location.hash) {
    window.history.replaceState(null, "", "#/dashboard");
  }
  render();
})();
