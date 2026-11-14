
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
import matplotlib.pyplot as plt
from scipy.stats import theilslopes

# Project paths
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"

RESULTS.mkdir(exist_ok=True)
FIGURES.mkdir(exist_ok=True)

# Load annual MODIS snow-cover data
df = pd.read_csv(
    DATA / "indus_may_sep_snow_2001_2025.csv"
)

df = df.sort_values("year").reset_index(drop=True)

years = df["year"].to_numpy(dtype=int)
snow = df["snow_cover_mean"].to_numpy(dtype=float)

# Validate observations
assert len(df) == 25, "Expected 25 annual records"
assert np.array_equal(
    years, np.arange(2001, 2026)
), "Year range is incomplete"
assert np.isfinite(snow).all(), "Missing snow values"
assert ((snow >= 0) & (snow <= 100)).all(), "Invalid snow values"

# Mann-Kendall trend test
mk_result = mk.original_test(snow)

# Sen's slope and 95% confidence interval
slope, intercept, lower, upper = theilslopes(
    snow, years, alpha=0.95
)

# Lag-1 autocorrelation
lag1 = np.corrcoef(snow[:-1], snow[1:])[0, 1]

# Save statistical results
results = pd.DataFrame([{
    "variable": "MODIS NDSI Snow Cover",
    "season": "May-September",
    "start_year": 2001,
    "end_year": 2025,
    "mean": snow.mean(),
    "mk_trend": mk_result.trend,
    "mk_p_value": mk_result.p,
    "mk_tau": mk_result.Tau,
    "sen_slope_per_year": slope,
    "sen_slope_ci_lower": lower,
    "sen_slope_ci_upper": upper,
    "lag1_autocorrelation": lag1,
    "significant_0_05": mk_result.p < 0.05
}])

results.to_csv(
    RESULTS / "indus_snow_cover_trend.csv",
    index=False
)

# Plot annual values and Sen's slope line
trend_line = intercept + slope * years

plt.figure(figsize=(11, 5.5))
plt.plot(
    years, snow,
    marker="o",
    linewidth=1.8,
    label="Annual May-Sep mean"
)
plt.plot(
    years, trend_line,
    linestyle="--",
    linewidth=2,
    label="Sen's slope trend"
)

plt.xlabel("Year")
plt.ylabel("Mean MODIS NDSI Snow Cover value")
plt.title("Indus Basin: May-September Snow Cover (2001-2025)")
plt.xticks(np.arange(2001, 2026, 2), rotation=45)
plt.grid(alpha=0.25)
plt.legend()
plt.tight_layout()

plt.savefig(
    FIGURES / "indus_may_sep_snow_timeseries.png",
    dpi=300
)
plt.close()

# Display results
print("\nSNOW COVER TREND ANALYSIS")
print("-" * 40)
print(f"Mean snow-cover index: {snow.mean():.4f}")
print(f"Mann-Kendall trend: {mk_result.trend}")
print(f"Mann-Kendall p-value: {mk_result.p:.6f}")
print(f"Kendall tau: {mk_result.Tau:.6f}")
print(f"Sen's slope: {slope:.6f} units/year")
print(f"95% CI: [{lower:.6f}, {upper:.6f}]")
print(f"Lag-1 autocorrelation: {lag1:.6f}")
print(f"Statistically significant: {mk_result.p < 0.05}")
print("\nCSV and figure saved successfully.")
