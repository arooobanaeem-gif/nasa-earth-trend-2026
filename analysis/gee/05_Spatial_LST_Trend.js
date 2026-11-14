
/*
 NASA SPACE APPS CHALLENGE 2026
 Variable 2: Land Surface Temperature
 Dataset: MODIS Terra MOD11A2 Collection 6.1
 Study period: 2001–2025
*/

// Load NASA MODIS 8-day LST
var modis = ee.ImageCollection('MODIS/061/MOD11A2');

// Filter to our study period
var studyPeriod = modis.filterDate(
  '2001-01-01',
  '2026-01-01'
);

// Filter to JJAS: June–September
var jjas = studyPeriod.filter(
  ee.Filter.calendarRange(6, 9, 'month')
);

// Select daytime LST band
var lst = jjas.select('LST_Day_1km');

// Verify dataset
print('JJAS MODIS image count:', lst.size());

print(
  'First image date:',
  ee.Date(lst.aggregate_min('system:time_start'))
    .format('YYYY-MM-dd')
);

print(
  'Last image date:',
  ee.Date(lst.aggregate_max('system:time_start'))
    .format('YYYY-MM-dd')
);

print(
  'Selected band:',
  ee.Image(lst.first()).bandNames()
);

/*
 STEP 4.3 — MODIS LST PROCESSING
 Scale to Celsius and apply QC flags
*/

// Use the original collection to retain QC_Day
var processedLST = jjas.map(function(image) {

  var qc = image.select('QC_Day');

  // Bits 0–1: mandatory QA
  // Keep only good-quality LST (bits = 00)
  var goodQuality = qc.bitwiseAnd(3).eq(0);

  // Convert scaled Kelvin to Celsius
  var lstCelsius = image
    .select('LST_Day_1km')
    .multiply(0.02)
    .subtract(273.15)
    .rename('LST_Celsius');

  return lstCelsius
    .updateMask(goodQuality)
    .copyProperties(image, ['system:time_start']);
});

// Verify processing
print('Processed LST image count:', processedLST.size());

print(
  'Processed band:',
  ee.Image(processedLST.first()).bandNames()
);

// Load Indus Basin
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusGeometry = indusSubbasins.geometry().dissolve(100);

// Preview average JJAS daytime LST for 2022
var lst2022 = processedLST
  .filterDate('2022-06-01', '2022-10-01')
  .mean()
  .clip(indusGeometry);

Map.centerObject(indusGeometry, 5);

Map.addLayer(
  lst2022,
  {
    min: 0,
    max: 45,
    palette: [
      '313695',
      '74add1',
      'abd9e9',
      'ffffbf',
      'fdae61',
      'd73027'
    ]
  },
  'JJAS Daytime LST 2022 (°C)'
);

print('2022 LST image:', lst2022);


/*
 STEP 4.4 — ANNUAL JJAS LAND SURFACE TEMPERATURE
 Study period: 2001–2025
 Units: degrees Celsius
*/

// Generate annual JJAS temperature composites
var years = ee.List.sequence(2001, 2025);

var annualLST = ee.ImageCollection.fromImages(
  years.map(function(year) {
    year = ee.Number(year);

    var yearlyLST = processedLST.filter(
      ee.Filter.calendarRange(year, year, 'year')
    );

    var seasonalMean = yearlyLST
      .mean()
      .rename('JJAS_LST_Celsius');

    return seasonalMean.set({
      year: year,
      'system:time_start': ee.Date.fromYMD(year, 6, 1).millis()
    });
  })
);

// Verify annual collection
print('Number of annual LST images:', annualLST.size());

print('Annual LST years:', annualLST.aggregate_array('year'));

print('First annual LST image:', annualLST.first());


/*
 STEP 5 — SPATIAL LST TREND
 Pixel-wise Sen's slope | 2001–2025
 Units: °C/year
*/

// Add a year band to each annual LST image
var lstWithYear = annualLST.map(function(image) {
  var year = ee.Image.constant(
    ee.Number(image.get('year'))
  ).toFloat().rename('year');

  return year
    .addBands(image.select('JJAS_LST_Celsius').toFloat())
    .clip(indusGeometry);
});

// Calculate pixel-wise Sen's slope
var spatialLSTTrend = lstWithYear
  .select(['year', 'JJAS_LST_Celsius'])
  .reduce(ee.Reducer.sensSlope())
  .select('slope')
  .rename('LST_Sen_Slope')
  .clip(indusGeometry);

// Display the trend
Map.layers().reset();

Map.centerObject(indusGeometry, 5);

Map.addLayer(
  spatialLSTTrend,
  {
    min: -0.15,
    max: 0.15,
    palette: [
      '2166ac',
      '67a9cf',
      'f7f7f7',
      'ef8a62',
      'b2182b'
    ]
  },
  'JJAS LST Sen Slope (°C/year)'
);

print('Spatial LST trend image:', spatialLSTTrend);


/*
 EXPORT SPATIAL LST SEN'S SLOPE
 2001–2025 | °C/year
*/

Export.image.toDrive({
  image: spatialLSTTrend.toFloat(),
  description: 'Indus_JJAS_LST_Sen_Slope_2001_2025',
  folder: 'NASA_Earth_Trend_2026',
  fileNamePrefix: 'indus_jjas_lst_sen_slope_2001_2025',
  region: indusGeometry,
  scale: 1000,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    noData: -9999
  }
});

