
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
import matplotlib.pyplot as plt

# NASA Space Apps Challenge 2026
# Variable 6: Snow Water Equivalent (SWE)
# Indus River Basin | May–September 2001–2025

ROOT = Path(__file__).resolve().parents[1]

INPUT = ROOT / "data/indus_may_sep_swe_2001_2025.csv"
OUTPUT = ROOT / "results/indus_swe_trend.csv"
FIGURE = ROOT / "results/figures/indus_may_sep_swe_timeseries.png"

df = pd.read_csv(INPUT)
df["year"] = df["year"].astype(int)
df = df.sort_values("year")

assert len(df) == 25
assert df["year"].tolist() == list(range(2001, 2026))
assert df["SWE_inst"].notna().all()

years = df["year"].to_numpy()
values = df["SWE_inst"].to_numpy(dtype=float)

# Mann–Kendall trend tests
original = mk.original_test(values)
tfpw = mk.trend_free_pre_whitening_modification_test(values)

# Sen's slope
sen = mk.sens_slope(values)
slope = float(sen.slope)
intercept = float(sen.intercept)

# Autocorrelation diagnostics
raw_lag1 = float(
    np.corrcoef(values[:-1], values[1:])[0, 1]
)

detrended = values - slope * np.arange(len(values))

detrended_lag1 = float(
    np.corrcoef(detrended[:-1], detrended[1:])[0, 1]
)

# Sen trend line
fitted = intercept + slope * np.arange(len(values))

result = {
    "variable": "Snow Water Equivalent",
    "season": "May–September",
    "period": "2001–2025",
    "mean_swe_mm": float(np.mean(values)),
    "min_swe_mm": float(np.min(values)),
    "max_swe_mm": float(np.max(values)),
    "mk_trend": original.trend,
    "mk_p": original.p,
    "mk_tau": original.Tau,
    "sen_slope_mm_per_year": slope,
    "sen_intercept": intercept,
    "tfpw_trend": tfpw.trend,
    "tfpw_p": tfpw.p,
    "raw_lag1": raw_lag1,
    "detrended_lag1": detrended_lag1,
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
FIGURE.parent.mkdir(parents=True, exist_ok=True)

pd.DataFrame([result]).to_csv(OUTPUT, index=False)

# Plot
fig, ax = plt.subplots(figsize=(11, 6))

ax.plot(
    years, values,
    marker="o",
    linewidth=1.8,
    color="#2563eb",
    label="Annual May–September mean SWE"
)

ax.plot(
    years, fitted,
    linestyle="--",
    linewidth=2,
    color="#dc2626",
    label="Sen's slope trend"
)

ax.set_title(
    "Indus River Basin | Snow Water Equivalent (2001–2025)\n"
    f"Sen's slope: {slope:+.4f} mm/year | "
    f"MK p={original.p:.4f} | TFPW p={tfpw.p:.4f}",
    fontsize=13,
    fontweight="bold"
)

ax.set_xlabel("Year")
ax.set_ylabel("Mean May–September SWE (mm)")
ax.grid(alpha=0.25)
ax.legend()

fig.tight_layout()
fig.savefig(FIGURE, dpi=220, bbox_inches="tight")
plt.close(fig)

print("\nSWE TREND RESULTS")
print("=" * 70)
print(f"Mean SWE:          {result['mean_swe_mm']:.6f} mm")
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
