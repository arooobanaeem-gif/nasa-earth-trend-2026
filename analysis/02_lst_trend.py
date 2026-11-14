
from pathlib import Path
import pandas as pd
import numpy as np
import pymannkendall as mk
from scipy.stats import theilslopes

# Project directories
ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data" / "indus_jjas_lst_2001_2025.csv"
OUTPUT = ROOT / "results" / "indus_lst_trend.csv"

# Read annual MODIS LST data
df = pd.read_csv(INPUT).sort_values("year")

years = df["year"].to_numpy(dtype=int)
lst = df["lst_celsius"].to_numpy(dtype=float)

# Validate data
assert len(df) == 25, "Expected 25 annual observations"
assert np.array_equal(years, np.arange(2001, 2026)), "Missing years"
assert np.isfinite(lst).all(), "Invalid LST values"

# Mann-Kendall trend test
result = mk.original_test(lst)

# Theil-Sen slope and confidence interval
slope, intercept, lower, upper = theilslopes(
    lst, years, alpha=0.95
)

# Lag-1 autocorrelation
lag1 = np.corrcoef(lst[:-1], lst[1:])[0, 1]

# Save results
summary = pd.DataFrame([{
    "period": "2001-2025",
    "season": "JJAS",
    "variable": "MODIS daytime LST",
    "mean_celsius": float(np.mean(lst)),
    "mk_trend": result.trend,
    "mk_p_value": float(result.p),
    "mk_tau": float(result.Tau),
    "sen_slope_celsius_per_year": float(slope),
    "sen_ci_lower": float(lower),
    "sen_ci_upper": float(upper),
    "lag1_autocorrelation": float(lag1)
}])

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
summary.to_csv(OUTPUT, index=False)

print(summary.to_string(index=False))
print("\nSaved:", OUTPUT)
