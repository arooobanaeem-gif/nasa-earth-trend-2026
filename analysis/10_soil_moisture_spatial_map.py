
from pathlib import Path

import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

# NASA Space Apps Challenge 2026
# Variable 5: FLDAS Spatial Soil Moisture Trends
# Indus River Basin | JJAS 2001–2025

ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / (
    "data/"
    "indus_jjas_soil_moisture_sen_slope_qc_2001_2025_clean.tif"
)

OUTPUT = ROOT / (
    "results/figures/"
    "indus_jjas_soil_moisture_spatial_trend.png"
)

DEPTHS = [
    "0–10 cm",
    "10–40 cm",
    "40–100 cm",
    "100–200 cm",
]

with rasterio.open(SOURCE) as src:
    bounds = src.bounds
    extent = [
        bounds.left,
        bounds.right,
        bounds.bottom,
        bounds.top,
    ]

    arrays = [
        src.read(i, masked=True).filled(np.nan)
        for i in range(1, 5)
    ]

fig, axes = plt.subplots(
    2, 2,
    figsize=(14, 11),
    sharex=True,
    sharey=True
)

for i, (ax, data, depth) in enumerate(
    zip(axes.flat, arrays, DEPTHS)
):
    valid = data[np.isfinite(data)]

    # Robust, symmetric limits to reduce outlier effects
    limit = float(np.percentile(np.abs(valid), 98))
    limit = max(limit, 1e-6)

    norm = TwoSlopeNorm(
        vmin=-limit,
        vcenter=0,
        vmax=limit
    )

    image = ax.imshow(
        data,
        extent=extent,
        origin="upper",
        cmap="RdBu",
        norm=norm,
        interpolation="nearest"
    )

    ax.set_title(
        f"{depth} Soil Moisture\n"
        f"Mean slope: {valid.mean():+.5f} m³/m³/year",
        fontsize=12,
        fontweight="bold"
    )

    ax.set_xlabel("Longitude (°E)")
    ax.set_ylabel("Latitude (°N)")

    ax.grid(
        alpha=0.18,
        linestyle="--"
    )

    cbar = fig.colorbar(
        image,
        ax=ax,
        orientation="horizontal",
        fraction=0.046,
        pad=0.09
    )

    cbar.set_label(
        "Sen's slope (m³/m³/year)",
        fontsize=9
    )

fig.suptitle(
    "Indus River Basin | Spatial Soil Moisture Trends\n"
    "NASA FLDAS Noah | JJAS 2001–2025",
    fontsize=16,
    fontweight="bold",
    y=0.99
)

fig.tight_layout(
    rect=[0, 0.06, 1, 0.94],
    h_pad=2.0,
    w_pad=1.5
)

fig.text(
    0.5,
    0.015,
    "Blue = increasing soil moisture | "
    "Red = decreasing soil moisture | "
    "QC: ≥20 valid years | "
    "Pixel-wise Sen's slope (not significance)",
    ha="center",
    fontsize=10
)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

fig.savefig(
    OUTPUT,
    dpi=220,
    bbox_inches="tight"
)

plt.close(fig)

print("Saved:", OUTPUT)

for depth, data in zip(DEPTHS, arrays):
    valid = data[np.isfinite(data)]
    print(
        f"{depth:>10} | "
        f"Valid pixels: {valid.size} | "
        f"Mean slope: {valid.mean():+.6f} | "
        f"Min: {valid.min():+.6f} | "
        f"Max: {valid.max():+.6f}"
    )
