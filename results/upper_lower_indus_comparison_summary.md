# Upper–Lower Indus Hydroclimatic Comparison (2001–2025)

## Study design

This analysis compares two operational hydrological regions of the Indus River Basin, defined using HydroBASINS Level 6 connectivity and a Chashma-area reference subbasin (HYBAS_ID 4060718650).

- **Upper region:** Reference subbasin and its upstream contributors; 43 subbasins covering approximately 364,619.50 km².
- **Lower region:** Remaining 58 Indus subbasins covering approximately 500,004.80 km².
- **Study period:** 2001–2025 (25 years).
- **Observations:** 50 annual regional records.
- **Variables:** 12 hydroclimatic measurements from GPM IMERG, MODIS, and FLDAS.

This operational partition is not equivalent to a universally accepted Upper/Lower Indus division or the exact Chashma Barrage watershed. The remaining-basin region also contains tributary catchments that do not pass through the selected reference subbasin.

## Methods

June–September (JJAS) was used for precipitation, Rx1day, land surface temperature, runoff, and soil moisture. May–September was used for the snow-cover index and snow water equivalent.

Regional trends were estimated using Theil–Sen slopes and Mann–Kendall tests. Lag-1 Yue–Wang modified Mann–Kendall p-values were used to account for serial correlation.

To test regional divergence directly, an annual difference series was constructed for each variable:

**Difference = Lower Indus − Upper Indus**

Theil–Sen and Mann–Kendall analyses were then applied to these difference series. Benjamini–Hochberg false discovery rate correction was applied across the 12 direct difference tests.

## Main findings

Nine of twelve direct regional difference trends remained statistically significant after FDR correction (q less than 0.05).

| Variable | Difference Sen slope/year | FDR-adjusted p |
|---|---:|---:|
| Rx1day precipitation | +0.576285 mm | 0.032110 |
| Seasonal precipitation | +3.828829 mm | 0.032110 |
| Surface runoff | +2.328632 mm | 0.002221 |
| Subsurface runoff | +0.460951 mm | 0.011220 |
| Total runoff | +2.736177 mm | 0.003865 |
| Soil moisture 0–10 cm | +0.001154 m³/m³ | 0.001137 |
| Soil moisture 10–40 cm | +0.001328 m³/m³ | 0.003865 |
| Soil moisture 40–100 cm | +0.001114 m³/m³ | 0.023060 |
| Soil moisture 100–200 cm | +0.000719 m³/m³ | 0.011716 |

All nine significant difference trends were positive, indicating increasing Lower-minus-Upper contrasts.

No significant difference trend was identified for daytime land surface temperature (q = 0.975670), NDSI snow-cover index (q = 0.145947), or snow water equivalent (q = 0.423593).

## The 2022 anomaly

Relative to each region's 2001–2025 mean:

| Indicator | Upper region | Lower region |
|---|---:|---:|
| JJAS precipitation anomaly | +38.35% | +70.54% |
| Rx1day anomaly | +16.83% | +40.80% |
| Modelled total runoff anomaly | −5.48% | +13.29% |
| Modelled SWE anomaly | −24.76% | −73.33% |

The 2022 rainfall and extreme-precipitation anomalies were larger in the remaining-basin region. These descriptive comparisons do not establish flood causation or attribution.

## Scientific limitations

1. The regional division is an operational HydroBASINS Level 6 catchment-versus-complement partition, not a conventional geographical Upper/Lower Indus boundary.
2. GPM IMERG precipitation is satellite-derived; FLDAS runoff, soil moisture, and SWE are model-derived.
3. MODIS daytime land surface temperature is not near-surface air temperature.
4. The NDSI snow-cover index must not be interpreted as percentage snow-covered area.
5. Spatial reduction was performed at a common 10 km scale despite differing native dataset resolutions.
6. MODIS temporal image coverage varies between years; the 2001 snow record contains fewer images than subsequent complete seasons.
7. Statistical significance depends on the chosen lag-1 Yue–Wang correction and the assumptions of the Mann–Kendall procedure.
8. Benjamini–Hochberg correction was applied to the 12 direct regional difference tests, not to every regional trend or correlation test.
9. Observed correlations and coincident trends do not demonstrate causal relationships.
10. The 25-year analysis period limits inference about longer-term climate change and variability.

## Conclusion

From 2001 to 2025, the Indus Basin exhibited statistically detectable divergence between the Chashma-area upstream catchment and the remaining basin in seasonal precipitation, extreme rainfall, modelled runoff, and soil moisture. Nine direct difference trends remained significant after false discovery rate correction. The corresponding temperature and snow-related difference trends were not significant.

These findings illustrate the value of combining satellite observations, land-surface model outputs, hydrological basin delineation, and nonparametric trend analysis to investigate spatially heterogeneous Earth-system changes.