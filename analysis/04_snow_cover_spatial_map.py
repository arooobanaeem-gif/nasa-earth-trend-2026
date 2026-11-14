
from pathlib import Path

import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import TwoSlopeNorm

ROOT = Path(__file__).resolve().parents[1]

raster_path = (
    ROOT / "data" /
    "indus_may_sep_snow_sen_slope_qc_2001_2025_clean.tif"
)

output_path = (
    ROOT / "results" / "figures" /
    "indus_may_sep_snow_spatial_trend.png"
)

output_path.parent.mkdir(parents=True, exist_ok=True)

with rasterio.open(raster_path) as src:
    data = src.read(1).astype(float)
    bounds = src.bounds
    nodata = src.nodata

# Mask invalid pixels
data[~np.isfinite(data)] = np.nan
data[data == nodata] = np.nan

# Use symmetric display limits around zero
valid = data[np.isfinite(data)]
limit = np.percentile(np.abs(valid), 98)
limit = max(limit, 0.01)

fig, ax = plt.subplots(figsize=(11, 8))

image = ax.imshow(
    data,
    extent=[
        bounds.left, bounds.right,
        bounds.bottom, bounds.top
    ],
    origin="upper",
    cmap="RdBu_r",
    norm=TwoSlopeNorm(
        vmin=-limit,
        vcenter=0,
        vmax=limit
    ),
    interpolation="nearest"
)

ax.set_title(
    "Indus Basin: Spatial Snow-Cover Trend (2001–2025)\n"
    "MODIS May–September | Pixel-wise Sen's Slope",
    fontsize=14,
    pad=14
)

ax.set_xlabel("Longitude (°)")
ax.set_ylabel("Latitude (°)")

cbar = fig.colorbar(
    image,
    ax=ax,
    shrink=0.78,
    pad=0.025
)

cbar.set_label(
    "Change in mean MODIS NDSI Snow Cover value per year"
)

ax.text(
    0.01, 0.02,
    "Pixels require ≥20 valid annual observations.\n"
    "Colors indicate slope, not statistical significance.",
    transform=ax.transAxes,
    fontsize=9,
    va="bottom",
    bbox=dict(
        facecolor="white",
        alpha=0.85,
        edgecolor="none"
    )
)

plt.tight_layout()
plt.savefig(output_path, dpi=300, bbox_inches="tight")
plt.close()

print("Saved:", output_path)
print("Valid pixels:", valid.size)
print("Display limit: ±", round(limit, 4))
