
/*
 NASA SPACE APPS CHALLENGE 2026
 Variable 4: Spatial Runoff Trends

 Dataset: NASA FLDAS Noah
 Period: 2001–2025
 Season: June–September (JJAS)

 Outputs: Pixel-wise Sen's slope
 Units: mm/year
*/

// =====================================
// 1. INDUS BASIN
// =====================================

var subbasins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
).filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var basin = subbasins.geometry();

Map.centerObject(basin, 6);


// =====================================
// 2. LOAD FLDAS
// =====================================

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
)
.filterDate('2001-01-01', '2026-01-01')
.filter(ee.Filter.calendarRange(6, 9, 'month'))
.select(['Qs_tavg', 'Qsb_tavg']);


// =====================================
// 3. MONTHLY RUNOFF DEPTHS
// =====================================

var monthly = fldas.map(function(img) {

  var date = ee.Date(img.get('system:time_start'));

  var seconds = date.advance(1, 'month')
    .difference(date, 'second');

  var surface = img.select('Qs_tavg')
    .multiply(seconds)
    .rename('surface');

  var subsurface = img.select('Qsb_tavg')
    .multiply(seconds)
    .rename('subsurface');

  var total = surface.add(subsurface)
    .rename('total');

  return surface.addBands(subsurface)
    .addBands(total)
    .copyProperties(img, ['system:time_start']);
});


// =====================================
// 4. ANNUAL JJAS TOTALS
// =====================================

var years = ee.List.sequence(2001, 2025);

var annual = ee.ImageCollection.fromImages(
  years.map(function(y) {

    y = ee.Number(y);

    var seasonal = monthly.filter(
      ee.Filter.calendarRange(y, y, 'year')
    ).sum();

    var yearBand = ee.Image.constant(y)
      .toFloat()
      .rename('year')
      .updateMask(seasonal.select('total').mask());

    return seasonal
      .addBands(yearBand)
      .set('year', y)
      .set('system:time_start',
        ee.Date.fromYMD(y, 1, 1).millis());
  })
);

print('Annual images:', annual.size());


// =====================================
// 5. QUALITY CONTROL
// =====================================

var validCount = annual.select('total').count();

var qcMask = validCount.gte(20);

print('Minimum valid years required:', 20);


// =====================================
// 6. PIXEL-WISE SEN'S SLOPE
// =====================================

function calculateSlope(band) {

  var paired = annual.select(['year', band]);

  return paired.reduce(
    ee.Reducer.sensSlope()
  )
  .select('slope')
  .rename(band + '_sen_slope')
  .updateMask(qcMask)
  .clip(basin);
}

var surfaceSlope = calculateSlope('surface');
var subsurfaceSlope = calculateSlope('subsurface');
var totalSlope = calculateSlope('total');


// =====================================
// 7. VISUALIZATION
// =====================================

var palette = [
  '#b2182b',
  '#ef8a62',
  '#f7f7f7',
  '#67a9cf',
  '#2166ac'
];

Map.addLayer(
  surfaceSlope,
  {min: -5, max: 5, palette: palette},
  'Surface Runoff Sen Slope',
  false
);

Map.addLayer(
  subsurfaceSlope,
  {min: -2, max: 2, palette: palette},
  'Subsurface Runoff Sen Slope',
  false
);

Map.addLayer(
  totalSlope,
  {min: -5, max: 5, palette: palette},
  'Total Runoff Sen Slope',
  true
);

Map.addLayer(
  ee.Image().byte().paint(
    ee.FeatureCollection([ee.Feature(basin)]),
    1, 2
  ),
  {palette: ['#222222']},
  'Indus Basin Boundary'
);


// =====================================
// 8. EXPORT SPATIAL TRENDS
// =====================================

var allSlopes = surfaceSlope
  .addBands(subsurfaceSlope)
  .addBands(totalSlope)
  .toFloat();

Export.image.toDrive({
  image: allSlopes,
  description: 'indus_jjas_runoff_sen_slope_qc_2001_2025',
  fileNamePrefix:
    'indus_jjas_runoff_sen_slope_qc_2001_2025',
  region: basin,
  scale: 10000,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    noData: -9999
  }
});

print('Spatial runoff trend analysis configured.');
