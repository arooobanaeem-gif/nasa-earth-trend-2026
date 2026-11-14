
"""
NASA Space Apps Challenge 2026
Upper vs Lower Indus — Operational Boundary Definition

Boundary: HydroBASINS L6 subbasin near Chashma Barrage
Candidate HYBAS_ID: 4060718650

Upper: candidate subbasin + all upstream contributors
Lower: all remaining Indus subbasins

This is a Chashma-area operational partition,
not the exact Chashma Barrage watershed boundary.
"""

from pathlib import Path
from collections import defaultdict, deque

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "indus_hydrobasins_l6_connectivity.csv"
OUTPUT = ROOT / "data" / "upper_lower_indus_subbasins.csv"

CANDIDATE_ID = 4060718650

df = pd.read_csv(INPUT)

required = ["HYBAS_ID", "NEXT_DOWN", "SUB_AREA"]
if df[required].isna().any().any():
    raise ValueError("Missing required connectivity values.")

if df["HYBAS_ID"].duplicated().any():
    raise ValueError("Duplicate HYBAS_ID values.")

ids = set(df["HYBAS_ID"].astype(int))

if CANDIDATE_ID not in ids:
    raise ValueError("Selected boundary ID is absent.")

upstream_graph = defaultdict(list)

for row in df.itertuples(index=False):
    if int(row.NEXT_DOWN) in ids:
        upstream_graph[int(row.NEXT_DOWN)].append(
            int(row.HYBAS_ID)
        )

upper_ids = set()
queue = deque([CANDIDATE_ID])

while queue:
    current = queue.popleft()

    if current in upper_ids:
        continue

    upper_ids.add(current)
    queue.extend(upstream_graph[current])

df["region"] = df["HYBAS_ID"].apply(
    lambda x: (
        "Upper Indus"
        if int(x) in upper_ids
        else "Lower Indus"
    )
)

upper = df[df["region"] == "Upper Indus"]
lower = df[df["region"] == "Lower Indus"]

assert len(upper) + len(lower) == len(df)
assert set(upper["HYBAS_ID"]).isdisjoint(
    set(lower["HYBAS_ID"])
)
assert len(df) == 101
assert len(upper) == 43
assert len(lower) == 58

upper_area = upper["SUB_AREA"].sum()
lower_area = lower["SUB_AREA"].sum()
total_area = df["SUB_AREA"].sum()

assert abs(
    upper_area + lower_area - total_area
) < 1e-6

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

df.sort_values("HYBAS_ID").to_csv(
    OUTPUT,
    index=False
)

print("BOUNDARY VALIDATION PASSED")
print(f"Boundary HYBAS_ID: {CANDIDATE_ID}")
print(f"Upper: {len(upper)} subbasins, {upper_area:,.2f} km²")
print(f"Lower: {len(lower)} subbasins, {lower_area:,.2f} km²")
print(f"Total: {total_area:,.2f} km²")
print(f"Saved: {OUTPUT}")
