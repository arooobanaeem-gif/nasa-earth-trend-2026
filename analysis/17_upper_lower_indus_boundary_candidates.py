
"""
NASA Space Apps Challenge 2026
Upper vs Lower Indus Basin — Boundary Candidate Analysis

Input:
    data/indus_hydrobasins_l6_connectivity.csv

Outputs:
    results/upper_lower_indus_boundary_candidates.csv
    results/upper_lower_indus_candidate_memberships.csv

Purpose:
    Identify candidate hydrological division points using
    HydroBASINS Level 6 downstream connectivity.

    For each candidate:
      Upper = candidate subbasin and every subbasin
              draining through that candidate.
      Lower = all remaining Indus Basin subbasins.

    These are preliminary candidates, NOT final regions.
    Geographic verification is required.
"""

from pathlib import Path
from collections import defaultdict, deque

import pandas as pd


# --------------------------------------------------
# 1. Paths
# --------------------------------------------------

ROOT = Path(__file__).resolve().parents[1]

INPUT = ROOT / "data" / "indus_hydrobasins_l6_connectivity.csv"

RESULTS = ROOT / "results"
RESULTS.mkdir(parents=True, exist_ok=True)

CANDIDATES_OUT = (
    RESULTS / "upper_lower_indus_boundary_candidates.csv"
)

MEMBERSHIPS_OUT = (
    RESULTS / "upper_lower_indus_candidate_memberships.csv"
)


# --------------------------------------------------
# 2. Load and validate HydroBASINS data
# --------------------------------------------------

df = pd.read_csv(INPUT)

required = [
    "HYBAS_ID",
    "NEXT_DOWN",
    "PFAF_ID",
    "SUB_AREA",
    "UP_AREA",
]

missing = set(required) - set(df.columns)

if missing:
    raise ValueError(f"Missing columns: {missing}")

if df[required].isna().any().any():
    raise ValueError("Missing values in required fields.")

if df["HYBAS_ID"].duplicated().any():
    raise ValueError("Duplicate HYBAS_ID values found.")

if (df["SUB_AREA"] <= 0).any():
    raise ValueError("Invalid non-positive subbasin areas.")

df["HYBAS_ID"] = df["HYBAS_ID"].astype("int64")
df["NEXT_DOWN"] = df["NEXT_DOWN"].astype("int64")
df["PFAF_ID"] = df["PFAF_ID"].astype("int64")

ids = set(df["HYBAS_ID"])

total_area = float(df["SUB_AREA"].sum())

print("=" * 65)
print("UPPER–LOWER INDUS BASIN: BOUNDARY CANDIDATE ANALYSIS")
print("=" * 65)

print(f"Total subbasins: {len(df)}")
print(f"Total area: {total_area:,.2f} km²")


# --------------------------------------------------
# 3. Build upstream connectivity graph
# --------------------------------------------------

# downstream_id -> list of directly upstream IDs
upstream_graph = defaultdict(list)

for row in df.itertuples(index=False):

    current_id = int(row.HYBAS_ID)
    downstream_id = int(row.NEXT_DOWN)

    if downstream_id in ids:
        upstream_graph[downstream_id].append(current_id)


# --------------------------------------------------
# 4. Validate downstream network
# --------------------------------------------------

outlets = df.loc[
    ~df["NEXT_DOWN"].isin(ids),
    "HYBAS_ID"
].tolist()

if len(outlets) != 1:
    raise ValueError(
        f"Expected exactly one outlet, found {len(outlets)}."
    )

outlet = int(outlets[0])

print(f"Outlet HYBAS_ID: {outlet}")


def trace_to_outlet(start_id, downstream_map):
    """Verify a node eventually reaches the basin outlet."""

    visited = set()
    current = start_id

    while current in downstream_map:

        if current in visited:
            raise ValueError(
                f"Cycle detected starting at {start_id}"
            )

        visited.add(current)

        next_id = downstream_map[current]

        if next_id not in ids:
            return current

        current = next_id

    raise ValueError(
        f"Broken downstream chain for {start_id}"
    )


downstream_map = dict(
    zip(df["HYBAS_ID"], df["NEXT_DOWN"])
)

for basin_id in ids:
    terminal = trace_to_outlet(
        basin_id, downstream_map
    )

    if terminal != outlet:
        raise ValueError(
            f"Subbasin {basin_id} does not reach outlet."
        )

print("Connectivity validation: PASSED")


# --------------------------------------------------
# 5. Find all upstream contributing subbasins
# --------------------------------------------------

def get_upstream_ids(target_id):
    """
    Return the candidate subbasin and all upstream
    subbasins connected to it.
    """

    visited = set()
    queue = deque([target_id])

    while queue:

        current = queue.popleft()

        if current in visited:
            continue

        visited.add(current)

        for upstream_id in upstream_graph[current]:
            queue.append(upstream_id)

    return visited


# --------------------------------------------------
# 6. Calculate candidate divisions
# --------------------------------------------------

area_map = dict(
    zip(df["HYBAS_ID"], df["SUB_AREA"])
)

pfaf_map = dict(
    zip(df["HYBAS_ID"], df["PFAF_ID"])
)

reported_up_area = dict(
    zip(df["HYBAS_ID"], df["UP_AREA"])
)

records = []
memberships = []

for candidate_id in sorted(ids):

    if candidate_id == outlet:
        continue

    upper_ids = get_upstream_ids(candidate_id)
    lower_ids = ids - upper_ids

    upper_area = sum(
        area_map[x] for x in upper_ids
    )

    lower_area = sum(
        area_map[x] for x in lower_ids
    )

    if not upper_ids or not lower_ids:
        continue

    upper_pct = 100 * upper_area / total_area
    lower_pct = 100 * lower_area / total_area

    records.append({
        "candidate_hybas_id": candidate_id,
        "pfaf_id": pfaf_map[candidate_id],
        "next_down": downstream_map[candidate_id],
        "upper_subbasins": len(upper_ids),
        "lower_subbasins": len(lower_ids),
        "upper_area_km2": upper_area,
        "lower_area_km2": lower_area,
        "upper_area_pct": upper_pct,
        "lower_area_pct": lower_pct,
        "reported_up_area_km2": reported_up_area[
            candidate_id
        ],
        "area_balance_error_km2": abs(
            (upper_area + lower_area) - total_area
        ),
        "distance_from_equal_split_pct": abs(
            upper_pct - 50
        ),
    })

    for basin_id in sorted(ids):

        memberships.append({
            "candidate_hybas_id": candidate_id,
            "hybas_id": basin_id,
            "region": (
                "Upper Indus"
                if basin_id in upper_ids
                else "Lower Indus"
            ),
        })


# --------------------------------------------------
# 7. Rank candidate divisions
# --------------------------------------------------

candidates = pd.DataFrame(records)

# A balanced split is useful for inspection,
# but is NOT proof of hydrological suitability.
candidates = candidates.sort_values(
    [
        "distance_from_equal_split_pct",
        "candidate_hybas_id",
    ]
).reset_index(drop=True)

candidates.insert(
    0,
    "candidate_rank",
    range(1, len(candidates) + 1)
)

top_ids = set(
    candidates.head(10)["candidate_hybas_id"]
)

membership_df = pd.DataFrame(memberships)

membership_df = membership_df[
    membership_df["candidate_hybas_id"].isin(top_ids)
].copy()

membership_df = membership_df.merge(
    candidates[
        ["candidate_hybas_id", "candidate_rank"]
    ],
    on="candidate_hybas_id",
    how="left",
    validate="many_to_one",
)

membership_df = membership_df[
    [
        "candidate_rank",
        "candidate_hybas_id",
        "hybas_id",
        "region",
    ]
].sort_values(
    ["candidate_rank", "hybas_id"]
)


# --------------------------------------------------
# 8. Validate candidate area balance
# --------------------------------------------------

max_error = candidates[
    "area_balance_error_km2"
].max()

if max_error > 1e-6:
    raise ValueError(
        f"Candidate area balance failed: {max_error}"
    )

for candidate_id in top_ids:

    subset = membership_df[
        membership_df["candidate_hybas_id"]
        == candidate_id
    ]

    if len(subset) != len(df):
        raise ValueError(
            f"Incomplete membership for {candidate_id}"
        )

    if subset["hybas_id"].nunique() != len(df):
        raise ValueError(
            f"Duplicate membership for {candidate_id}"
        )

print("Area and membership validation: PASSED")


# --------------------------------------------------
# 9. Save outputs
# --------------------------------------------------

candidates.to_csv(
    CANDIDATES_OUT,
    index=False,
)

membership_df.to_csv(
    MEMBERSHIPS_OUT,
    index=False,
)

print("\nTOP 10 CANDIDATE DIVISIONS\n")

display_columns = [
    "candidate_rank",
    "candidate_hybas_id",
    "pfaf_id",
    "upper_subbasins",
    "lower_subbasins",
    "upper_area_km2",
    "lower_area_km2",
    "upper_area_pct",
]

print(
    candidates.head(10)[display_columns].to_string(
        index=False,
        float_format=lambda x: f"{x:,.2f}"
    )
)

print("\nSaved:")
print(CANDIDATES_OUT)
print(MEMBERSHIPS_OUT)

print(
    "\nIMPORTANT: These candidates are ranked by area "
    "balance only. The final Upper–Lower division "
    "must be selected using geographic and "
    "hydrological interpretation."
)
