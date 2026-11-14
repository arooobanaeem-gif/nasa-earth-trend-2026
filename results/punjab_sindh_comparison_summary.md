
# Punjab–Sindh Regional Hydroclimatic Comparison (2001–2025)

## NASA Space Apps Challenge 2026 — Earth System Trend Detective

### 1. Study Area and Data

This analysis compares the portions of Punjab and Sindh located within the Indus River Basin, Pakistan, over 2001–2025.

- Punjab study area: approximately 168,636 km²
- Sindh study area: approximately 48,978 km²
- Study season: June–September (JJAS)
- Spatial analysis scale: approximately 10 km

Datasets:
- GPM IMERG V07: precipitation and daily precipitation extremes (Rx1day)
- FLDAS Noah: modeled surface runoff, subsurface runoff, and soil moisture

Nine variables were analyzed: seasonal precipitation, Rx1day, surface runoff, subsurface runoff, total runoff, and soil moisture at four depths.

### 2. Statistical Methodology

For each variable and region, 25 annual JJAS observations were analyzed using:

- Original Mann–Kendall trend test
- Yue–Wang lag-1 autocorrelation-adjusted Mann–Kendall test
- Theil–Sen trend slope and 95% confidence interval
- Annual anomalies relative to the 2001–2025 regional mean
- Pearson and Spearman correlations
- Direct trend analysis of annual Sindh-minus-Punjab differences

Statistical significance was evaluated at p < 0.05. Reported p-values were not adjusted for multiple comparisons.

### 3. Long-Term Trend Findings

Both regions generally exhibit positive estimated trends in precipitation, runoff, and soil moisture.

Punjab's modeled total runoff increased at an estimated Theil–Sen slope of +0.843 mm/year, with an autocorrelation-adjusted p-value of 0.0119.

Sindh's modeled total runoff increased at an estimated slope of +0.307 mm/year, with an adjusted p-value of 0.0116. However, the original Mann–Kendall test for Sindh total runoff was not significant (p = 0.1071).

For extreme precipitation (Rx1day), Punjab had an estimated slope of +0.466 mm/year (adjusted p = 0.2051), while Sindh had +1.344 mm/year (adjusted p = 0.0590). Neither adjusted test met the p < 0.05 threshold.

None of the nine Sindh-minus-Punjab regional difference trends was statistically significant using the adjusted tests. Therefore, the analysis does not establish a significant change in the gap between the two regions over 2001–2025.

### 4. Selected-Year Anomalies

Anomalies are percentages relative to each region's own 2001–2025 JJAS mean.

| Year | Region | Rx1day (%) | Precipitation (%) | Total Runoff (%) |
|---|---|---:|---:|---:|
| 2010 | Punjab | +29.94 | +38.08 | +40.85 |
| 2010 | Sindh | +11.85 | +55.89 | +26.45 |
| 2022 | Punjab | +4.13 | +37.57 | +4.34 |
| 2022 | Sindh | +186.17 | +394.69 | +320.86 |
| 2025 | Punjab | +15.94 | +28.31 | +67.21 |
| 2025 | Sindh | +9.71 | +28.03 | -6.65 |

The most prominent selected-year anomaly occurred in Sindh during 2022. Seasonal precipitation was approximately 395% above its regional baseline, while modeled total runoff was approximately 321% above baseline.

In 2025, Punjab's modeled runoff was substantially above baseline, whereas Sindh's was slightly below baseline.

These regional seasonal anomalies are not direct measurements of flood extent, inundation, or damage.

### 5. Precipitation–Runoff Relationships

Pearson correlations between JJAS precipitation and modeled total runoff were:

- Punjab: r = 0.6401 (p = 0.0006)
- Sindh: r = 0.8983 (p < 0.0001)

Precipitation and modeled subsurface runoff were also positively correlated:

- Punjab: r = 0.7287
- Sindh: r = 0.9578

These results indicate strong positive associations, particularly in Sindh. They do not establish causation, and the difference between regional correlation coefficients was not formally tested.

### 6. Soil Moisture–Runoff Relationships

Pearson correlations with modeled total runoff:

| Soil Depth | Punjab | Sindh |
|---|---:|---:|
| 0–10 cm | 0.6440 | 0.8937 |
| 10–40 cm | 0.6869 | 0.8821 |
| 40–100 cm | 0.7977 | 0.6354 |
| 100–200 cm | 0.7386 | 0.3829 |

Punjab's strongest soil moisture–runoff correlation occurred at 40–100 cm, while Sindh's occurred at 0–10 cm.

The Sindh 100–200 cm relationship did not meet the conventional significance threshold (Pearson p = 0.0588).

### 7. Limitations

1. FLDAS runoff and soil moisture are model-derived, not direct field observations.
2. Regional averages may obscure local precipitation extremes and flood impacts.
3. The analysis uses 25 annual observations per region.
4. Multiple statistical comparisons were performed without family-wise or false-discovery-rate correction.
5. Autocorrelation-adjusted and original trend tests sometimes give different significance outcomes.
6. Correlations may reflect common temporal trends or shared meteorological forcing and do not establish causal relationships.
7. Punjab and Sindh boundaries represent only their intersections with the Indus River Basin.
8. The approximately 10 km analysis scale does not imply that all input datasets have identical native resolutions.

### 8. Conclusions

The 2001–2025 analysis reveals generally increasing modeled runoff and soil moisture in the Punjab and Sindh portions of the Indus Basin, alongside substantial interannual variability.

Sindh's 2022 seasonal precipitation, precipitation-extreme, and modeled-runoff anomalies stand out among the selected years.

Precipitation and modeled runoff exhibit strong positive associations in both regions, especially Sindh.

However, direct regional-difference trend tests do not provide sufficient evidence that the Punjab–Sindh hydroclimatic gap has changed significantly over the study period.

The results support regional hydroclimatic monitoring and exploratory flood-related analysis, but they should not be interpreted as flood prediction, attribution, or direct flood-impact measurement.

### 9. Reproducibility

Analysis script:
`analysis/16_punjab_sindh_unified_comparison.py`

Source data:
`data/punjab_sindh_all_variables_2001_2025.csv`

Statistical outputs:
`results/punjab_sindh_*.csv`

Figures:
`results/figures/punjab_sindh_*.png`

GitHub repository:
https://github.com/arooobanaeem-gif/nasa-earth-trend-2026
