# Earth System Trend Detective
## Scientific Methodology and Key Findings

**Study area:** Indus River Basin  
**Study period:** 2001–2025  
**Project:** NASA Space Apps Challenge 2026  
**Analysis:** Earth observation time-series trends and regional hydroclimatic comparisons

---

## 1. Research Objective

This project investigates long-term changes in the Indus River Basin using satellite Earth observations and land-surface model data.

The main research questions are:

1. Which hydroclimatic indicators exhibit statistically significant trends from 2001 to 2025?
2. Do different regions of the Indus Basin experience different rates of change?
3. How did the 2022 monsoon season differ from long-term conditions?
4. How can statistical trend analysis help students and the public interpret Earth science data?

The project examines seven Earth science variable groups represented by twelve individual indicators.

## 2. Study Area

The study covers the Indus River Basin, delineated using HydroSHEDS/HydroBASINS level-6 watershed boundaries.

The basin covers approximately 864,625 km² based on the watershed geometry used in the analysis.

Three regional comparisons were conducted:

**Punjab versus Sindh:** Provincial geographic comparison focused on differences in hydroclimatic conditions and the 2022 extreme rainfall event.

**Upper versus Lower Indus:** An operational upstream/downstream catchment division based on a Chashma-area reference subbasin and its upstream connectivity. The upstream group contains 43 level-6 subbasins, while the remaining group contains 58. These groups should not be interpreted as conventional geographic Upper and Lower Indus regions.

**High versus Low Elevation:** Areas below 1,500 m were compared with areas at or above 1,500 m using NASA SRTM elevation data. The elevation classification was processed at a coarser analysis scale and does not represent a high-resolution terrain delineation.

## 3. Earth Science Datasets

| Dataset | Indicators | Seasonal analysis |
|---|---|---|
| NASA GPM IMERG V07 | Precipitation, Rx1day | June–September |
| MODIS MOD11A2 | Daytime land surface temperature | June–September |
| MODIS MOD10A1 | NDSI snow-cover index | May–September |
| NASA FLDAS | Surface runoff, subsurface runoff, total runoff, four soil moisture depths | June–September |
| NASA FLDAS | Snow water equivalent | May–September |
| NASA SRTM | Elevation | Static geographic classification |
| HydroSHEDS/HydroBASINS | Basin and subbasin boundaries | Static geographic classification |

Daily, subdaily, eight-day, and monthly products were aggregated into annual seasonal indicators as appropriate to each dataset.

The resulting annual time series contain 25 observations, one for each year from 2001 through 2025.

The twelve indicators are precipitation, Rx1day, land surface temperature, snow-cover index, surface runoff, subsurface runoff, total runoff, soil moisture at four depths, and snow water equivalent.

## 4. Statistical Methodology

### 4.1 Time-series analysis

Annual seasonal values were extracted for the study area and each regional comparison.

Time-series figures were produced to visualize interannual variability and long-term changes.

### 4.2 Mann–Kendall trend test

The Mann–Kendall test was used to evaluate whether each annual time series exhibits a statistically detectable monotonic trend.

A p-value below 0.05 was treated as statistically significant under the relevant test.

A nonsignificant result does not establish that the variable remained unchanged. It indicates that the available observations and selected test did not provide sufficient evidence of a trend at the chosen significance level.

### 4.3 Sen's slope estimator

Sen's slope was used to estimate the magnitude of change per year.

A positive slope indicates an increasing trend, while a negative slope indicates a decreasing trend.

Slope units depend on the indicator. For example, precipitation slopes are expressed in mm/year, land surface temperature slopes in °C/year, and volumetric soil moisture slopes in m³/m³/year.

### 4.4 Autocorrelation

Temporal autocorrelation can affect the interpretation of trend significance.

Regional comparison analyses used lag-1 Yue–Wang-adjusted Mann–Kendall p-values. The original basin-wide analyses retained their respective statistical procedures, including original Mann–Kendall tests and, where implemented, trend-free prewhitening diagnostics.

Consequently, the p-value method recorded for each result must be preserved when presenting statistical findings.

### 4.5 Multiple-testing correction

For the three direct regional difference analyses, false discovery rate correction was applied using the Benjamini–Hochberg procedure where recorded in the analysis outputs.

A direct regional difference trend was classified as significant when its FDR-adjusted q-value was below 0.05.

This distinction is important: a significant trend in one region does not automatically imply a statistically significant difference between regions.

### 4.6 Confidence intervals

Sen's slope confidence intervals were retained where calculated.

The presence and interpretation of confidence intervals depend on the statistical method used for each source analysis. Confidence intervals should not automatically be interpreted as autocorrelation-adjusted unless that adjustment was explicitly performed.

## 5. Basin-Wide Findings

Seven of the twelve basin-wide indicators exhibited statistically significant trends at the 0.05 threshold.

| Indicator | Sen's slope per year | p-value | Significant |
|---|---:|---:|---|
| Precipitation | +2.042961 mm | 0.252461 | No |
| Rx1day | +0.440348 mm | 0.072124 | No |
| Land surface temperature | −0.017359 °C | 0.387514 | No |
| Snow-cover index | −0.021045 index units | 0.440876 | No |
| Surface runoff | +2.029010 mm | 0.001616 | Yes |
| Subsurface runoff | +0.338818 mm | 0.000141 | Yes |
| Total runoff | +2.382002 mm | 0.001616 | Yes |
| Soil moisture, 0–10 cm | +0.001422 m³/m³ | 0.00000817 | Yes |
| Soil moisture, 10–40 cm | +0.001867 m³/m³ | 0.000000513 | Yes |
| Soil moisture, 40–100 cm | +0.002124 m³/m³ | 0.0000000238 | Yes |
| Soil moisture, 100–200 cm | +0.001096 m³/m³ | 0.00000000109 | Yes |
| Snow water equivalent | +0.094904 mm | 0.154258 | No |

The strongest basin-wide evidence concerns increasing modelled runoff and soil moisture.

Precipitation and Rx1day slopes were positive but did not reach the selected significance threshold.

The snow-cover index, snow water equivalent, and land surface temperature also did not exhibit statistically significant basin-wide trends.

## 6. Regional Comparison Findings

### 6.1 Punjab versus Sindh

The provincial comparison examined nine indicators.

No direct Punjab–Sindh difference trend was statistically significant after the comparison's multiple-testing correction.

However, the 2022 monsoon season showed pronounced regional contrasts.

Relative to its 2001–2025 seasonal mean, Sindh experienced approximately:

- 394.69% higher JJAS precipitation.
- 186.17% higher Rx1day.
- 320.86% higher modelled total runoff.

These anomalies describe an exceptional season, not proof of a long-term trend or a direct causal attribution.

### 6.2 Chashma-based Upper versus Lower Indus

This comparison produced the clearest evidence of differing regional trends.

Nine of twelve direct Lower-minus-Upper difference trends were significant after FDR correction.

| Indicator | Difference Sen's slope per year | FDR q-value |
|---|---:|---:|
| Precipitation | +3.828829 mm | 0.032110 |
| Rx1day | +0.576285 mm | 0.032110 |
| Surface runoff | +2.328632 mm | 0.002221 |
| Subsurface runoff | +0.460951 mm | 0.011220 |
| Total runoff | +2.736177 mm | 0.003865 |
| Soil moisture, 0–10 cm | +0.001154 m³/m³ | 0.001137 |
| Soil moisture, 10–40 cm | +0.001328 m³/m³ | 0.003865 |
| Soil moisture, 40–100 cm | +0.001114 m³/m³ | 0.023060 |
| Soil moisture, 100–200 cm | +0.000719 m³/m³ | 0.011716 |

All reported slopes describe changes in the **Lower-minus-Upper difference series**. They are not the individual slopes of either region.

The positive values indicate that the Lower-minus-Upper difference increased over time for these indicators.

Land surface temperature, snow-cover index, and snow water equivalent did not exhibit significant direct difference trends after FDR correction.

### 6.3 High versus Low Elevation

The elevation comparison examined twelve indicators across areas below and at or above 1,500 m.

No direct High-minus-Low difference trend remained significant after FDR correction.

This does not mean that high- and low-elevation areas have identical environmental conditions.

The zones differ substantially in temperature, precipitation, snow conditions, and other physical characteristics.

For 2022, precipitation anomalies relative to each zone's long-term mean were approximately +70.83% in the low-elevation zone and +50.29% in the high-elevation zone.

The corresponding modelled total runoff anomalies were +24.48% and −5.11%.

## 7. The 2022 Extreme Monsoon Case Study

The 2022 monsoon season provides an accessible example of why regional analysis matters.

Seasonal anomalies were calculated relative to each region's own 2001–2025 mean.

The analysis revealed pronounced rainfall and runoff anomalies, particularly in Sindh.

The case study demonstrates that a single extreme year can differ sharply from typical conditions, even when the long-term trend is not statistically significant.

These results should not be interpreted as a complete flood-attribution analysis. Flood impacts also depend on river routing, drainage, infrastructure, exposure, and other factors not fully represented by the selected indicators.

## 8. Scientific Limitations

**Satellite and model uncertainty:** GPM precipitation is satellite-estimated. FLDAS runoff, soil moisture, and snow water equivalent are model-derived quantities.

**River discharge:** Modelled runoff depth is not equivalent to observed river discharge.

**Land surface temperature:** MODIS daytime land surface temperature is not near-surface air temperature.

**Snow indicator:** The NDSI-based snow-cover index is not a percentage of snow-covered area.

**Elevation classification:** Elevation zones were defined using a 1,500 m threshold and coarse-scale spatial processing. The classified area differs slightly from the complete basin geometry.

**Regional boundaries:** The Chashma-based operational catchment division is not identical to the conventional geographical definition of Upper and Lower Indus.

**Temporal coverage:** Twenty-five annual observations provide a useful historical record but do not capture every possible longer-term cycle.

**Seasonal scope:** JJAS and May–September analyses describe selected seasonal conditions rather than complete annual climate behavior.

**Trend interpretation:** Statistical trends do not establish causation. A statistically nonsignificant result does not demonstrate that no environmental change occurred.

**Statistical methods:** Different basin-wide analyses used different significance-testing procedures. Regional difference tests included lag-1 adjustment and FDR correction. Results should retain their method labels.

## 9. Key Scientific Conclusion

The Indus River Basin exhibits spatially heterogeneous hydroclimatic behavior over the 2001–2025 study period.

Basin-wide analysis identified statistically significant increases in modelled runoff and soil moisture.

The strongest regional evidence came from the Chashma-based Upper–Lower comparison, where nine of twelve indicators showed significant long-term changes in the difference between the two regions.

The Punjab–Sindh and High–Low Elevation comparisons did not show significant direct difference trends after correction, although substantial differences in environmental conditions and extreme-year anomalies were observed.

Together, these findings demonstrate the value of examining both basin-wide trends and regional differences rather than treating a large river basin as a uniform environmental system.

## 10. Data and Reproducibility

The project repository contains Google Earth Engine extraction scripts, Python statistical analysis scripts, source time-series CSVs, regional comparison results, figures, and scientific summaries.

The consolidated outputs are:

- `results/master_scientific_results.csv` — 111 statistical result records.
- `results/scientific_data_dictionary.csv` — seven variable groups and twelve indicators.
- Regional analysis CSVs and figures — detailed trend and anomaly results.

The consolidated master table preserves statistical methods, source filenames, slopes, p-values, and FDR-adjusted values where available.

These outputs provide the scientific foundation for the interactive Earth System Trend Detective application.