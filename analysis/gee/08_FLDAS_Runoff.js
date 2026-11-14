
/*
 NASA SPACE APPS CHALLENGE 2026
 EARTH SYSTEM TREND DETECTIVE

 Variable 4: Surface and Subsurface Runoff
 Dataset: NASA FLDAS Noah V001
 Study Area: Entire Indus River Basin
 Study Period: 2001–2025
 Season: JJAS (June–September)

 Outputs:
 1. Annual JJAS runoff CSV (2001–2025)
 2. Surface runoff map for 2022
 3. Subsurface runoff map for 2022
 4. Total runoff map for 2022

 Units: mm per JJAS season
*/


// ========================================
// STEP 1: LOAD INDUS BASIN BOUNDARY
// ========================================

var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

// Select all level-6 subbasins belonging
// to the Indus main basin
var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

print('Indus subbasins:', indusSubbasins.size());

print(
  'Indus Basin area (km2):',
  indusBasin.area().divide(1e6)
);


// ========================================
// STEP 2: LOAD NASA FLDAS DATA
// ========================================

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
);

var studyPeriod = fldas.filterDate(
  '2001-01-01',
  '2026-01-01'
);

// JJAS: June, July, August, September
var jjas = studyPeriod.filter(
  ee.Filter.calendarRange(6, 9, 'month')
);

print('JJAS FLDAS image count:', jjas.size());

print(
  'First image date:',
  ee.Date(jjas.aggregate_min('system:time_start'))
    .format('YYYY-MM-dd')
);

print(
  'Last image date:',
  ee.Date(jjas.aggregate_max('system:time_start'))
    .format('YYYY-MM-dd')
);

print(
  'Available FLDAS bands:',
  ee.Image(jjas.first()).bandNames()
);


// ========================================
// STEP 3: SELECT RUNOFF BANDS
// ========================================

var runoffBands = jjas.select([
  'Qs_tavg',
  'Qsb_tavg'
]);

print(
  'Selected runoff bands:',
  ee.Image(runoffBands.first()).bandNames()
);

// Qs_tavg  = surface runoff
// Qsb_tavg = subsurface runoff
//
// Both are rates in kg/m2/s,
// equivalent to mm/s of water.


// ========================================
// STEP 4: CONVERT RUNOFF TO mm/MONTH
// ========================================

var monthlyRunoff = runoffBands.map(function(image) {

  var date = ee.Date(
    image.get('system:time_start')
  );

  // Actual seconds in each calendar month
  var seconds = date.advance(1, 'month')
    .difference(date, 'second');

  // Surface runoff depth
  var surface = image.select('Qs_tavg')
    .multiply(seconds)
    .rename('surface_runoff_mm');

  // Subsurface runoff depth
  var subsurface = image.select('Qsb_tavg')
    .multiply(seconds)
    .rename('subsurface_runoff_mm');

  return surface
    .addBands(subsurface)
    .copyProperties(image, ['system:time_start']);

});

print(
  'Converted monthly runoff bands:',
  ee.Image(monthlyRunoff.first()).bandNames()
);


// ========================================
// STEP 5: ANNUAL JJAS RUNOFF (2001–2025)
// ========================================

var years = ee.List.sequence(2001, 2025);

var annualRunoff = ee.FeatureCollection(
  years.map(function(year) {

    year = ee.Number(year);

    // Sum four months for the selected year
    var seasonal = monthlyRunoff
      .filter(
        ee.Filter.calendarRange(
          year, year, 'year'
        )
      )
      .sum();

    // Combined surface + subsurface runoff
    var total = seasonal
      .select('surface_runoff_mm')
      .add(
        seasonal.select('subsurface_runoff_mm')
      )
      .rename('total_runoff_mm');

    var combined = seasonal.addBands(total);

    // Basin-wide mean seasonal runoff depth
    var stats = combined.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusBasin,
      scale: 10000,
      maxPixels: 1e13,
      tileScale: 4
    });

    return ee.Feature(null, {
      year: year,
      surface_runoff_mm:
        stats.get('surface_runoff_mm'),
      subsurface_runoff_mm:
        stats.get('subsurface_runoff_mm'),
      total_runoff_mm:
        stats.get('total_runoff_mm')
    });

  })
);

print('Expected annual records:', years.size());


// ========================================
// STEP 6: EXPORT ANNUAL RUNOFF CSV
// ========================================

Export.table.toDrive({
  collection: annualRunoff,
  description: 'indus_jjas_runoff_2001_2025',
  fileNamePrefix: 'indus_jjas_runoff_2001_2025',
  fileFormat: 'CSV',
  selectors: [
    'year',
    'surface_runoff_mm',
    'subsurface_runoff_mm',
    'total_runoff_mm'
  ]
});


// ========================================
// STEP 7: MAP RUNOFF FOR 2022
// ========================================

// June–September 2022
var runoff2022 = monthlyRunoff
  .filterDate('2022-06-01', '2022-10-01')
  .sum();

// Surface runoff
var surface2022 = runoff2022
  .select('surface_runoff_mm')
  .clip(indusBasin);

// Subsurface runoff
var subsurface2022 = runoff2022
  .select('subsurface_runoff_mm')
  .clip(indusBasin);

// Total runoff
var total2022 = surface2022
  .add(subsurface2022)
  .rename('total_runoff_mm');


// ========================================
// STEP 8: VISUALIZATION SETTINGS
// ========================================

Map.centerObject(indusBasin, 6);

var runoffPalette = [
  '#ffffcc',
  '#c2e699',
  '#78c679',
  '#31a354',
  '#006837'
];

var totalPalette = [
  '#ffffcc',
  '#a1dab4',
  '#41b6c4',
  '#2c7fb8',
  '#253494'
];

// Surface runoff map
Map.addLayer(
  surface2022,
  {
    min: 0,
    max: 400,
    palette: runoffPalette
  },
  '2022 JJAS Surface Runoff (mm)',
  false
);

// Subsurface runoff map
Map.addLayer(
  subsurface2022,
  {
    min: 0,
    max: 400,
    palette: runoffPalette
  },
  '2022 JJAS Subsurface Runoff (mm)',
  false
);

// Total runoff map (visible by default)
Map.addLayer(
  total2022,
  {
    min: 0,
    max: 500,
    palette: totalPalette
  },
  '2022 JJAS Total Runoff (mm)',
  true
);


// ========================================
// STEP 9: INDUS BASIN OUTLINE
// ========================================

var basinOutline = ee.Image()
  .byte()
  .paint({
    featureCollection: ee.FeatureCollection([
      ee.Feature(indusBasin)
    ]),
    color: 1,
    width: 2
  });

Map.addLayer(
  basinOutline,
  {palette: ['#222222']},
  'Indus Basin Boundary',
  true
);


// ========================================
// STEP 10: FINISHED
// ========================================

print('FLDAS runoff processing configured.');
print('Annual JJAS period: 2001–2025');
print('Map year: 2022');
print('Runoff units: mm per JJAS season');
