
from pathlib import Path
import numpy as np
import rasterio

# Project directories
ROOT = Path(__file__).resolve().parents[1]

source = (
    ROOT / "data" /
    "indus_jjas_runoff_sen_slope_qc_2001_2025.tif"
)

destination = (
    ROOT / "data" /
    "indus_jjas_runoff_sen_slope_qc_2001_2025_clean.tif"
)

NODATA = -9999.0

with rasterio.open(source) as src:
    profile = src.profile.copy()

    profile.update(
        nodata=NODATA,
        compress="deflate"
    )

    with rasterio.open(destination, "w", **profile) as dst:

        for band in range(1, src.count + 1):

            data = src.read(band)

            invalid = (
                ~np.isfinite(data) |
                (data == NODATA)
            )

            cleaned = data.copy()
            cleaned[invalid] = NODATA

            dst.write(cleaned, band)

            if src.descriptions[band - 1]:
                dst.set_band_description(
                    band,
                    src.descriptions[band - 1]
                )

            valid = cleaned[~invalid]

            print(f"\nBand {band}")
            print(f"Valid pixels: {valid.size:,}")
            print(f"Invalid pixels: {invalid.sum():,}")
            print(f"Remaining NaNs: {np.isnan(cleaned).sum():,}")
            print(f"Minimum: {valid.min():.6f}")
            print(f"Maximum: {valid.max():.6f}")
            print(f"Mean: {valid.mean():.6f}")

print(f"\nCleaned GeoTIFF saved to:\n{destination}")
