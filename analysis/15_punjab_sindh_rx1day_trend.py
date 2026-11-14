
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy.stats import theilslopes

# Project paths
ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "punjab_sindh_rx1day_2001_2025.csv"
OUTPUT = ROOT / "results" / "punjab_sindh_rx1day_trend.csv"

df = pd.read_csv(INPUT)

# Validate the dataset before analysis
assert len(df) == 50, "Expected 50 regional records"
assert not df.isna().any().any(), "Missing values detected"
assert not df.duplicated(["year", "region"]).any()
assert (df["incomplete_days"] == 0).all()
assert (df["jjas_days"] == 122).all()

results = []

for region in ["Punjab", "Sindh"]:
    subset = (
        df[df["region"] == region]
        .sort_values("year")
    )

    years = subset["year"].to_numpy()
    values = subset["rx1day_mm"].to_numpy()

    assert len(values) == 25
    assert np.array_equal(years, np.arange(2001, 2026))

    original = mk.original_test(values)

    # Yue-Wang lag-1 variance-adjusted MK test
    adjusted = mk.yue_wang_modification_test(
        values, lag=1
    )

    sen = theilslopes(values, years, 0.95)

    lag1 = np.corrcoef(
        values[:-1], values[1:]
    )[0, 1]

    results.append({
        "region": region,
        "n_years": len(values),
        "mean_rx1day_mm": values.mean(),
        "sen_slope_mm_per_year": sen.slope,
        "slope_ci_lower": sen.low_slope,
        "slope_ci_upper": sen.high_slope,
        "kendall_tau": original.Tau,
        "original_mk_p": original.p,
        "yue_wang_lag1_p": adjusted.p,
        "lag1_autocorrelation": lag1
    })

output_df = pd.DataFrame(results)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
output_df.to_csv(OUTPUT, index=False)

print(output_df.to_string(index=False))
print(f"\nSaved: {OUTPUT}")
