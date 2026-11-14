
# Data Sources and Licensing

## HydroBASINS — Indus Basin Boundary

Provider: WWF / HydroSHEDS

Dataset: WWF/HydroSHEDS/v1/Basins/hybas_6

Official source:
https://www.hydrosheds.org/products/hydrobasins

License documentation:
https://data.hydrosheds.org/file/technical-documentation/HydroSHEDS_TechDoc_v1_4.pdf

Use in this project:
The Indus Basin boundary is used for clipping
and spatial aggregation of NASA satellite data.

Boundary selection:
MAIN_BAS = 4060033640
HydroBASINS Level 6, dissolved into one geometry.

Licensing:
HydroSHEDS-specific license terms apply.
The dataset is available for research use, but
public redistribution of the derived boundary
has not been cleared.

Release policy:
The derived HydroBASINS GeoJSON will not be
included in our public GitHub release.
We will publish only materials cleared for
redistribution and provide source attribution.

NASA datasets:
- GPM IMERG V07: NASA/GPM_L3/IMERG_V07
- MODIS LST: MODIS/061/MOD11A2

Compliance:
All third-party sources and applicable licenses
will be disclosed in the final submission.
NASA Space Apps third-party material compliance
remains subject to final verification.
