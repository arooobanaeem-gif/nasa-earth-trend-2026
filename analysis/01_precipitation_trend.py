
from pathlib import Path
import pandas as pd
import pymannkendall as mk
from scipy.stats import theilslopes

# Project paths
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RESULTS = ROOT / "results"
RESULTS.mkdir(exist_ok=True)

# Load and validate annual precipitation
df = pd.read_csv(
    DATA / "indus_jjas_precipitation_2001_2025.csv"
).sort_values("year")

assert len(df) == 25, "Expected 25 annual records"
assert df["year"].astype(int).tolist() == list(range(2001, 2026))
assert df[["year", "precipitation_mm"]].notna().all().all()

years = df["year"].to_numpy()
rainfall = df["precipitation_mm"].to_numpy()

# Mann-Kendall trend test
mk_result = mk.original_test(rainfall)

# Sen's slope and 95% confidence interval
slope, intercept, lower, upper = theilslopes(
    rainfall, years, 0.95
)

# Save results
summary = pd.DataFrame([{
    "region": "Indus Basin",
    "variable": "JJAS precipitation",
    "start_year": 2001,
    "end_year": 2025,
    "mean_precipitation_mm": rainfall.mean(),
    "mk_trend": mk_result.trend,
    "mk_p_value": mk_result.p,
    "kendall_tau": mk_result.Tau,
    "sen_slope_mm_per_year": slope,
    "slope_ci_lower": lower,
    "slope_ci_upper": upper,
    "significant_at_0_05": bool(mk_result.p < 0.05)
}])

output = RESULTS / "indus_precipitation_trend.csv"
summary.to_csv(output, index=False)

print("\INDUS BASIN JJAS TREND (2001-2025)")
print(summary.to_string(index=False))
print("\nSaved to:", output)
print("Note: Temporal autocorrelation has not yet been assessed.")


# Lag-1 temporal autocorrelation diagnostic
import numpy as np

lag1_autocorr = pd.Series(rainfall).autocorr(lag=1)

print("\nTEMPORAL AUTOCORRELATION")
print("Lag-1 autocorrelation:", round(lag1_autocorr, 4))

# Save diagnostic separately
autocorr_output = RESULTS / "indus_precipitation_autocorrelation.csv"

pd.DataFrame([{
    "region": "Indus Basin",
    "variable": "JJAS precipitation",
    "lag": 1,
    "autocorrelation": lag1_autocorr
}]).to_csv(autocorr_output, index=False)

print("Saved to:", autocorr_output)
