
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
 STEP 4.4.2 — BASIN-WIDE ANNUAL JJAS LST
 2001–2025 | Celsius
*/

// Calculate spatial mean for each annual image
var basinLSTSeries = ee.FeatureCollection(
  annualLST.map(function(image) {

    var meanLST = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusGeometry,
      scale: 5000,
      maxPixels: 1e9,
      tileScale: 4
    });

    return ee.Feature(null, {
      year: image.get('year'),
      lst_celsius: meanLST.get('JJAS_LST_Celsius')
    });
  })
);

// Print annual temperature values
print(
  'Basin-wide annual JJAS LST:',
  basinLSTSeries.sort('year')
);

// Create temperature time-series chart
var lstChart = ui.Chart.feature.byFeature({
  features: basinLSTSeries.sort('year'),
  xProperty: 'year',
  yProperties: ['lst_celsius']
})
.setChartType('LineChart')
.setOptions({
  title: 'Indus Basin JJAS Daytime LST (2001–2025)',
  hAxis: {title: 'Year'},
  vAxis: {title: 'Mean daytime land surface temperature (°C)'},
  lineWidth: 2,
  pointSize: 4,
  legend: {position: 'none'}
});

print(lstChart);


/*
 EXPORT ANNUAL JJAS LAND SURFACE TEMPERATURE
 Indus Basin | 2001–2025
*/

Export.table.toDrive({
  collection: basinLSTSeries,
  description: 'Indus_JJAS_LST_2001_2025',
  folder: 'NASA_Earth_Trend_2026',
  fileNamePrefix: 'indus_jjas_lst_2001_2025',
  fileFormat: 'CSV',
  selectors: ['year', 'lst_celsius']
});
