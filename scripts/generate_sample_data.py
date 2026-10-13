#!/usr/bin/env python3
"""Generate the bundled sample data used by the BuilderTrend KPI demo site.

Outputs (into public/data/, the directory Cloudflare Pages deploys):
  Merged_KPI.csv       - detailed rows, same columns as the real sheet
  Weekly_Summary.csv   - one row per job/week
  sample-data.js       - the same CSV strings embedded so the site also works
                         when opened from file:// (no local server needed)

Derived columns (Mismatch_Amount, *_Flag, variance percentages) are computed
here so the sample files look exactly like what the Google Sheet would hold.

Re-run after editing:  python3 scripts/generate_sample_data.py
"""
from __future__ import annotations

import csv
import json
import os
import random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "data")

MERGED_HEADER = [
    "Job_ID", "Job_Name", "Cost_Code", "Cost_Code_Name", "Week_Ending",
    "Budget", "Actual_BT", "Actual_Secondary", "Mismatch_Amount", "Mismatch_Flag",
    "Production_Plan", "Production_Actual", "Production_Variance_Pct", "Production_Flag",
    "Cost_Variance_Pct", "Cost_Flag", "Labor_Hours_Est", "Labor_Hours_Actual",
    "Labor_Variance_Pct", "Change_Order_This_Week", "Status", "Agent_Review_Note",
]

SUMMARY_HEADER = [
    "Job_ID", "Job_Name", "Week_Ending", "Total_Budget", "Total_Actual_BT",
    "Overall_Cost_Variance_Pct", "Lines_Needing_Review", "Clean_Lines", "Status",
]

JOBS = [
    ("J123", "Maple Ridge Residence"),
    ("J456", "Cedar Hollow Townhomes"),
    ("J789", "Oakview Kitchen & Bath"),
]

WEEKS = ["2026-09-28", "2026-10-05", "2026-10-12"]

CODES = {
    "J123": [("03-100", "Framing Labor"), ("09-210", "Plumbing Rough"),
             ("01-110", "Concrete"), ("10-310", "Electrical Rough")],
    "J456": [("12-400", "Flooring"), ("06-100", "Rough Carpentry"),
             ("09-290", "Drywall"), ("23-100", "HVAC")],
    "J789": [("11-600", "Cabinetry"), ("12-400", "Flooring"),
             ("10-310", "Electrical Rough"), ("09-210", "Plumbing Rough")],
}

BASE_BUDGET = {
    "Framing Labor": 48000, "Plumbing Rough": 22000, "Concrete": 35000,
    "Electrical Rough": 18500, "Flooring": 26000, "Rough Carpentry": 31000,
    "Drywall": 19500, "HVAC": 24000, "Cabinetry": 41000,
}

BASE_PLAN = {
    "Framing Labor": 320, "Plumbing Rough": 180, "Concrete": 140,
    "Electrical Rough": 210, "Flooring": 260, "Rough Carpentry": 300,
    "Drywall": 340, "HVAC": 190, "Cabinetry": 120,
}

COST_OVER_BUDGET_PCT = 3.0      # Cost_Flag = "Over Budget" above this
PRODUCTION_BEHIND_PCT = -1.5    # Production_Flag = "Behind" below this

# Deliberate rows called out in AGENT.md plus a couple of extra exceptions.
# Keys are (Job_ID, Cost_Code, Week_Ending); values override generated numbers.
FORCE = {
    ("J123", "03-100", "2026-10-12"): dict(
        budget=48000, actual_bt=52400.00, secondary=49150.00, change_order=0,
        note=("BuilderTrend actual is $3,250.00 above the secondary sheet. Looks like an "
              "unposted framing change order was captured in BuilderTrend only - confirm "
              "with the PM before closing the week.")),
    ("J123", "09-210", "2026-10-12"): dict(
        budget=22000, actual_bt=21860.00, secondary=21817.50, change_order=0,
        note=("Small $42.50 gap between BuilderTrend and the secondary sheet, most likely "
              "rounding on a partial invoice. Verify invoice #4471 then clear.")),
    ("J456", "12-400", "2026-10-12"): dict(
        budget=26000, actual_bt=28900.00, secondary=24150.00, change_order=4750,
        note=("Secondary sheet is missing this week's $4,750.00 flooring change order "
              "(CO-118) - the entire $4,750.00 gap is that unposted change order.")),
    ("J456", "23-100", "2026-10-12"): dict(
        budget=24000, actual_bt=27540.00, secondary=27540.00, change_order=1540,
        note=("HVAC is 14.75% over the weekly budget after the equipment expedite fee. "
              "Confirm the fee lands in the approved allowance.")),
    ("J789", "10-310", "2026-10-12"): dict(
        budget=18500, actual_bt=17920.00, secondary=17920.00,
        plan=210, actual_prod=164,
        note=("Electrical rough-in finished 21.90% behind plan after the failed inspection. "
              "Crew is re-sequenced for 2026-10-19 - needs PM sign-off.")),
    ("J789", "09-210", "2026-10-05"): dict(
        budget=22000, actual_bt=16480.00, secondary=None, change_order=0,
        note=("Secondary sheet has no plumbing line for this week. Confirm whether the sub "
              "was paid outside the tracked sheet before marking reconciled.")),
    # Flagged by the numbers but explicitly cleared by the weekly agent review.
    ("J123", "01-110", "2026-10-05"): dict(
        budget=35000, actual_bt=37180.00, secondary=37180.00, change_order=0,
        status="Clean",
        note=("Concrete is 6.23% over for the week, but it is a one-time mobilization "
              "charge already covered by the approved budget revision. Cleared.")),
    ("J456", "06-100", "2026-10-12"): dict(
        budget=31000, actual_bt=30420.00, secondary=30420.00,
        plan=300, actual_prod=264, change_order=0,
        status="Clean",
        note=("Rough carpentry is 12.00% behind plan because of weather re-sequencing; "
              "catch-up is scheduled for 2026-10-19. No escalation needed.")),
    ("J789", "11-600", "2026-09-28"): dict(
        budget=41000, actual_bt=42760.00, secondary=42760.00, change_order=0,
        status="Clean",
        note=("Cabinetry is 4.29% over because the deposit was invoiced up front; budget "
              "profiles to later weeks. Cleared.")),
}

AUTO_NOTE = ("Production finished {pct:.2f}% behind plan this week. Agent flagged it for "
             "PM confirmation.")


def money(value: float) -> str:
    return f"{value:.2f}"


def pct(value: float) -> str:
    return f"{value:.2f}"


def generate_merged_rows() -> list[dict]:
    rng = random.Random(20261012)
    rows: list[dict] = []

    for job_id, job_name in JOBS:
        for cost_code, cost_name in CODES[job_id]:
            base_budget = BASE_BUDGET[cost_name]
            base_plan = BASE_PLAN[cost_name]

            for week_index, week in enumerate(WEEKS):
                key = (job_id, cost_code, week)
                forced = FORCE.get(key, {})

                budget = forced.get(
                    "budget",
                    round(base_budget * rng.uniform(0.97, 1.03) / 100.0) * 100,
                )
                actual_bt = forced.get(
                    "actual_bt", round(budget * rng.uniform(0.95, 1.01), 2)
                )
                if "secondary" in forced:
                    secondary = forced["secondary"]
                else:
                    secondary = actual_bt

                plan = forced.get(
                    "plan", int(round(base_plan * (0.9 + 0.08 * week_index)))
                )
                actual_prod = forced.get(
                    "actual_prod", int(round(plan * rng.uniform(0.98, 1.09)))
                )

                labor_est = round(plan * 0.55, 1)
                labor_actual = forced.get(
                    "labor_actual", round(labor_est * rng.uniform(0.93, 1.06), 1)
                )

                change_order = forced.get(
                    "change_order",
                    round(rng.uniform(600, 3200) / 50) * 50 if rng.random() < 0.18 else 0,
                )

                if secondary is None:
                    mismatch_amount = None
                    mismatch_flag = "No Secondary"
                else:
                    mismatch_amount = round(actual_bt - secondary, 2)
                    mismatch_flag = "Mismatch" if abs(mismatch_amount) > 0.004 else "OK"

                cost_variance = round((actual_bt - budget) / budget * 100, 2)
                cost_flag = "Over Budget" if cost_variance > COST_OVER_BUDGET_PCT else "OK"

                prod_variance = round((actual_prod - plan) / plan * 100, 2)
                prod_flag = "Behind" if prod_variance < PRODUCTION_BEHIND_PCT else "OK"

                labor_variance = round((labor_actual - labor_est) / labor_est * 100, 2)

                flagged = (
                    mismatch_flag in ("Mismatch", "No Secondary")
                    or cost_flag == "Over Budget"
                    or prod_flag == "Behind"
                )
                status = forced.get("status", "Needs Review" if flagged else "Clean")
                if status == "Needs Review" and flagged and "note" not in forced:
                    note = AUTO_NOTE.format(pct=abs(prod_variance))
                else:
                    note = forced.get("note", "")

                rows.append({
                    "Job_ID": job_id,
                    "Job_Name": job_name,
                    "Cost_Code": cost_code,
                    "Cost_Code_Name": cost_name,
                    "Week_Ending": week,
                    "Budget": money(budget),
                    "Actual_BT": money(actual_bt),
                    "Actual_Secondary": "" if secondary is None else money(secondary),
                    "Mismatch_Amount": "" if mismatch_amount is None else money(mismatch_amount),
                    "Mismatch_Flag": mismatch_flag,
                    "Production_Plan": str(plan),
                    "Production_Actual": str(actual_prod),
                    "Production_Variance_Pct": pct(prod_variance),
                    "Production_Flag": prod_flag,
                    "Cost_Variance_Pct": pct(cost_variance),
                    "Cost_Flag": cost_flag,
                    "Labor_Hours_Est": f"{labor_est:.1f}",
                    "Labor_Hours_Actual": f"{labor_actual:.1f}",
                    "Labor_Variance_Pct": pct(labor_variance),
                    "Change_Order_This_Week": money(change_order),
                    "Status": status,
                    "Agent_Review_Note": note,
                })

    return rows


def generate_summary_rows(merged: list[dict]) -> list[dict]:
    grouped: dict[tuple[str, str], list[dict]] = {}
    for row in merged:
        grouped.setdefault((row["Job_ID"], row["Week_Ending"]), []).append(row)

    summary = []
    for (job_id, week), rows in grouped.items():
        budget = sum(float(r["Budget"]) for r in rows)
        actual = sum(float(r["Actual_BT"]) for r in rows)
        review = sum(1 for r in rows if r["Status"] == "Needs Review")
        summary.append({
            "Job_ID": job_id,
            "Job_Name": rows[0]["Job_Name"],
            "Week_Ending": week,
            "Total_Budget": money(budget),
            "Total_Actual_BT": money(actual),
            "Overall_Cost_Variance_Pct": pct((actual - budget) / budget * 100),
            "Lines_Needing_Review": str(review),
            "Clean_Lines": str(len(rows) - review),
            "Status": "Needs Review" if review else "Clean",
        })

    summary.sort(key=lambda r: (r["Week_Ending"], r["Job_ID"]))
    return summary


def write_csv(path: str, header: list[str], rows: list[dict]) -> str:
    import io

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=header, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    text = buffer.getvalue()
    with open(path, "w", encoding="utf-8", newline="") as handle:
        handle.write(text)
    return text


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    merged = generate_merged_rows()
    summary = generate_summary_rows(merged)

    merged_csv = write_csv(os.path.join(OUT_DIR, "Merged_KPI.csv"), MERGED_HEADER, merged)
    summary_csv = write_csv(os.path.join(OUT_DIR, "Weekly_Summary.csv"), SUMMARY_HEADER, summary)

    payload = {
        "Merged_KPI": merged_csv,
        "Weekly_Summary": summary_csv,
        "_generated": "scripts/generate_sample_data.py",
    }
    js_path = os.path.join(OUT_DIR, "sample-data.js")
    with open(js_path, "w", encoding="utf-8") as handle:
        handle.write("/* Bundled sample data (generated by scripts/generate_sample_data.py).\n")
        handle.write("   Lets the demo run offline / from file:// before the real sheet is shared. */\n")
        handle.write("window.KPI_SAMPLE_DATA = ")
        handle.write(json.dumps(payload, indent=2))
        handle.write(";\n")

    needs_review = sum(1 for r in merged if r["Status"] == "Needs Review")
    print(f"Merged_KPI rows: {len(merged)} ({needs_review} needing review)")
    print(f"Weekly_Summary rows: {len(summary)}")
    print(f"Wrote {os.path.relpath(OUT_DIR, ROOT)}/Merged_KPI.csv, Weekly_Summary.csv, sample-data.js")


if __name__ == "__main__":
    main()
