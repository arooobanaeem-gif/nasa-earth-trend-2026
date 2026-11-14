# Indus Basin Elevation Zone Validation

**Study:** NASA Space Apps Challenge 2026 — Earth System Trend Detective

**Study period:** 2001–2025

**Study boundary:** HydroBASINS Level 6 Indus River Basin, MAIN_BAS = 4060033640.

**Elevation dataset:** NASA SRTMGL1_003.

**Operational elevation threshold:** 1,500 m above sea level.

## Elevation zones

| Zone | Definition | Classified area (km²) | Share of classified area |
|---|---|---:|---:|
| Low elevation | Below 1,500 m | 416,735.15 | 48.43% |
| High elevation | 1,500 m and above | 443,769.95 | 51.57% |
| Total | Both zones | 860,505.09 | 100.00% |

## Coverage validation

- Reference basin area: approximately 864,626.67 km².
- Classified area: 860,505.09 km².
- Difference: approximately 4,121.57 km².
- Classified coverage relative to reference basin area: approximately 99.52%.

The difference may reflect raster sampling, DEM masking, boundary effects, or other geospatial processing factors. It has not been independently attributed to a specific cause.

## Methodological notes

The high- and low-elevation zones are defined using a fixed 1,500 m threshold. This is an operational analytical classification, not a universal mountain–lowland definition.

The two regions are spatially disjoint within the valid DEM footprint and collectively cover approximately 99.52% of the reference basin area.

All subsequent variable extractions should apply the same DEM-derived zone masks and the same basin geometry.

Because the datasets have different native resolutions, the extraction method and analysis scale must be documented. Snow-cover index values must not be interpreted as percentage snow-covered area, and FLDAS runoff and SWE are model-derived rather than direct observations.