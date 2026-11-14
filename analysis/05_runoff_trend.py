
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import pymannkendall as mk
from scipy.stats import theilslopes

# ==========================================
# NASA SPACE APPS 2026
# Variable 4: FLDAS Runoff Temporal Trends
# ==========================================

ROOT = Path(__file__).resolve().parents[1]

INPUT = ROOT / "data" / "indus_jjas_runoff_2001_2025.csv"
OUTPUT = ROOT / "results" / "indus_runoff_trend.csv"
FIGURE = ROOT / "results" / "figures" / "indus_jjas_runoff_timeseries.png"

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
FIGURE.parent.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(INPUT)
df.columns = df.columns.str.strip()

variables = {
    "surface_runoff_mm": "Surface runoff",
    "subsurface_runoff_mm": "Subsurface runoff",
    "total_runoff_mm": "Total runoff"
}

required = ["year"] + list(variables)

if not set(required).issubset(df.columns):
    raise ValueError(
        f"Missing columns: {set(required) - set(df.columns)}"
    )

df = df.sort_values("year").reset_index(drop=True)

if len(df) != 25 or df["year"].tolist() != list(range(2001, 2026)):
    raise ValueError("Expected exactly 25 annual records: 2001–2025.")

if df[required].isna().any().any():
    raise ValueError("Missing values found in runoff data.")

if (df[list(variables)] < 0).any().any():
    raise ValueError("Negative runoff depths found.")

if not np.allclose(
    df["surface_runoff_mm"] + df["subsurface_runoff_mm"],
    df["total_runoff_mm"],
    rtol=1e-5,
    atol=1e-5
):
    raise ValueError("Total runoff does not match surface + subsurface.")

results = []

fig, axes = plt.subplots(3, 1, figsize=(11, 11), sharex=True)

for ax, (column, label) in zip(axes, variables.items()):
    years = df["year"].to_numpy(dtype=float)
    values = df[column].to_numpy(dtype=float)

    test = mk.original_test(values)
    slope, intercept, lower, upper = theilslopes(
        values, years, alpha=0.95
    )

    lag1 = float(np.corrcoef(values[:-1], values[1:])[0, 1]) \
        if np.std(values[:-1]) > 0 and np.std(values[1:]) > 0 \
        else np.nan

    results.append({
        "variable": column,
        "mean_mm": np.mean(values),
        "mk_trend": test.trend,
        "mk_p_value": test.p,
        "mk_tau": test.Tau,
        "sen_slope_mm_per_year": slope,
        "sen_ci_lower": lower,
        "sen_ci_upper": upper,
        "lag1_autocorrelation": lag1,
        "significant_0_05": test.p < 0.05
    })

    ax.plot(years, values, marker="o", linewidth=1.5)
    ax.plot(
        years,
        intercept + slope * years,
        linestyle="--",
        linewidth=1.5,
        label=f"Sen slope: {slope:+.3f} mm/year"
    )

    ax.set_title(f"{label} | MK p = {test.p:.4f}")
    ax.set_ylabel("JJAS runoff (mm)")
    ax.legend()
    ax.grid(alpha=0.25)

axes[-1].set_xlabel("Year")
axes[-1].set_xticks(np.arange(2001, 2026, 2))

fig.suptitle(
    "Indus Basin | FLDAS JJAS Runoff Trends (2001–2025)",
    fontsize=14
)

plt.tight_layout()
plt.savefig(FIGURE, dpi=200, bbox_inches="tight")
plt.close()

result_df = pd.DataFrame(results)
result_df.to_csv(OUTPUT, index=False)

print("\nRUNOFF TEMPORAL TREND RESULTS")
print(result_df.to_string(index=False))
print(f"\nSaved statistics: {OUTPUT}")
print(f"Saved figure: {FIGURE}")
