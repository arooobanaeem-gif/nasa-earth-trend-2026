
/*
 NASA Space Apps Challenge 2026
 Variable 6: Spatial SWE Trends
 Indus River Basin | May–September 2001–2025

 Dataset: NASA FLDAS Noah
 Band: SWE_inst
 Method: Pixel-wise Sen's slope
 Units: mm/year
 QC: At least 20 valid annual observations
*/

// 1. INDUS BASIN

var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

print('Indus subbasins:', indusSubbasins.size());
print('Basin area (km2):',
  indusBasin.area().divide(1e6)
);

// 2. FLDAS SWE

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
)
.filterDate('2001-01-01', '2026-01-01')
.filter(ee.Filter.calendarRange(5, 9, 'month'))
.select('SWE_inst');

print('Monthly May–September images:', fldas.size());

// 3. ANNUAL SEASONAL MEANS

var years = ee.List.sequence(2001, 2025);

var annual = ee.ImageCollection.fromImages(
  years.map(function(y) {
    y = ee.Number(y);

    var seasonal = fldas
      .filter(ee.Filter.calendarRange(y, y, 'year'))
      .mean()
      .rename('swe');

    var yearBand = ee.Image.constant(y)
      .toFloat()
      .rename('year');

    return yearBand.addBands(seasonal)
      .set('year', y)
      .set(
        'system:time_start',
        ee.Date.fromYMD(y, 1, 1).millis()
      );
  })
);

print('Annual SWE images:', annual.size());

// 4. PIXEL-WISE SEN'S SLOPE

var validCount = annual.select('swe').count();

var slope = annual
  .select(['year', 'swe'])
  .reduce(ee.Reducer.sensSlope())
  .select('slope')
  .updateMask(validCount.gte(20))
  .rename('swe_sen_slope');

var spatialTrend = slope.clip(indusBasin);

print('Output bands:', spatialTrend.bandNames());

// 5. MAP

Map.centerObject(indusBasin, 6);

Map.addLayer(
  spatialTrend,
  {
    min: -2,
    max: 2,
    palette: [
      '#b2182b',
      '#ef8a62',
      '#fddbc7',
      '#f7f7f7',
      '#d1e5f0',
      '#67a9cf',
      '#2166ac'
    ]
  },
  'SWE Sen Slope (mm/year)'
);

Map.addLayer(
  indusSubbasins.style({
    color: '222222',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Basin Boundary'
);

// 6. EXPORT

Export.image.toDrive({
  image: spatialTrend.unmask(-9999),
  description: 'Indus_May_Sep_SWE_Sen_Slope_2001_2025',
  fileNamePrefix:
    'indus_may_sep_swe_sen_slope_qc_2001_2025',
  region: indusBasin,
  scale: 10000,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    noData: -9999
  }
});

print('Spatial SWE export configured.');
