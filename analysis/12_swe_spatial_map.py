
from pathlib import Path

import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

# NASA Space Apps Challenge 2026
# Spatial SWE trend map | Indus Basin | 2001–2025

ROOT = Path(__file__).resolve().parents[1]

INPUT = ROOT / "data/indus_may_sep_swe_sen_slope_qc_2001_2025.tif"
OUTPUT = ROOT / "results/figures/indus_may_sep_swe_spatial_trend.png"

with rasterio.open(INPUT) as src:
    slope = src.read(1).astype(float)
    bounds = src.bounds
    nodata = src.nodata

invalid = ~np.isfinite(slope)

if nodata is not None:
    invalid |= slope == nodata

slope = np.ma.array(slope, mask=invalid)

fig, ax = plt.subplots(figsize=(11, 8))

cmap = plt.get_cmap("RdBu").copy()
cmap.set_bad("#f0f0f0")

im = ax.imshow(
    slope,
    extent=[
        bounds.left,
        bounds.right,
        bounds.bottom,
        bounds.top
    ],
    origin="upper",
    cmap=cmap,
    norm=TwoSlopeNorm(vmin=-2, vcenter=0, vmax=2),
    interpolation="nearest"
)

cbar = fig.colorbar(
    im,
    ax=ax,
    fraction=0.035,
    pad=0.025,
    extend="both"
)

cbar.set_label("Sen's slope (mm/year)")

ax.set_title(
    "Indus River Basin | Snow Water Equivalent Trend\n"
    "May–September 2001–2025 | FLDAS Noah",
    fontsize=14,
    fontweight="bold",
    pad=15
)

ax.set_xlabel("Longitude (°E)")
ax.set_ylabel("Latitude (°N)")

ax.text(
    0.5,
    -0.12,
    "Pixel-wise Sen's slope; ≥20 valid annual observations. "
    "Colors saturate beyond ±2 mm/year.\n"
    "Extreme modelled SWE values require independent validation.",
    transform=ax.transAxes,
    ha="center",
    va="top",
    fontsize=9,
    color="#555555"
)

ax.set_aspect("equal")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

fig.savefig(
    OUTPUT,
    dpi=250,
    bbox_inches="tight"
)

plt.close(fig)

print("SWE spatial map saved:")
print(OUTPUT)
print("Original GeoTIFF preserved.")
