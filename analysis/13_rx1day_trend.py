
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
import matplotlib.pyplot as plt

# NASA Space Apps Challenge 2026
# Variable 7: Extreme Precipitation (Rx1day)
# Indus River Basin | JJAS 2001–2025
#
# Metric: Basin mean of pixel-wise seasonal maximum
# daily precipitation (UTC calendar days).

ROOT = Path(__file__).resolve().parents[1]

INPUT = ROOT / "data/indus_jjas_rx1day_2001_2025.csv"
OUTPUT = ROOT / "results/indus_rx1day_trend.csv"
FIGURE = ROOT / "results/figures/indus_jjas_rx1day_timeseries.png"

# 1. Load and validate
df = pd.read_csv(INPUT)

df["year"] = df["year"].astype(int)
df = df.sort_values("year").reset_index(drop=True)

assert len(df) == 25
assert df["year"].tolist() == list(range(2001, 2026))
assert df["rx1day_mm"].notna().all()
assert (df["jjas_days"] == 122).all()
assert (df["incomplete_days"] == 0).all()

years = df["year"].to_numpy()
values = df["rx1day_mm"].to_numpy(dtype=float)

# 2. Mann–Kendall tests
original = mk.original_test(values)
tfpw = mk.trend_free_pre_whitening_modification_test(values)

# 3. Sen's slope
sen = mk.sens_slope(values)
slope = float(sen.slope)
intercept = float(sen.intercept)

# 4. Lag-1 autocorrelation
raw_lag1 = float(
    np.corrcoef(values[:-1], values[1:])[0, 1]
)

detrended = values - slope * np.arange(len(values))

detrended_lag1 = float(
    np.corrcoef(detrended[:-1], detrended[1:])[0, 1]
)

# 5. Sen trend line
fitted = intercept + slope * np.arange(len(values))

# 6. Save statistics
result = {
    "variable": "Extreme Precipitation (Rx1day)",
    "season": "June–September",
    "period": "2001–2025",
    "metric": "Basin mean of pixel-wise JJAS Rx1day",
    "mean_rx1day_mm": float(np.mean(values)),
    "min_rx1day_mm": float(np.min(values)),
    "max_rx1day_mm": float(np.max(values)),
    "mk_trend": original.trend,
    "mk_p": float(original.p),
    "mk_tau": float(original.Tau),
    "sen_slope_mm_per_year": slope,
    "sen_intercept": intercept,
    "tfpw_trend": tfpw.trend,
    "tfpw_p": float(tfpw.p),
    "raw_lag1": raw_lag1,
    "detrended_lag1": detrended_lag1,
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
FIGURE.parent.mkdir(parents=True, exist_ok=True)

pd.DataFrame([result]).to_csv(OUTPUT, index=False)

# 7. Plot annual Rx1day
fig, ax = plt.subplots(figsize=(11, 6))

ax.plot(
    years,
    values,
    marker="o",
    linewidth=1.8,
    color="#2563eb",
    label="Annual basin mean Rx1day"
)

ax.plot(
    years,
    fitted,
    linestyle="--",
    linewidth=2,
    color="#dc2626",
    label="Sen's slope trend"
)

# Highlight major flood years for context only
for year in [2010, 2022, 2025]:
    ax.axvline(
        year,
        color="#888888",
        linestyle=":",
        alpha=0.55
    )

ax.set_title(
    "Indus River Basin | Extreme Precipitation (Rx1day)\n"
    "June–September 2001–2025 | "
    f"Sen slope: {slope:+.3f} mm/year | "
    f"MK p={original.p:.4f}",
    fontsize=13,
    fontweight="bold"
)

ax.set_xlabel("Year")
ax.set_ylabel("Basin mean of pixel-wise Rx1day (mm)")
ax.grid(alpha=0.25)
ax.legend()

fig.tight_layout()

fig.savefig(
    FIGURE,
    dpi=220,
    bbox_inches="tight"
)

plt.close(fig)

# 8. Print results
print("\nRX1DAY TREND RESULTS")
print("=" * 70)

print(f"Mean Rx1day:       {result['mean_rx1day_mm']:.6f} mm")
print(f"Minimum Rx1day:    {result['min_rx1day_mm']:.6f} mm")
print(f"Maximum Rx1day:    {result['max_rx1day_mm']:.6f} mm")
print(f"MK trend:          {original.trend}")
print(f"MK p-value:        {original.p:.6f}")
print(f"Kendall tau:       {original.Tau:+.6f}")
print(f"Sen slope:         {slope:+.6f} mm/year")
print(f"TFPW trend:        {tfpw.trend}")
print(f"TFPW p-value:      {tfpw.p:.6f}")
print(f"Raw lag-1:         {raw_lag1:+.6f}")
print(f"Detrended lag-1:   {detrended_lag1:+.6f}")

print("\nSaved:", OUTPUT)
print("Saved:", FIGURE)
