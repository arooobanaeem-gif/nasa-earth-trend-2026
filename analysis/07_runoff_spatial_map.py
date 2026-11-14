
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt
import rasterio
from matplotlib.colors import TwoSlopeNorm
from matplotlib.ticker import MaxNLocator

# ==========================================
# NASA SPACE APPS CHALLENGE 2026
# FLDAS Runoff Spatial Trend Map
# Indus Basin | JJAS | 2001–2025
# ==========================================

ROOT = Path(__file__).resolve().parents[1]

INPUT = (
    ROOT / "data" /
    "indus_jjas_runoff_sen_slope_qc_2001_2025_clean.tif"
)

OUTPUT = (
    ROOT / "results" / "figures" /
    "indus_jjas_runoff_spatial_trend.png"
)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

titles = [
    "Surface Runoff",
    "Subsurface Runoff",
    "Total Runoff"
]

fig, axes = plt.subplots(
    1, 3,
    figsize=(18, 7),
    constrained_layout=True
)

with rasterio.open(INPUT) as src:

    bounds = src.bounds

    extent = [
        bounds.left,
        bounds.right,
        bounds.bottom,
        bounds.top
    ]

    for i, ax in enumerate(axes, start=1):

        data = src.read(i).astype(float)

        # Mask invalid and nodata values
        invalid = (
            ~np.isfinite(data) |
            (data == src.nodata)
        )

        data[invalid] = np.nan

        valid = data[np.isfinite(data)]

        if valid.size == 0:
            raise ValueError(
                f"No valid pixels in band {i}"
            )

        # Robust symmetric color range
        limit = np.percentile(
            np.abs(valid), 98
        )

        limit = max(float(limit), 0.001)

        norm = TwoSlopeNorm(
            vmin=-limit,
            vcenter=0,
            vmax=limit
        )

        im = ax.imshow(
            data,
            extent=extent,
            origin="upper",
            cmap="RdBu",
            norm=norm,
            interpolation="nearest"
        )

        ax.set_title(
            titles[i - 1],
            fontsize=14,
            fontweight="bold"
        )

        ax.set_xlabel("Longitude (°E)")
        ax.set_ylabel("Latitude (°N)")

        ax.xaxis.set_major_locator(
            MaxNLocator(nbins=5)
        )

        ax.yaxis.set_major_locator(
            MaxNLocator(nbins=6)
        )

        ax.set_aspect("equal")

        cbar = fig.colorbar(
            im,
            ax=ax,
            orientation="horizontal",
            fraction=0.045,
            pad=0.09
        )

        cbar.set_label(
            "Sen's slope (mm/year)",
            fontsize=10
        )

        print(
            f"{titles[i - 1]}: "
            f"{valid.size:,} valid pixels, "
            f"mean={np.mean(valid):.4f}, "
            f"98th-percentile limit=±{limit:.4f}"
        )

fig.suptitle(
    "Indus Basin | Spatial Runoff Trends (2001–2025)\n"
    "NASA FLDAS Noah | June–September (JJAS)",
    fontsize=17,
    fontweight="bold"
)

fig.text(
    0.5,
    -0.045,
    "Blue = increasing runoff | Red = decreasing runoff | "
    "QC: at least 20 valid years | "
    "Colors do not indicate statistical significance",
    ha="center",
    fontsize=10
)

plt.savefig(
    OUTPUT,
    dpi=250,
    bbox_inches="tight"
)

plt.close(fig)

print(f"\nSaved map: {OUTPUT}")
