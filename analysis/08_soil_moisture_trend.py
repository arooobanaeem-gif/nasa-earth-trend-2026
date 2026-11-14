
from pathlib import Path

import numpy as np
import pandas as pd
import pymannkendall as mk
import matplotlib.pyplot as plt

# NASA Space Apps Challenge 2026
# Variable 5: FLDAS JJAS Soil Moisture
# Indus River Basin, 2001–2025

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data/indus_jjas_soil_moisture_2001_2025.csv"
OUTPUT = ROOT / "results/indus_soil_moisture_trend.csv"
FIGURE = ROOT / "results/figures/indus_jjas_soil_moisture_timeseries.png"

LAYERS = {
    "SoilMoi00_10cm_tavg": "0–10 cm",
    "SoilMoi10_40cm_tavg": "10–40 cm",
    "SoilMoi40_100cm_tavg": "40–100 cm",
    "SoilMoi100_200cm_tavg": "100–200 cm",
}

df = pd.read_csv(INPUT)
df["year"] = df["year"].astype(int)
df = df.sort_values("year")

assert len(df) == 25
assert df["year"].tolist() == list(range(2001, 2026))
assert not df[["year", *LAYERS]].isna().any().any()

years = df["year"].to_numpy()
results = []

fig, axes = plt.subplots(
    2, 2, figsize=(13, 9), sharex=True
)

for ax, (column, depth) in zip(axes.flat, LAYERS.items()):
    values = df[column].to_numpy(dtype=float)

    original = mk.original_test(values)
    tfpw = mk.trend_free_pre_whitening_modification_test(values)

    sen = mk.sens_slope(values)
    slope = float(sen.slope)
    intercept = float(sen.intercept)

    # Lag-1 autocorrelation of the original series
    lag1 = float(np.corrcoef(values[:-1], values[1:])[0, 1])

    # Lag-1 autocorrelation after removing Sen's slope
    detrended = values - slope * np.arange(len(values))
    detrended_lag1 = float(
        np.corrcoef(detrended[:-1], detrended[1:])[0, 1]
    )

    fitted = intercept + slope * np.arange(len(values))

    results.append({
        "depth": depth,
        "band": column,
        "mean_m3_m3": np.mean(values),
        "mk_trend": original.trend,
        "mk_p": original.p,
        "mk_tau": original.Tau,
        "sen_slope_m3_m3_per_year": slope,
        "sen_intercept": intercept,
        "tfpw_p": tfpw.p,
        "tfpw_trend": tfpw.trend,
        "raw_lag1": lag1,
        "detrended_lag1": detrended_lag1,
    })

    ax.plot(
        years, values,
        color="#2563eb", marker="o",
        markersize=4, linewidth=1.5,
        label="Annual JJAS mean"
    )

    ax.plot(
        years, fitted,
        color="#dc2626", linestyle="--",
        linewidth=2, label="Sen's slope"
    )

    ax.set_title(
        f"{depth} | Sen: {slope:+.5f}/year\n"
        f"MK p={original.p:.4f} | TFPW p={tfpw.p:.4f}"
    )
    ax.set_ylabel("Soil moisture (m³/m³)")
    ax.grid(alpha=0.25)
    ax.legend(fontsize=8)

for ax in axes[-1]:
    ax.set_xlabel("Year")

fig.suptitle(
    "Indus Basin | JJAS Soil Moisture Trends (2001–2025)\n"
    "NASA FLDAS Noah — Four Soil Layers",
    fontsize=15, fontweight="bold"
)

fig.tight_layout(rect=[0, 0, 1, 0.92])

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
FIGURE.parent.mkdir(parents=True, exist_ok=True)

pd.DataFrame(results).to_csv(OUTPUT, index=False)
fig.savefig(FIGURE, dpi=220, bbox_inches="tight")
plt.close(fig)

print("\nSOIL MOISTURE TREND RESULTS")
print("=" * 95)

for r in results:
    print(
        f"{r['depth']:>10} | "
        f"Mean={r['mean_m3_m3']:.5f} | "
        f"Sen={r['sen_slope_m3_m3_per_year']:+.6f}/yr | "
        f"MK p={r['mk_p']:.6f} | "
        f"TFPW p={r['tfpw_p']:.6f} | "
        f"Raw lag1={r['raw_lag1']:+.3f} | "
        f"Detrended lag1={r['detrended_lag1']:+.3f}"
    )

print("\nSaved:", OUTPUT)
print("Saved:", FIGURE)
