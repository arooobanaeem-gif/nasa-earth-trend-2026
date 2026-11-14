
/*
 NASA SPACE APPS CHALLENGE 2026
 Variable 3: Spatial Snow Cover Trend
 MODIS MOD10A1 V6.1 | May–September | 2001–2025
*/

// 1. Define the Indus Basin
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

// 2. Load and filter MODIS snow cover
var snow = ee.ImageCollection('MODIS/061/MOD10A1')
  .filterDate('2001-01-01', '2026-01-01')
  .filter(ee.Filter.calendarRange(5, 9, 'month'))
  .select('NDSI_Snow_Cover');

// 3. Mask invalid values
var cleanSnow = snow.map(function(image) {
  var band = image.select('NDSI_Snow_Cover');

  return band
    .updateMask(band.gte(0).and(band.lte(100)))
    .rename('snow_cover')
    .copyProperties(image, ['system:time_start']);
});

// 4. Create annual seasonal mean images
var years = ee.List.sequence(2001, 2025);

var annualSnow = ee.ImageCollection.fromImages(
  years.map(function(year) {
    year = ee.Number(year);

    var annual = cleanSnow
      .filter(ee.Filter.calendarRange(year, year, 'year'))
      .mean()
      .rename('snow_cover');

    return annual
      .addBands(
        ee.Image.constant(year)
          .rename('year')
          .toFloat()
      )
      .set('year', year)
      .set('system:time_start',
        ee.Date.fromYMD(year, 1, 1).millis()
      );
  })
);

// 5. Calculate pixel-wise Sen's slope
var senSlope = annualSnow
  .select(['year', 'snow_cover'])
  .reduce(ee.Reducer.sensSlope())
  .select('slope');

// 6. Count valid annual observations
var validYears = annualSnow
  .select('snow_cover')
  .count();

// Require at least 20 valid years
var senSlopeQC = senSlope
  .updateMask(validYears.gte(20))
  .clip(indusBasin);

// 7. Display trend map
Map.centerObject(indusBasin, 6);

Map.addLayer(
  senSlopeQC,
  {
    min: -0.5,
    max: 0.5,
    palette: ['blue', 'white', 'red']
  },
  'Snow Cover Sen Slope (QC >=20 years)'
);

// 8. Export quality-filtered spatial trend
Export.image.toDrive({
  image: senSlopeQC,
  description: 'indus_may_sep_snow_sen_slope_qc_2001_2025',
  fileNamePrefix: 'indus_may_sep_snow_sen_slope_qc_2001_2025',
  region: indusBasin,
  scale: 500,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    noData: -9999
  }
});

// 9. Quick verification
print('Annual image count:', annualSnow.size());
print('Spatial trend band:', senSlopeQC.bandNames());
