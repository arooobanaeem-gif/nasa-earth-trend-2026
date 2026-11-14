
from pathlib import Path

import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

# NASA Space Apps Challenge 2026
# Variable 7: Spatial Extreme Precipitation Trend
# Indus River Basin | JJAS 2001–2025

ROOT = Path(__file__).resolve().parents[1]

INPUT = (
    ROOT / "data" /
    "indus_jjas_rx1day_sen_slope_qc_2001_2025.tif"
)

OUTPUT = (
    ROOT / "results" / "figures" /
    "indus_jjas_rx1day_spatial_trend.png"
)

# 1. Read GeoTIFF
with rasterio.open(INPUT) as src:
    slope = src.read(1).astype(float)
    bounds = src.bounds
    nodata = src.nodata

# 2. Mask NoData only
invalid = ~np.isfinite(slope)

if nodata is not None:
    invalid |= slope == nodata

slope = np.ma.array(slope, mask=invalid)

# 3. Create map
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
    norm=TwoSlopeNorm(
        vmin=-2,
        vcenter=0,
        vmax=2
    ),
    interpolation="nearest"
)

# 4. Colorbar
cbar = fig.colorbar(
    im,
    ax=ax,
    fraction=0.035,
    pad=0.025,
    extend="both"
)

cbar.set_label(
    "Sen's slope (mm/year)"
)

# 5. Labels
ax.set_title(
    "Indus River Basin | Extreme Precipitation Trend\n"
    "JJAS Rx1day 2001–2025 | NASA GPM IMERG V07",
    fontsize=14,
    fontweight="bold",
    pad=15
)

ax.set_xlabel("Longitude (°E)")
ax.set_ylabel("Latitude (°N)")
ax.set_aspect("equal")

ax.text(
    0.5,
    -0.12,
    "Pixel-wise Sen's slope; ≥20 valid annual observations. "
    "Colors saturate beyond ±2 mm/year.\n"
    "Rx1day = maximum daily precipitation during JJAS "
    "(UTC calendar days).",
    transform=ax.transAxes,
    ha="center",
    va="top",
    fontsize=9,
    color="#555555"
)

# 6. Save figure
OUTPUT.parent.mkdir(
    parents=True,
    exist_ok=True
)

fig.savefig(
    OUTPUT,
    dpi=250,
    bbox_inches="tight"
)

plt.close(fig)

print("Rx1day spatial map saved:")
print(OUTPUT)
print("Original GeoTIFF preserved.")
