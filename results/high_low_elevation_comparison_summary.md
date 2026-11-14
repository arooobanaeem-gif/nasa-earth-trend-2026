# High-Elevation vs Low-Elevation Indus Basin: Regional Comparison Summary

**Project:** NASA Space Apps Challenge 2026 - Earth System Trend Detective  
**Study Area:** Indus River Basin  
**Study Period:** 2001–2025  
**Comparison:** High Elevation vs Low Elevation  
**Status:** Statistical analysis completed

---

## 1. Objective

This analysis investigates whether the high- and low-elevation areas of the Indus River Basin experienced different hydroclimatic changes between 2001 and 2025.

The purpose is to understand how precipitation, temperature, runoff, soil moisture, and snow conditions vary across elevation zones and whether the differences between these zones have changed over time.

## 2. Study Area and Elevation Classification

The Indus River Basin was divided into two elevation zones using the NASA SRTM Digital Elevation Model and a threshold of 1,500 metres.

| Elevation Zone | Elevation Range | Classified Area |
|---|---|---:|
| Low Elevation | Below 1,500 m | 416,735.15 km² |
| High Elevation | 1,500 m and above | 443,769.95 km² |

The classified area totals approximately 860,505.09 km², representing about 99.52% of the reference basin area.

The extraction used a 10 km analysis scale. Elevation classes were sampled using nearest-neighbor behavior, so the analysis does not represent the exact fractional elevation composition of every 10 km pixel.

## 3. Datasets and Variables

The comparison includes 12 hydroclimatic variables obtained from four Earth observation and land-surface datasets.

| Dataset | Variables |
|---|---|
| GPM IMERG V07 | JJAS precipitation and Rx1day |
| FLDAS Noah | Surface runoff, subsurface runoff, total runoff, four soil-moisture depths, and snow water equivalent |
| MODIS MOD11A2 V061 | Daytime land surface temperature |
| MODIS MOD10A1 V061 | NDSI snow-cover index |

Precipitation, runoff, soil moisture, and land surface temperature were analyzed for June–September (JJAS). Snow-cover index and snow water equivalent were analyzed for May–September.

FLDAS runoff and SWE are model-derived estimates. The MODIS NDSI snow-cover index is not equivalent to the percentage of land covered by snow.

## 4. Data Validation

The unified Google Earth Engine extraction produced 50 annual records, covering 25 years for each elevation zone.

Validation confirmed:

- 50 records and 21 columns.
- 25 observations per elevation zone.
- Complete coverage from 2001 to 2025.
- No missing measurements.
- No duplicate year–region records.
- No incomplete IMERG days reported.
- All 12 variables available for both zones.

All reported Mann–Kendall p-values, Sen's slopes, and FDR-adjusted q-values were finite.

A runtime warning occurred during the autocorrelation calculation in `pymannkendall`. Although the exported statistics contained no nonfinite values, the warning should be retained as a methodological caveat.

## 5. Statistical Methodology

The following methods were applied:

1. Mann–Kendall trend test to evaluate monotonic trends.
2. Yue–Wang lag-1 autocorrelation-adjusted Mann–Kendall test.
3. Sen's slope to estimate the magnitude and direction of trends.
4. Direct annual difference analysis, calculated as High Elevation minus Low Elevation.
5. Benjamini–Hochberg false discovery rate (FDR) correction across the 12 direct difference-trend tests.
6. Annual anomalies relative to each elevation zone's 2001–2025 mean.
7. Pearson and Spearman correlations between selected variables.

Statistical significance was evaluated at the 0.05 level.

## 6. Main Results: Long-Term Differences

**None of the 12 direct High-minus-Low elevation difference trends remained statistically significant after FDR correction.**

| Variable | High-minus-Low Sen's Slope per Year | FDR q-value | Significant? |
|---|---:|---:|---|
| Rx1day | −0.045852 mm | 0.976186 | No |
| Precipitation | −2.274915 mm | 0.299208 | No |
| Surface runoff | +0.059631 mm | 1.000000 | No |
| Subsurface runoff | −0.087174 mm | 0.299208 | No |
| Total runoff | −0.209736 mm | 0.976186 | No |
| Soil moisture 0–10 cm | −0.000390 m³/m³ | 0.478577 | No |
| Soil moisture 10–40 cm | −0.000587 m³/m³ | 0.299208 | No |
| Soil moisture 40–100 cm | −0.000642 m³/m³ | 0.299208 | No |
| Soil moisture 100–200 cm | −0.000400 m³/m³ | 0.299208 | No |
| Daytime LST | −0.000288 °C | 1.000000 | No |
| NDSI snow index | −0.026376 index units | 0.665614 | No |
| SWE | +0.181713 mm | 0.435873 | No |

Subsurface runoff had an unadjusted Yue–Wang p-value of 0.048046, but its FDR-adjusted q-value was 0.299208. Therefore, it was not considered statistically significant after multiple-testing correction.

These findings indicate that the analysis did not detect statistically significant long-term changes in the differences between the two elevation zones.

This does not mean that the zones have identical environmental conditions or that individual zones experienced no trends.

## 7. The 2022 Case Study

The year 2022 was examined as a case study of unusually wet conditions.

### 7.1 Observed Regional Conditions

| Variable | Low Elevation | High Elevation |
|---|---:|---:|
| JJAS precipitation (mm) | 594.23 | 310.44 |
| Rx1day (mm) | 73.46 | 36.95 |
| Surface runoff (mm) | 54.69 | 66.44 |
| Subsurface runoff (mm) | 9.47 | 5.08 |
| Total runoff (mm) | 64.17 | 71.51 |
| Daytime LST (°C) | 35.45 | 24.38 |
| NDSI snow index | 0.19 | 7.31 |
| SWE (mm) | 0.00 | 7.85 |

Low-elevation areas experienced higher precipitation and higher daytime land surface temperatures, while high-elevation areas had higher snow indices and snow water equivalent.

### 7.2 Anomalies Relative to the 2001–2025 Mean

| Variable | Low Elevation | High Elevation |
|---|---:|---:|
| JJAS precipitation | +70.83% | +50.29% |
| Rx1day | +36.50% | +32.44% |
| Total runoff | +24.48% | −5.11% |

Both elevation zones experienced above-average precipitation and Rx1day in 2022.

However, the modelled total runoff response differed. Low-elevation runoff was 24.48% above its long-term mean, while high-elevation runoff was 5.11% below its long-term mean.

This demonstrates that rainfall anomalies and modelled runoff anomalies do not necessarily follow the same pattern across different elevation zones.

These associations should not be interpreted as proof of causation.

## 8. Comparison with the Other Regional Analyses

Three regional comparisons were conducted in the Indus River Basin.

| Comparison | FDR-Significant Direct Difference Trends |
|---|---:|
| Punjab vs Sindh | 0 of 9 |
| Chashma-based Upper vs Lower Indus | 9 of 12 |
| High Elevation vs Low Elevation | 0 of 12 |

The Chashma-based upstream–downstream comparison revealed the strongest evidence of different long-term hydroclimatic trends between its two regions.

The Punjab–Sindh and elevation-based comparisons did not identify statistically significant long-term changes in the differences between their respective regions after FDR correction.

The results suggest that the spatial boundaries used in regional analysis influence which hydroclimatic patterns are detected.

The Chashma-based Upper–Lower classification is an operational catchment division and should not be confused with a strictly geographic division of the upper and lower Indus.

## 9. Scientific Significance

This comparison contributes to the project in three ways.

**Elevation-based understanding:** It demonstrates differences in temperature, precipitation, and snow conditions between high- and low-elevation areas.

**Regional climate-risk interpretation:** The 2022 case study shows that unusually wet conditions can be associated with different modelled runoff responses across elevation zones.

**Spatial comparison:** When considered alongside the other two regional analyses, the findings demonstrate why examining the basin through multiple geographic divisions provides more information than analyzing only a basin-wide average.

The absence of FDR-significant difference trends is a valid scientific finding. It indicates that the available evidence does not establish a systematic widening or narrowing of the differences between elevation zones during the study period.

## 10. Limitations

- The analysis covers 25 annual observations per zone.
- The elevation threshold of 1,500 m is an exploratory classification rather than a universal hydrological boundary.
- Elevation-zone sampling at 10 km does not capture every fine-scale terrain difference.
- FLDAS runoff and SWE are model-derived estimates.
- MODIS daytime LST is not equivalent to near-surface air temperature.
- The NDSI snow-cover index should not be interpreted as snow-covered area percentage.
- Statistical associations do not establish causation.
- Nonsignificant results do not prove that regional trends are identical.
- A `pymannkendall` autocorrelation warning occurred, although the exported statistics were finite.

## 11. Conclusion

The High-Elevation vs Low-Elevation comparison successfully evaluated 12 hydroclimatic variables across the Indus River Basin from 2001 to 2025.

The two zones showed distinct environmental conditions, particularly during 2022. Low elevations experienced