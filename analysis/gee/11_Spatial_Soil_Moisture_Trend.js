
/*
 NASA Space Apps Challenge 2026
 Variable 5: Spatial Soil Moisture Trends
 Indus River Basin | JJAS 2001–2025

 Data: NASA FLDAS Noah
 Method: Pixel-wise Sen's slope
 Quality control: >= 20 valid annual observations

 Output: Four-band GeoTIFF
 Units: m3/m3 per year
*/

// --------------------------------------------------
// 1. INDUS BASIN BOUNDARY
// --------------------------------------------------

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

// --------------------------------------------------
// 2. FLDAS SOIL MOISTURE DATA
// --------------------------------------------------

var soilBands = [
  'SoilMoi00_10cm_tavg',
  'SoilMoi10_40cm_tavg',
  'SoilMoi40_100cm_tavg',
  'SoilMoi100_200cm_tavg'
];

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
)
.filterDate('2001-01-01', '2026-01-01')
.filter(ee.Filter.calendarRange(6, 9, 'month'))
.select(soilBands);

print('Monthly JJAS images:', fldas.size());

// --------------------------------------------------
// 3. ANNUAL JJAS MEAN IMAGES
// --------------------------------------------------

var years = ee.List.sequence(2001, 2025);

var annual = ee.ImageCollection.fromImages(
  years.map(function(y) {
    y = ee.Number(y);

    var seasonal = fldas
      .filter(ee.Filter.calendarRange(y, y, 'year'))
      .mean();

    var yearBand = ee.Image.constant(y)
      .toFloat()
      .rename('year');

    return yearBand
      .addBands(seasonal)
      .set('year', y)
      .set('system:time_start',
        ee.Date.fromYMD(y, 1, 1).millis()
      );
  })
);

print('Annual JJAS images:', annual.size());

// --------------------------------------------------
// 4. PIXEL-WISE SEN'S SLOPES
// --------------------------------------------------

var outputNames = [
  'soil_00_10cm_sen',
  'soil_10_40cm_sen',
  'soil_40_100cm_sen',
  'soil_100_200cm_sen'
];

var slopeImages = [];

for (var i = 0; i < soilBands.length; i++) {

  var band = soilBands[i];

  var pairs = annual.select(['year', band]);

  var validCount = annual
    .select(band)
    .count();

  var slope = pairs
    .reduce(ee.Reducer.sensSlope())
    .select('slope')
    .updateMask(validCount.gte(20))
    .rename(outputNames[i]);

  slopeImages.push(slope);
}

var spatialTrends = ee.Image.cat(slopeImages)
  .clip(indusBasin);

print('Output bands:', spatialTrends.bandNames());

// --------------------------------------------------
// 5. MAP VISUALIZATION
// --------------------------------------------------

Map.centerObject(indusBasin, 6);

var vis = {
  min: -0.004,
  max: 0.004,
  palette: [
    '#b2182b',
    '#ef8a62',
    '#fddbc7',
    '#f7f7f7',
    '#d1e5f0',
    '#67a9cf',
    '#2166ac'
  ]
};

Map.addLayer(
  spatialTrends.select('soil_00_10cm_sen'),
  vis,
  '0–10 cm Soil Moisture Trend',
  true
);

Map.addLayer(
  spatialTrends.select('soil_10_40cm_sen'),
  vis,
  '10–40 cm Soil Moisture Trend',
  false
);

Map.addLayer(
  spatialTrends.select('soil_40_100cm_sen'),
  vis,
  '40–100 cm Soil Moisture Trend',
  false
);

Map.addLayer(
  spatialTrends.select('soil_100_200cm_sen'),
  vis,
  '100–200 cm Soil Moisture Trend',
  false
);

Map.addLayer(
  indusSubbasins.style({
    color: '222222',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Basin Boundary',
  true
);

// --------------------------------------------------
// 6. EXPORT FOUR-BAND GEOTIFF
// --------------------------------------------------

Export.image.toDrive({
  image: spatialTrends.unmask(-9999),
  description: 'Indus_JJAS_Soil_Moisture_Sen_Slope_2001_2025',
  fileNamePrefix:
    'indus_jjas_soil_moisture_sen_slope_qc_2001_2025',
  region: indusBasin,
  scale: 10000,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    noData: -9999
  }
});

print('Spatial soil moisture export configured.');
