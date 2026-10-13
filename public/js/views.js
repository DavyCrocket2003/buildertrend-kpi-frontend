/* View renderers: Dashboard, KPI Table, Exception Queue, Job Detail.
   Each view receives the <main> element, sets its own HTML and wires listeners. */
(function () {
  "use strict";

  const F = window.KPIFormat;
  const Data = window.KPIData;
  const Views = {};

  /* ---------------------------------------------------------------- state */

  const REVIEW_KEY = "kpi.reviewed";
  const reviewed = new Set(F.storage.get(REVIEW_KEY, []));

  const dashState = { week: null };
  const tableState = {
    q: "",
    job: "",
    status: "",
    week: "",
    flag: "",
    sort: { key: "Week_Ending", dir: "desc" },
  };
  const exceptionState = { view: "open", job: "" };
  const jobSort = { key: "Week_Ending", dir: "desc" };

  function isReviewed(row) {
    return reviewed.has(row._key);
  }

  function setReviewed(row, value) {
    if (value) reviewed.add(row._key);
    else reviewed.delete(row._key);
    F.storage.set(REVIEW_KEY, Array.from(reviewed));
  }

  Views.openExceptionCount = function () {
    return Data.store.merged.filter(
      (row) => F.isReviewStatus(row.Status) && !isReviewed(row)
    ).length;
  };

  /* ------------------------------------------------------------ table bits */

  const COLUMNS = [
    { key: "Job_ID", label: "Job", type: "job", sort: (r) => r.Job_ID },
    { key: "Cost_Code", label: "Cost Code", type: "code", sort: (r) => r.Cost_Code },
    { key: "Week_Ending", label: "Week Ending", type: "date", sort: (r) => r.Week_Ending },
    { key: "Budget", label: "Budget", type: "money", num: true },
    { key: "Actual_BT", label: "Actual (BT)", type: "money", num: true },
    { key: "Actual_Secondary", label: "Secondary", type: "moneyEmpty", num: true },
    { key: "Mismatch_Amount", label: "Mismatch", type: "moneySigned", num: true },
    { key: "Mismatch_Flag", label: "Match", type: "chip" },
    { key: "Production_Plan", label: "Plan", type: "int", num: true },
    { key: "Production_Actual", label: "Actual", type: "int", num: true },
    { key: "Production_Variance_Pct", label: "Prod Var", type: "pctInvert", num: true },
    { key: "Production_Flag", label: "Prod", type: "chip" },
    { key: "Cost_Variance_Pct", label: "Cost Var", type: "pct", num: true },
    { key: "Cost_Flag", label: "Cost", type: "chip" },
    { key: "Labor_Hours_Est", label: "Labor Est", type: "hours", num: true },
    { key: "Labor_Hours_Actual", label: "Labor Act", type: "hours", num: true },
    { key: "Labor_Variance_Pct", label: "Labor Var", type: "pct", num: true },
    { key: "Change_Order_This_Week", label: "Change Order", type: "money", num: true },
    { key: "Status", label: "Status", type: "chip" },
    { key: "Agent_Review_Note", label: "Agent Note", type: "note" },
  ];

  function cellHtml(column, row) {
    const value = row[column.key];
    switch (column.type) {
      case "job":
        return `<a class="job-link" href="#/job/${F.esc(row.Job_ID)}">${F.esc(row.Job_ID)} <span class="muted">${F.esc(row.Job_Name)}</span></a>`;
      case "code":
        return `<span class="mono">${F.esc(row.Cost_Code)}</span> <span class="muted">${F.esc(row.Cost_Code_Name)}</span>`;
      case "date":
        return `<span class="nowrap">${F.esc(F.dateLabel(row.Week_Ending))}</span>`;
      case "money":
        return F.money(value);
      case "moneyEmpty":
        return value === null ? '<span class="muted">—</span>' : F.money(value);
      case "moneySigned":
        if (value === null) return '<span class="muted">—</span>';
        if (value === 0) return '<span class="muted">$0.00</span>';
        return `<span class="bad">${F.signedMoney(value)}</span>`;
      case "hours":
        return F.number(value, 1);
      case "int":
        return F.number(value);
      case "pct":
        return `<span class="${F.signClass(value)}">${F.pct(value)}</span>`;
      case "pctInvert":
        return `<span class="${F.signClass(value, false)}">${F.pct(value)}</span>`;
      case "chip":
        return F.chip(value);
      case "note": {
        const note = row.Agent_Review_Note || "";
        return `<div class="cell-note"${note ? ` title="${F.esc(note)}"` : ""}>${note ? F.esc(note) : '<span class="muted">—</span>'}</div>`;
      }
      default:
        return F.esc(value);
    }
  }

  function sortValue(column, row) {
    if (column.sort) return column.sort(row);
    const value = row[column.key];
    return value === null || value === undefined ? null : value;
  }

  function sortRows(rows, sort) {
    if (!sort || !sort.key) return rows;
    const column = COLUMNS.find((c) => c.key === sort.key);
    if (!column) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const av = sortValue(column, a);
      const bv = sortValue(column, b);
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
    });
  }

  function tableHtml(rows, sort) {
    if (!rows.length) {
      return `<div class="empty"><strong>No rows match these filters.</strong>Try clearing a filter or widening the search.</div>`;
    }
    const ordered = sortRows(rows, sort);
    const head = COLUMNS.map((column) => {
      const active = sort && sort.key === column.key;
      const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "";
      const aria = active ? ` aria-sort="${sort.dir === "asc" ? "ascending" : "descending"}"` : "";
      return `<th class="sortable${column.num ? " num" : ""}" data-sort="${F.esc(column.key)}" scope="col"${aria}>${F.esc(column.label)}<span class="arrow">${arrow}</span></th>`;
    }).join("");

    const body = ordered.map((row) => {
      const cells = COLUMNS.map((column) => {
        const cls = [column.num ? "num" : ""].filter(Boolean).join(" ");
        return `<td${cls ? ` class="${cls}"` : ""}>${cellHtml(column, row)}</td>`;
      }).join("");
      const rowCls = F.isReviewStatus(row.Status) && !isReviewed(row) ? ' class="row--review"' : "";
      return `<tr${rowCls} data-key="${F.esc(row._key)}">${cells}</tr>`;
    }).join("");

    return `
      <div class="table-wrap">
        <table class="data">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function bindSort(host, sort, onChange) {
    host.addEventListener("click", (event) => {
      const th = event.target.closest("th[data-sort]");
      if (!th) return;
      const key = th.getAttribute("data-sort");
      if (sort.key === key) sort.dir = sort.dir === "asc" ? "desc" : "asc";
      else {
        sort.key = key;
        sort.dir = ["Week_Ending", "Job_ID", "Cost_Code", "Status"].includes(key) ? "asc" : "desc";
      }
      onChange();
    });
  }

  function tableFooter(rows) {
    const review = rows.filter((r) => F.isReviewStatus(r.Status)).length;
    return `
      <div class="table-foot">
        <span>Showing <strong>${rows.length}</strong> line${rows.length === 1 ? "" : "s"} · <strong>${review}</strong> needing review</span>
        <span>Click a column header to sort · click a job to open its detail view</span>
      </div>`;
  }

  /* ------------------------------------------------------------- dashboard */

  function cardsForWeek(week) {
    const summary = Data.store.summary.filter((row) => row.Week_Ending === week);
    const merged = Data.store.merged.filter((row) => row.Week_Ending === week);

    const budget = F.sum(summary, (r) => r.Total_Budget);
    const actual = F.sum(summary, (r) => r.Total_Actual_BT);
    const costVariance = budget ? ((actual - budget) / budget) * 100 : 0;
    const needing = F.sum(summary, (r) => r.Lines_Needing_Review);
    const totalLines = merged.length;
    const changeOrders = F.sum(merged, (r) => r.Change_Order_This_Week);
    const behind = merged.filter((r) => r.Production_Flag === "Behind").length;
    const mismatches = merged.filter((r) => r.Mismatch_Flag === "Mismatch").length;
    const noSecondary = merged.filter((r) => r.Mismatch_Flag === "No Secondary").length;
    const overBudget = merged.filter((r) => r.Cost_Flag === "Over Budget").length;
    const open = merged.filter((r) => F.isReviewStatus(r.Status) && !isReviewed(r)).length;

    return { summary, merged, budget, actual, costVariance, needing, totalLines, changeOrders, behind, mismatches, noSecondary, overBudget, open };
  }

  function barRow(label, value, text, cls) {
    const width = Math.max(0, Math.min(100, value));
    return `
      <div class="bar-row">
        <div class="bar-label" title="${F.esc(label)}">${F.esc(label)}</div>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width:${width.toFixed(1)}%"></div></div>
        <div class="bar-value">${text}</div>
      </div>`;
  }

  function divergeRow(label, value, scale, text) {
    const width = Math.min(50, (Math.abs(value) / scale) * 50);
    const isPos = value >= 0;
    const style = isPos
      ? `left:50%;width:${width.toFixed(1)}%`
      : `left:${(50 - width).toFixed(1)}%;width:${width.toFixed(1)}%`;
    return `
      <div class="bar-row">
        <div class="bar-label" title="${F.esc(label)}">${F.esc(label)}</div>
        <div class="diverge"><div class="zero" style="left:50%"></div><div class="seg ${isPos ? "is-pos" : "is-neg"}" style="${style}"></div></div>
        <div class="bar-value ${F.signClass(value)}">${text}</div>
      </div>`;
  }

  Views.dashboard = function (root) {
    const data = Data.store;
    const weeks = F.unique(data.summary.map((r) => r.Week_Ending)).sort().reverse();
    if (!dashState.week || weeks.indexOf(dashState.week) === -1) dashState.week = weeks[0];

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Dashboard</h2>
          <p class="sub">Weekly KPI roll-up from <span class="mono">Weekly_Summary</span> and <span class="mono">Merged_KPI</span>.</p>
        </div>
        <div class="field" style="min-width:200px">
          <label for="dash-week">Week ending</label>
          <select id="dash-week">
            ${weeks.map((w) => `<option value="${F.esc(w)}"${w === dashState.week ? " selected" : ""}>${F.esc(F.dateLabel(w))}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="dash-body"></div>`;

    const body = root.querySelector("#dash-body");
    const weekSelect = root.querySelector("#dash-week");

    function renderBody() {
      const stats = cardsForWeek(dashState.week);
      const rowsNeeding = stats.merged.filter((r) => F.isReviewStatus(r.Status));
      const jobRows = stats.summary.slice().sort((a, b) => b.Overall_Cost_Variance_Pct - a.Overall_Cost_Variance_Pct);
      const maxAbsVariance = Math.max(1, ...jobRows.map((r) => Math.abs(r.Overall_Cost_Variance_Pct)));
      const flagMax = Math.max(1, stats.mismatches, stats.noSecondary, stats.behind, stats.overBudget, stats.needing);
      const trend = weeks.slice().sort().map((week) => ({ week, ...cardsForWeek(week) }));
      const trendMax = Math.max(1, ...trend.map((t) => t.needing));

      const pctOfLines = stats.totalLines
        ? ((stats.needing / stats.totalLines) * 100).toFixed(0)
        : "0";

      body.innerHTML = `
        <div class="grid grid-cards">
          <div class="kpi-card accent-blue">
            <div class="label">Jobs this week</div>
            <div class="value">${stats.summary.length}</div>
            <div class="detail">${stats.totalLines} cost-code lines tracked</div>
          </div>
          <div class="kpi-card accent-red">
            <div class="label">Lines needing review</div>
            <div class="value">${stats.needing}</div>
            <div class="detail">${pctOfLines}% of lines · ${stats.open} still open</div>
          </div>
          <div class="kpi-card ${stats.costVariance > 0 ? "accent-red" : "accent-green"}">
            <div class="label">Net cost variance</div>
            <div class="value ${F.signClass(stats.costVariance)}">${F.pct(stats.costVariance)}</div>
            <div class="detail">${F.money(stats.actual, { compact: true })} actual vs ${F.money(stats.budget, { compact: true })} budget</div>
          </div>
          <div class="kpi-card accent-gold">
            <div class="label">Change orders this week</div>
            <div class="value">${F.money(stats.changeOrders, { compact: true })}</div>
            <div class="detail">Recorded in BuilderTrend</div>
          </div>
          <div class="kpi-card accent-blue">
            <div class="label">Production behind</div>
            <div class="value">${stats.behind}</div>
            <div class="detail">line${stats.behind === 1 ? "" : "s"} under plan</div>
          </div>
        </div>

        <div class="section-title">
          <h3>By job — ${F.esc(F.dateLabel(dashState.week))}</h3>
          <span class="hint">Open a job to see every week</span>
        </div>

        <div class="table-wrap" style="max-height:none">
          <table class="data">
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col" class="num">Total Budget</th>
                <th scope="col" class="num">Actual (BT)</th>
                <th scope="col" class="num">Cost Variance</th>
                <th scope="col" class="num">Needs Review</th>
                <th scope="col" class="num">Clean Lines</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              ${jobRows.map((row) => `
                <tr${F.isReviewStatus(row.Status) ? ' class="row--review"' : ""}>
                  <td><a class="job-link" href="#/job/${F.esc(row.Job_ID)}">${F.esc(row.Job_ID)} <span class="muted">${F.esc(row.Job_Name)}</span></a></td>
                  <td class="num">${F.money(row.Total_Budget)}</td>
                  <td class="num">${F.money(row.Total_Actual_BT)}</td>
                  <td class="num"><span class="${F.signClass(row.Overall_Cost_Variance_Pct)}">${F.pct(row.Overall_Cost_Variance_Pct)}</span></td>
                  <td class="num">${row.Lines_Needing_Review}</td>
                  <td class="num">${row.Clean_Lines}</td>
                  <td>${F.chip(row.Status)}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>

        <div class="section-title"><h3>Signals</h3></div>
        <div class="grid grid-charts">
          <div class="panel">
            <h3>Cost variance by job</h3>
            <p class="panel-sub">Actual vs budget for the selected week. Right of center = over budget.</p>
            ${jobRows.length
              ? jobRows.map((row) => divergeRow(
                  `${row.Job_ID} ${row.Job_Name}`,
                  row.Overall_Cost_Variance_Pct,
                  maxAbsVariance,
                  F.pct(row.Overall_Cost_Variance_Pct)
                )).join("")
              : '<p class="panel-sub">No rows for this week.</p>'}
            <div class="legend">
              <span><span class="swatch" style="background:var(--red-700)"></span>Over budget</span>
              <span><span class="swatch" style="background:var(--green-700)"></span>Under budget</span>
            </div>
          </div>

          <div class="panel">
            <h3>Exception flags this week</h3>
            <p class="panel-sub">Lines flagged by the weekly agent review.</p>
            ${barRow("Mismatch", stats.mismatches, String(stats.mismatches), "is-pos")}
            ${barRow("No secondary", stats.noSecondary, String(stats.noSecondary), "is-blue")}
            ${barRow("Behind plan", stats.behind, String(stats.behind), "is-amber")}
            ${barRow("Over budget", stats.overBudget, String(stats.overBudget), "is-amber")}
            ${barRow("Needs review", stats.needing, String(stats.needing), "is-pos")}
            <div class="legend"><span>Counts are lines, not dollars. Flagged-but-cleared lines are excluded from “Needs review”.</span></div>
          </div>

          <div class="panel">
            <h3>Needs-review trend</h3>
            <p class="panel-sub">Lines the agent escalated, by week ending.</p>
            ${trend.map((t) => barRow(
              F.dateShort(t.week),
              (t.needing / trendMax) * 100,
              String(t.needing),
              "is-gold"
            )).join("")}
            <div class="legend"><span>All weeks currently loaded: ${trend.map((t) => F.dateShort(t.week)).join(" · ")}</span></div>
          </div>
        </div>

        <div class="section-title">
          <h3>Exception queue</h3>
          <a href="#/exceptions">Open the queue (${rowsNeeding.length} line${rowsNeeding.length === 1 ? "" : "s"} this week) &rarr;</a>
        </div>
        ${rowsNeeding.length
          ? `<div class="exception-list">${rowsNeeding.slice(0, 3).map((row) => exceptionCard(row, false)).join("")}</div>
             ${rowsNeeding.length > 3 ? '<p class="table-foot"><a href="#/exceptions">See all exceptions &rarr;</a></p>' : ""}`
          : `<div class="empty"><strong>Nothing flagged for this week.</strong>Every line came back clean.</div>`}
      `;
    }

    weekSelect.addEventListener("change", () => {
      dashState.week = weekSelect.value;
      renderBody();
    });

    renderBody();
  };

  /* ---------------------------------------------------------- KPI table */

  function matchesFlag(row, flag) {
    switch (flag) {
      case "mismatch": return row.Mismatch_Flag === "Mismatch";
      case "nosecondary": return row.Mismatch_Flag === "No Secondary";
      case "behind": return row.Production_Flag === "Behind";
      case "over": return row.Cost_Flag === "Over Budget";
      case "review": return F.isReviewStatus(row.Status);
      default: return true;
    }
  }

  function filteredRows() {
    const state = tableState;
    const query = state.q.trim().toLowerCase();
    return Data.store.merged.filter((row) => {
      if (state.job && row.Job_ID !== state.job) return false;
      if (state.status && row.Status !== state.status) return false;
      if (state.week && row.Week_Ending !== state.week) return false;
      if (state.flag && !matchesFlag(row, state.flag)) return false;
      if (query) {
        const haystack = [
          row.Job_ID, row.Job_Name, row.Cost_Code, row.Cost_Code_Name,
          row.Week_Ending, row.Status, row.Mismatch_Flag, row.Production_Flag,
          row.Cost_Flag, row.Agent_Review_Note,
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  Views.table = function (root) {
    const data = Data.store;
    const jobs = F.unique(data.merged.map((r) => r.Job_ID)).map((id) => ({
      id,
      name: (data.merged.find((r) => r.Job_ID === id) || {}).Job_Name || id,
    }));
    const weeks = F.unique(data.merged.map((r) => r.Week_Ending)).sort().reverse();
    const statuses = F.unique(data.merged.map((r) => r.Status));

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h2>KPI Table</h2>
          <p class="sub">Every line from <span class="mono">Merged_KPI</span>, sortable and filterable.</p>
        </div>
      </div>

      <div class="filters">
        <div class="field grow">
          <label for="f-q">Search</label>
          <input id="f-q" type="search" placeholder="Job, cost code, note…" value="${F.esc(tableState.q)}">
        </div>
        <div class="field">
          <label for="f-job">Job</label>
          <select id="f-job">
            <option value="">All jobs</option>
            ${jobs.map((job) => `<option value="${F.esc(job.id)}"${tableState.job === job.id ? " selected" : ""}>${F.esc(job.id)} — ${F.esc(job.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-week">Week</label>
          <select id="f-week">
            <option value="">All weeks</option>
            ${weeks.map((week) => `<option value="${F.esc(week)}"${tableState.week === week ? " selected" : ""}>${F.esc(F.dateLabel(week))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-status">Status</label>
          <select id="f-status">
            <option value="">All statuses</option>
            ${statuses.map((status) => `<option value="${F.esc(status)}"${tableState.status === status ? " selected" : ""}>${F.esc(status)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="f-flag">Flag</label>
          <select id="f-flag">
            <option value="">Any flag</option>
            <option value="review"${tableState.flag === "review" ? " selected" : ""}>Needs review</option>
            <option value="mismatch"${tableState.flag === "mismatch" ? " selected" : ""}>Mismatch</option>
            <option value="nosecondary"${tableState.flag === "nosecondary" ? " selected" : ""}>No secondary</option>
            <option value="behind"${tableState.flag === "behind" ? " selected" : ""}>Behind plan</option>
            <option value="over"${tableState.flag === "over" ? " selected" : ""}>Over budget</option>
          </select>
        </div>
        <button type="button" class="btn btn-outline" id="f-reset">Reset</button>
        <div class="filter-count" id="f-count"></div>
      </div>

      <div id="table-host"></div>`;

    const host = root.querySelector("#table-host");
    const count = root.querySelector("#f-count");

    function renderRows() {
      const rows = filteredRows();
      host.innerHTML = tableHtml(rows, tableState.sort) + tableFooter(rows);
      count.innerHTML = `<strong>${rows.length}</strong> of ${data.merged.length} lines`;
    }

    root.querySelector("#f-q").addEventListener("input", (event) => {
      tableState.q = event.target.value;
      renderRows();
    });
    ["job", "week", "status", "flag"].forEach((name) => {
      root.querySelector(`#f-${name}`).addEventListener("change", (event) => {
        tableState[name] = event.target.value;
        renderRows();
      });
    });
    root.querySelector("#f-reset").addEventListener("click", () => {
      Object.assign(tableState, { q: "", job: "", status: "", week: "", flag: "" });
      root.querySelector("#f-q").value = "";
      ["job", "week", "status", "flag"].forEach((name) => {
        root.querySelector(`#f-${name}`).value = "";
      });
      renderRows();
    });

    bindSort(host, tableState.sort, renderRows);
    renderRows();
  };

  /* ------------------------------------------------------ exception queue */

  function exceptionCard(row, interactive) {
    const showActions = interactive !== false;
    const reviewedFlag = isReviewed(row);
    const chips = [
      F.chip(row.Mismatch_Flag),
      F.chip(row.Production_Flag),
      F.chip(row.Cost_Flag),
      F.chip(row.Status),
    ].filter((chip) => !chip.includes(">OK<")).join("");

    return `
      <article class="exception-card${reviewedFlag ? " is-reviewed" : ""}" data-key="${F.esc(row._key)}">
        <div class="exception-head">
          <div>
            <div class="exception-title">
              <a href="#/job/${F.esc(row.Job_ID)}">${F.esc(row.Job_ID)} — ${F.esc(row.Job_Name)}</a>
            </div>
            <div class="exception-meta">
              <span>${F.esc(F.dateLabel(row.Week_Ending))}</span>
              <span><span class="mono">${F.esc(row.Cost_Code)}</span> ${F.esc(row.Cost_Code_Name)}</span>
            </div>
          </div>
          <div>${F.chip(row.Status)}</div>
        </div>

        <div class="exception-chips">${chips}</div>

        <div class="exception-stats">
          <div class="stat"><div class="k">Budget</div><div class="v">${F.money(row.Budget, { compact: true })}</div></div>
          <div class="stat"><div class="k">Actual (BT)</div><div class="v">${F.money(row.Actual_BT, { compact: true })}</div></div>
          <div class="stat"><div class="k">Secondary</div><div class="v">${row.Actual_Secondary === null ? "—" : F.money(row.Actual_Secondary, { compact: true })}</div></div>
          <div class="stat"><div class="k">Mismatch</div><div class="v ${row.Mismatch_Amount ? "bad" : ""}">${row.Mismatch_Amount === null ? "—" : F.signedMoney(row.Mismatch_Amount)}</div></div>
          <div class="stat"><div class="k">Cost variance</div><div class="v ${F.signClass(row.Cost_Variance_Pct)}">${F.pct(row.Cost_Variance_Pct)}</div></div>
          <div class="stat"><div class="k">Prod variance</div><div class="v ${F.signClass(row.Production_Variance_Pct, false)}">${F.pct(row.Production_Variance_Pct)}</div></div>
          <div class="stat"><div class="k">Change order</div><div class="v">${F.money(row.Change_Order_This_Week, { compact: true })}</div></div>
        </div>

        ${row.Agent_Review_Note
          ? `<blockquote class="exception-note"><span class="note-label">Agent review note</span>${F.esc(row.Agent_Review_Note)}</blockquote>`
          : ""}

        <div class="exception-actions">
          ${showActions ? `
            <button type="button" class="btn ${reviewedFlag ? "btn-outline" : "btn-gold"} btn-sm" data-action="toggle-reviewed">
              ${reviewedFlag ? "Reopen" : "Mark reviewed"}
            </button>
            ${reviewedFlag ? '<span class="reviewed-flag">✓ Reviewed locally</span>' : '<span class="muted" style="font-size:13px">Stored in this browser only (localStorage).</span>'}
          ` : `
            <a class="btn btn-outline btn-sm" href="#/exceptions">Open in exception queue</a>
            ${reviewedFlag ? '<span class="reviewed-flag">✓ Reviewed</span>' : ""}
          `}
        </div>
      </article>`;
  }

  Views.exceptions = function (root) {
    const data = Data.store;
    const all = data.merged.filter((row) => F.isReviewStatus(row.Status));
    const jobs = F.unique(all.map((r) => r.Job_ID));

    function viewCounts() {
      return {
        open: all.filter((r) => !isReviewed(r)).length,
        reviewed: all.filter((r) => isReviewed(r)).length,
        all: all.length,
      };
    }

    // The segmented counts live outside the re-rendered list, so refresh them
    // every time the reviewed set changes.
    function renderCounts() {
      const counts = viewCounts();
      const labels = {
        open: `Open (${counts.open})`,
        reviewed: `Reviewed (${counts.reviewed})`,
        all: `All (${counts.all})`,
      };
      root.querySelectorAll('#exc-toggle button[data-view]').forEach((el) => {
        const label = labels[el.getAttribute("data-view")];
        if (label) el.textContent = label;
      });
    }

    const counts = viewCounts();

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Exception Queue</h2>
          <p class="sub">Lines where <span class="mono">Status = "Needs Review"</span>, with the weekly agent note.</p>
        </div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div class="segmented" id="exc-toggle">
            <button type="button" data-view="open"${exceptionState.view === "open" ? ' class="is-active"' : ""}>Open (${counts.open})</button>
            <button type="button" data-view="reviewed"${exceptionState.view === "reviewed" ? ' class="is-active"' : ""}>Reviewed (${counts.reviewed})</button>
            <button type="button" data-view="all"${exceptionState.view === "all" ? ' class="is-active"' : ""}>All (${counts.all})</button>
          </div>
          ${jobs.length > 1 ? `
          <div class="field" style="min-width:170px">
            <label for="exc-job">Job</label>
            <select id="exc-job">
              <option value="">All jobs</option>
              ${jobs.map((job) => `<option value="${F.esc(job)}"${exceptionState.job === job ? " selected" : ""}>${F.esc(job)}</option>`).join("")}
            </select>
          </div>` : ""}
        </div>
      </div>
      <div id="exc-host"></div>`;

    const host = root.querySelector("#exc-host");

    function renderList() {
      let rows = all;
      if (exceptionState.job) rows = rows.filter((r) => r.Job_ID === exceptionState.job);
      if (exceptionState.view === "open") rows = rows.filter((r) => !isReviewed(r));
      if (exceptionState.view === "reviewed") rows = rows.filter((r) => isReviewed(r));
      rows = rows.slice().sort((a, b) => {
        if (a.Week_Ending !== b.Week_Ending) return a.Week_Ending < b.Week_Ending ? 1 : -1;
        return a.Job_ID.localeCompare(b.Job_ID) || a.Cost_Code.localeCompare(b.Cost_Code);
      });

      host.innerHTML = rows.length
        ? `<div class="exception-list">${rows.map(exceptionCard).join("")}</div>`
        : `<div class="empty"><strong>${exceptionState.view === "reviewed" ? "Nothing reviewed yet." : "Queue is clear."}</strong>${
            exceptionState.view === "reviewed"
              ? "Mark a line reviewed and it will show up here."
              : "No open exceptions for the selected filters."
          }</div>`;
      renderCounts();
    }

    root.querySelector("#exc-toggle").addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (!button) return;
      exceptionState.view = button.getAttribute("data-view");
      root.querySelectorAll("#exc-toggle button").forEach((el) => {
        el.classList.toggle("is-active", el === button);
      });
      renderList();
    });

    const jobSelect = root.querySelector("#exc-job");
    if (jobSelect) {
      jobSelect.addEventListener("change", () => {
        exceptionState.job = jobSelect.value;
        renderList();
      });
    }

    host.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action='toggle-reviewed']");
      if (!button) return;
      const card = button.closest("[data-key]");
      const row = data.merged.find((r) => r._key === card.getAttribute("data-key"));
      if (!row) return;
      setReviewed(row, !isReviewed(row));
      renderList();
      root.dispatchEvent(new CustomEvent("kpi:exceptions-changed", { bubbles: true }));
    });

    renderList();
  };

  /* ------------------------------------------------------------ job detail */

  Views.job = function (root, jobId) {
    const data = Data.store;
    const rows = data.merged.filter((row) => row.Job_ID === jobId);
    if (!rows.length) {
      root.innerHTML = `
        <div class="state-panel">
          <h2>Unknown job: ${F.esc(jobId)}</h2>
          <p class="hint">That job ID is not in the loaded data.</p>
          <div class="actions"><a class="btn btn-outline" href="#/dashboard">Back to dashboard</a></div>
        </div>`;
      return;
    }

    const summary = data.summary.filter((row) => row.Job_ID === jobId)
      .sort((a, b) => a.Week_Ending.localeCompare(b.Week_Ending));
    const budget = F.sum(rows, (r) => r.Budget);
    const actual = F.sum(rows, (r) => r.Actual_BT);
    const variance = budget ? ((actual - budget) / budget) * 100 : 0;
    const needing = rows.filter((r) => F.isReviewStatus(r.Status)).length;
    const changeOrders = F.sum(rows, (r) => r.Change_Order_This_Week);
    const jobName = rows[0].Job_Name;

    root.innerHTML = `
      <p class="breadcrumb"><a href="#/dashboard">Dashboard</a> / <a href="#/table">KPI Table</a> / ${F.esc(jobId)}</p>
      <div class="page-head">
        <div>
          <h2>${F.esc(jobId)} — ${F.esc(jobName)}</h2>
          <p class="sub">${rows.length} lines across ${summary.length} week${summary.length === 1 ? "" : "s"}${summary.length ? ` · ${F.esc(F.dateLabel(summary[0].Week_Ending))} to ${F.esc(F.dateLabel(summary[summary.length - 1].Week_Ending))}` : ""}</p>
        </div>
        <a class="btn btn-outline" href="#/exceptions">Open exception queue</a>
      </div>

      <div class="stat-strip">
        <div class="kpi-card accent-blue"><div class="label">Total budget</div><div class="value">${F.money(budget, { compact: true })}</div></div>
        <div class="kpi-card accent-blue"><div class="label">Actual (BT)</div><div class="value">${F.money(actual, { compact: true })}</div></div>
        <div class="kpi-card ${variance > 0 ? "accent-red" : "accent-green"}"><div class="label">Cost variance</div><div class="value ${F.signClass(variance)}">${F.pct(variance)}</div></div>
        <div class="kpi-card accent-red"><div class="label">Lines needing review</div><div class="value">${needing}</div></div>
        <div class="kpi-card accent-gold"><div class="label">Change orders</div><div class="value">${F.money(changeOrders, { compact: true })}</div></div>
      </div>

      <div class="section-title"><h3>Weekly roll-up</h3></div>
      <div class="table-wrap" style="max-height:none">
        <table class="data">
          <thead>
            <tr>
              <th scope="col">Week Ending</th>
              <th scope="col" class="num">Total Budget</th>
              <th scope="col" class="num">Actual (BT)</th>
              <th scope="col" class="num">Cost Variance</th>
              <th scope="col" class="num">Needs Review</th>
              <th scope="col" class="num">Clean Lines</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            ${summary.map((row) => `
              <tr${F.isReviewStatus(row.Status) ? ' class="row--review"' : ""}>
                <td class="nowrap">${F.esc(F.dateLabel(row.Week_Ending))}</td>
                <td class="num">${F.money(row.Total_Budget)}</td>
                <td class="num">${F.money(row.Total_Actual_BT)}</td>
                <td class="num"><span class="${F.signClass(row.Overall_Cost_Variance_Pct)}">${F.pct(row.Overall_Cost_Variance_Pct)}</span></td>
                <td class="num">${row.Lines_Needing_Review}</td>
                <td class="num">${row.Clean_Lines}</td>
                <td>${F.chip(row.Status)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="section-title"><h3>All lines</h3><span class="hint">Sortable</span></div>
      <div id="job-table-host"></div>`;

    const host = root.querySelector("#job-table-host");
    function renderRows() {
      host.innerHTML = tableHtml(rows, jobSort) + tableFooter(rows);
    }
    bindSort(host, jobSort, renderRows);
    renderRows();
  };

  window.KPIViews = Views;
})();
