
var gpm = ee.ImageCollection('NASA/GPM_L3/IMERG_V07');

// Filter to the 25-year study period
var studyPeriod = gpm.filterDate(
  '2001-01-01',
  '2026-01-01'
);

// Select June to September each year
var jjas = studyPeriod.filter(
  ee.Filter.calendarRange(6, 9, 'month')
);

// Keep the precipitation band only
var precipitation = jjas.select('precipitation');

// Print summary information
print('JJAS image count:', precipitation.size());

print('First JJAS image date:',
  ee.Date(precipitation.aggregate_min('system:time_start'))
    .format('YYYY-MM-dd')
);

print('Last JJAS image date:',
  ee.Date(precipitation.aggregate_max('system:time_start'))
    .format('YYYY-MM-dd')
);

print('Selected band:',
  ee.Image(precipitation.first()).bandNames()
);

 // Create a list of years: 2001 to 2025
var years = ee.List.sequence(2001, 2025);

// Calculate JJAS precipitation total for each year
var annualJJAS = ee.ImageCollection.fromImages(
  years.map(function(year) {
    year = ee.Number(year);

    // Select June–September observations
    var yearlyImages = precipitation.filter(
      ee.Filter.calendarRange(year, year, 'year')
    );

    // Convert mm/hour to mm per 30 minutes,
    // then sum all observations
    var totalRainfall = yearlyImages
      .map(function(image) {
        return image.multiply(0.5);
      })
      .sum()
      .rename('JJAS_precip_mm');

    return totalRainfall
      .set('year', year)
      .set('system:time_start',
        ee.Date.fromYMD(year, 6, 1).millis()
      );
  })
);

// Verify the annual collection
print('Number of annual images:', annualJJAS.size());

print(
  'Years:',
  annualJJAS.aggregate_array('year')
);

print(
  'First annual image:',
  annualJJAS.first()
);

// Load the dissolved Indus Basin boundary
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusGeometry = indusSubbasins.geometry().dissolve(100);

// Select the 2022 JJAS precipitation image
var rain2022 = ee.Image(
  annualJJAS.filter(ee.Filter.eq('year', 2022)).first()
);

// Clip precipitation to the Indus Basin
var clippedRain2022 = rain2022.clip(indusGeometry);

// Visualization settings (millimeters)
var rainVis = {
  min: 0,
  max: 1500,
  palette: [
    'fff7bc',
    'fec44f',
    'fe9929',
    'ec7014',
    'cc4c02',
    '662506'
  ]
};

// Center the map on the basin
Map.centerObject(indusGeometry, 5);

// Display precipitation
Map.addLayer(
  clippedRain2022,
  rainVis,
  'JJAS Precipitation 2022 (mm)'
);

// Display the basin outline
Map.addLayer(
  indusSubbasins.style({
    color: '000000',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Sub-basin Boundaries',
  false
);

print('2022 precipitation image:', rain2022);


// Calculate basin-wide mean JJAS rainfall for each year
var basinRainfallSeries = ee.FeatureCollection(
  annualJJAS.map(function(image) {

    var meanRainfall = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusGeometry,
      scale: 11132,
      maxPixels: 1e9,
      tileScale: 4
    });

    return ee.Feature(null, {
      year: image.get('year'),
      precipitation_mm: meanRainfall.get('JJAS_precip_mm')
    });
  })
);

// Print the resulting table
print('Basin-wide JJAS rainfall:', basinRainfallSeries);

// Plot the annual time series
var rainfallChart = ui.Chart.feature.byFeature({
  features: basinRainfallSeries.sort('year'),
  xProperty: 'year',
  yProperties: ['precipitation_mm']
})
.setChartType('LineChart')
.setOptions({
  title: 'Indus Basin JJAS Precipitation (2001–2025)',
  hAxis: {title: 'Year'},
  vAxis: {title: 'Mean JJAS precipitation (mm)'},
  lineWidth: 2,
  pointSize: 4,
  legend: {position: 'none'}
});

print(rainfallChart);



/*
 STEP 3.4 — SPATIAL PRECIPITATION TREND
 Indus Basin | JJAS | 2001–2025
*/

// Add a year band to every annual precipitation image
var annualWithYear = annualJJAS.map(function(image) {
  var year = ee.Number(image.get('year'));

  var yearBand = ee.Image.constant(year)
    .toFloat()
    .rename('year');

  return yearBand
    .addBands(image.select('JJAS_precip_mm').toFloat())
    .copyProperties(image, ['year', 'system:time_start']);
});

// Calculate pixel-wise Sen's slope
var spatialTrend = annualWithYear
  .select(['year', 'JJAS_precip_mm'])
  .reduce(ee.Reducer.sensSlope());

// Select slope band and clip to basin
var slopeMap = spatialTrend
  .select('slope')
  .clip(indusGeometry);

// Display slope (mm/year)
var slopeVis = {
  min: -15,
  max: 15,
  palette: [
    '8c2d04',
    'd94801',
    'fdbb84',
    'f7f7f7',
    'a6bddb',
    '3690c0',
    '034e7b'
  ]
};

Map.addLayer(
  slopeMap,
  slopeVis,
  'JJAS Sen Slope 2001–2025 (mm/year)'
);

print('Spatial Sen slope image:', slopeMap);


/*
 EXPORT SPATIAL SEN'S SLOPE
 Units: mm/year
*/

Export.image.toDrive({
  image: slopeMap.toFloat(),
  description: 'Indus_JJAS_Sen_Slope_2001_2025',
  folder: 'NASA_Earth_Trend_2026',
  fileNamePrefix: 'indus_jjas_sen_slope_2001_2025',
  region: indusGeometry,
  scale: 11132,
  crs: 'EPSG:4326',
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF'
});

