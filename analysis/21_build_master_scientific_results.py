
from pathlib import Path
import re
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "results"
OUTPUT = RESULTS / "master_scientific_results.csv"

START_YEAR = 2001
END_YEAR = 2025

COLUMNS = [
    "comparison", "result_type", "region", "variable",
    "label", "unit", "season", "start_year", "end_year",
    "n_years", "mean", "sen_slope_per_year",
    "slope_ci_lower", "slope_ci_upper", "kendall_tau",
    "p_value", "p_value_method", "fdr_q",
    "significant_05", "significance_basis",
    "difference_definition", "source_file"
]

rows = []


def first(row, *names):
    for name in names:
        if name in row.index and pd.notna(row[name]):
            return row[name]
    return np.nan


def parse_years(value):
    if pd.isna(value):
        return START_YEAR, END_YEAR

    years = re.findall(r"(?:19|20)\d{2}", str(value))
    if len(years) >= 2:
        return int(years[0]), int(years[1])

    return START_YEAR, END_YEAR


def add_row(
    row, filename, comparison, result_type,
    region=None, variable=None, label=None,
    unit=None, season=None, slope_columns=(),
    mean_columns=(), p_columns=(),
    p_method=None, ci_lower_columns=(),
    ci_upper_columns=(), tau_columns=(),
    fdr_columns=(), significance_basis=None,
    difference_definition=None
):
    variable = variable or first(row, "variable", "band", "depth")
    region = region or first(row, "region")
    label = label or first(row, "label")
    unit = unit or first(row, "unit")
    season = season or first(row, "season")

    start = first(row, "start_year")
    end = first(row, "end_year")

    if pd.isna(start) or pd.isna(end):
        start, end = parse_years(first(row, "period"))

    n_years = first(row, "n_years")
    if pd.isna(n_years):
        n_years = END_YEAR - START_YEAR + 1

    p_value = first(row, *p_columns)
    fdr_q = first(row, *fdr_columns)

    if pd.notna(fdr_q):
        significant = bool(float(fdr_q) < 0.05)
        basis = "FDR-adjusted p-value"
    elif pd.notna(p_value):
        significant = bool(float(p_value) < 0.05)
        basis = significance_basis or p_method
    else:
        significant = np.nan
        basis = "Not available"

    rows.append({
        "comparison": comparison,
        "result_type": result_type,
        "region": region,
        "variable": variable,
        "label": label,
        "unit": unit,
        "season": season,
        "start_year": start,
        "end_year": end,
        "n_years": n_years,
        "mean": first(row, *mean_columns),
        "sen_slope_per_year": first(row, *slope_columns),
        "slope_ci_lower": first(row, *ci_lower_columns),
        "slope_ci_upper": first(row, *ci_upper_columns),
        "kendall_tau": first(row, *tau_columns),
        "p_value": p_value,
        "p_value_method": p_method,
        "fdr_q": fdr_q,
        "significant_05": significant,
        "significance_basis": basis,
        "difference_definition": (
            difference_definition
            if difference_definition is not None
            else first(row, "difference_definition")
        ),
        "source_file": filename
    })


def read(filename):
    path = RESULTS / filename
    if not path.exists():
        raise FileNotFoundError(path)
    return pd.read_csv(path)


# -------------------------------------------------
# 1. BASIN-WIDE RESULTS
# -------------------------------------------------

basin_configs = [
    {
        "file": "indus_precipitation_trend.csv",
        "variable": "precipitation_mm",
        "label": "JJAS precipitation",
        "unit": "mm/year",
        "season": "JJAS",
        "slope": ["sen_slope_mm_per_year"],
        "mean": ["mean_precipitation_mm"],
        "p": ["mk_p_value"],
        "tau": ["kendall_tau"],
        "lower": ["slope_ci_lower"],
        "upper": ["slope_ci_upper"]
    },
    {
        "file": "indus_lst_trend.csv",
        "variable": "lst_c",
        "label": "Land surface temperature",
        "unit": "Â°C/year",
        "season": "JJAS",
        "slope": ["sen_slope_celsius_per_year"],
        "mean": ["mean_celsius"],
        "p": ["mk_p_value"],
        "tau": ["mk_tau"],
        "lower": ["sen_ci_lower"],
        "upper": ["sen_ci_upper"]
    },
    {
        "file": "indus_runoff_trend.csv",
        "variable": None,
        "label": None,
        "unit": "mm/year",
        "season": "JJAS",
        "slope": ["sen_slope_mm_per_year"],
        "mean": ["mean_mm"],
        "p": ["mk_p_value"],
        "tau": ["mk_tau"],
        "lower": ["sen_ci_lower"],
        "upper": ["sen_ci_upper"]
    },
    {
        "file": "indus_rx1day_trend.csv",
        "variable": "rx1day_mm",
        "label": "Maximum one-day precipitation",
        "unit": "mm/year",
        "season": "JJAS",
        "slope": ["sen_slope_mm_per_year"],
        "mean": ["mean_rx1day_mm"],
        "p": ["mk_p"],
        "tau": ["mk_tau"]
    },
    {
        "file": "indus_snow_cover_trend.csv",
        "variable": "snow_index",
        "label": "NDSI snow-cover index",
        "unit": "index/year",
        "season": "Mayâ€“September",
        "slope": ["sen_slope_per_year"],
        "mean": ["mean"],
        "p": ["mk_p_value"],
        "tau": ["mk_tau"],
        "lower": ["sen_slope_ci_lower"],
        "upper": ["sen_slope_ci_upper"]
    },
    {
        "file": "indus_soil_moisture_trend.csv",
        "variable": None,
        "label": None,
        "unit": "mÂ³/mÂ³/year",
        "season": "JJAS",
        "slope": ["sen_slope_m3_m3_per_year"],
        "mean": ["mean_m3_m3"],
        "p": ["mk_p"],
        "tau": ["mk_tau"]
    },
    {
        "file": "indus_swe_trend.csv",
        "variable": "swe_mm",
        "label": "Snow water equivalent",
        "unit": "mm/year",
        "season": "Mayâ€“September",
        "slope": ["sen_slope_mm_per_year"],
        "mean": ["mean_swe_mm"],
        "p": ["mk_p"],
        "tau": ["mk_tau"]
    }
]

for config in basin_configs:
    filename = config["file"]
    df = read(filename)

    for _, row in df.iterrows():
        add_row(
            row,
            filename=filename,
            comparison="Basin-wide",
            result_type="regional_trend",
            region="Indus Basin",
            variable=config["variable"],
            label=config["label"],
            unit=config["unit"],
            season=config["season"],
            slope_columns=config["slope"],
            mean_columns=config["mean"],
            p_columns=config["p"],
            p_method="Original Mann-Kendall",
            ci_lower_columns=config.get("lower", []),
            ci_upper_columns=config.get("upper", []),
            tau_columns=config["tau"]
        )


# -------------------------------------------------
# 2. REGIONAL COMPARISONS
# -------------------------------------------------

regional_configs = [
    (
        "Punjab vs Sindh",
        "punjab_sindh_unified_trends.csv",
        "regional_trend"
    ),
    (
        "Punjab vs Sindh",
        "punjab_sindh_difference_trends.csv",
        "difference_trend"
    ),
    (
        "Upper vs Lower Indus",
        "upper_lower_unified_trends.csv",
        "regional_trend"
    ),
    (
        "Upper vs Lower Indus",
        "upper_lower_difference_trends_fdr.csv",
        "difference_trend"
    ),
    (
        "High vs Low Elevation",
        "high_low_elevation_regional_trends.csv",
        "regional_trend"
    ),
    (
        "High vs Low Elevation",
        "high_low_elevation_difference_trends_fdr.csv",
        "difference_trend"
    )
]

for comparison, filename, result_type in regional_configs:
    df = read(filename)

    for _, row in df.iterrows():
        add_row(
            row,
            filename=filename,
            comparison=comparison,
            result_type=result_type,
            region=(
                None if result_type == "regional_trend"
                else "Regional difference"
            ),
            slope_columns=["sen_slope_per_year"],
            mean_columns=["mean"],
            p_columns=["yue_wang_lag1_p"],
            p_method="Yue-Wang lag-1 adjusted Mann-Kendall",
            ci_lower_columns=["slope_ci_lower"],
            ci_upper_columns=["slope_ci_upper"],
            tau_columns=["kendall_tau"],
            fdr_columns=["fdr_bh_q", "fdr_bh_p"],
            significance_basis="Autocorrelation-adjusted p-value"
        )


# -------------------------------------------------
# 3. SAVE AND VALIDATE
# -------------------------------------------------

master = pd.DataFrame(rows, columns=COLUMNS)

# Standardize original FLDAS soil moisture band names
soil_names = {"SoilMoi00_10cm_tavg": "soil_0_10", "SoilMoi10_40cm_tavg": "soil_10_40", "SoilMoi40_100cm_tavg": "soil_40_100", "SoilMoi100_200cm_tavg": "soil_100_200"}
master["variable"] = master["variable"].replace(soil_names)

numeric_columns = [
    "start_year", "end_year", "n_years", "mean",
    "sen_slope_per_year", "slope_ci_lower",
    "slope_ci_upper", "kendall_tau",
    "p_value", "fdr_q"
]

for column in numeric_columns:
    master[column] = pd.to_numeric(master[column], errors="coerce")

if master.empty:
    raise ValueError("No scientific results were loaded.")

if master["sen_slope_per_year"].isna().any():
    raise ValueError("Some rows have missing Sen slopes.")

if master["p_value"].isna().any():
    raise ValueError("Some rows have missing p-values.")

if ((master["p_value"] < 0) | (master["p_value"] > 1)).any():
    raise ValueError("Invalid p-values detected.")

duplicates = master.duplicated(
    subset=["comparison", "result_type", "region", "variable"]
)

if duplicates.any():
    print("\nWARNING: Potential duplicate result rows:")
    print(master.loc[
        duplicates,
        ["comparison", "result_type", "region", "variable"]
    ].to_string(index=False))

master = master.sort_values(
    ["comparison", "result_type", "region", "variable"],
    na_position="last"
).reset_index(drop=True)

master.to_csv(OUTPUT, index=False, encoding="utf-8-sig")

print("\nMASTER SCIENTIFIC RESULTS CREATED")
print("File:", OUTPUT)
print("Total rows:", len(master))

print("\nRows by comparison and result type:")
print(
    master.groupby(
        ["comparison", "result_type"]
    ).size().to_string()
)

print("\nSignificant trends:")
print(
    master.groupby(
        ["comparison", "result_type"]
    )["significant_05"].sum().to_string()
)

print("\nMissing values:")
print(
    master[
        ["sen_slope_per_year", "p_value"]
    ].isna().sum().to_string()
)

print("\nDone.")
