
from pathlib import Path

import numpy as np
import rasterio

# NASA Space Apps Challenge 2026
# Variable 5: Soil Moisture Raster Cleaning

ROOT = Path(__file__).resolve().parents[1]

SOURCE = ROOT / "data/indus_jjas_soil_moisture_sen_slope_qc_2001_2025.tif"

OUTPUT = ROOT / "data/indus_jjas_soil_moisture_sen_slope_qc_2001_2025_clean.tif"

NODATA = -9999.0

BAND_NAMES = [
    "soil_00_10cm_sen",
    "soil_10_40cm_sen",
    "soil_40_100cm_sen",
    "soil_100_200cm_sen",
]

with rasterio.open(SOURCE) as src:
    profile = src.profile.copy()
    profile.update(
        nodata=NODATA,
        compress="deflate",
        predictor=3
    )

    with rasterio.open(OUTPUT, "w", **profile) as dst:
        for band_index, name in enumerate(BAND_NAMES, start=1):
            data = src.read(band_index, masked=True)

            clean = data.filled(NODATA).astype("float32")
            clean[~np.isfinite(clean)] = NODATA

            dst.write(clean, band_index)
            dst.set_band_description(band_index, name)

            valid = clean[
                np.isfinite(clean) & (clean != NODATA)
            ]

            print(
                f"Band {band_index} ({name}) | "
                f"Valid: {valid.size} | "
                f"Min: {valid.min():+.6f} | "
                f"Max: {valid.max():+.6f} | "
                f"Mean: {valid.mean():+.6f}"
            )

print("\nCleaned raster saved:")
print(OUTPUT)
