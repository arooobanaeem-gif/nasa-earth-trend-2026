
/*
 NASA SPACE APPS CHALLENGE 2026
 Variable 3: Snow Cover
 Dataset: MODIS Terra MOD10A1 Collection 6.1
 Study period: 2001–2025
*/

// Load daily MODIS snow-cover images
var modisSnow = ee.ImageCollection('MODIS/061/MOD10A1');

// Filter study period
var studyPeriod = modisSnow.filterDate(
  '2001-01-01',
  '2026-01-01'
);

// Filter May–September (melt season)
var meltSeason = studyPeriod.filter(
  ee.Filter.calendarRange(5, 9, 'month')
);

// Select fractional snow-cover band
var snowCover = meltSeason.select('NDSI_Snow_Cover');

// Verify dataset
print('Melt-season MODIS image count:', snowCover.size());

print(
  'First image date:',
  ee.Date(snowCover.aggregate_min('system:time_start'))
    .format('YYYY-MM-dd')
);

print(
  'Last image date:',
  ee.Date(snowCover.aggregate_max('system:time_start'))
    .format('YYYY-MM-dd')
);

print(
  'Selected band:',
  ee.Image(snowCover.first()).bandNames()
);


/*
 STEP 2: Mask invalid snow-cover observations
*/

// Keep only valid NDSI snow-cover values (0–100)
function maskSnow(image) {
  var snow = image.select('NDSI_Snow_Cover');

  var validMask = snow.gte(0).and(snow.lte(100));

  return snow
    .updateMask(validMask)
    .rename('snow_cover')
    .copyProperties(image, ['system:time_start']);
}

// Apply masking to all images
var cleanSnow = snowCover.map(maskSnow);

// Verify masking
print('Original image count:', snowCover.size());
print('Masked image count:', cleanSnow.size());

print(
  'First masked image:',
  cleanSnow.first()
);


/*
 STEP 3: Define the complete Indus River Basin
 Using HydroBASINS Level 6
*/

// Load HydroBASINS Level 6
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

// Main Indus Basin identifier
var MAIN_BAS = 4060033640;

// Select all subbasins belonging to the Indus Basin
var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', MAIN_BAS)
);

// Dissolve subbasins into one basin geometry
var indusBasin = indusSubbasins.geometry();

// Verify boundary
print('Indus subbasin count:', indusSubbasins.size());

print(
  'Indus Basin area (km²):',
  indusBasin.area().divide(1e6)
);

// Display on map
Map.centerObject(indusBasin, 6);

Map.addLayer(
  indusBasin,
  {color: 'red'},
  'Complete Indus Basin'
);


/*
 STEP 4: Annual May–September Snow Cover
 Indus River Basin | 2001–2025
*/

// Create list of years
var years = ee.List.sequence(2001, 2025);

// Calculate basin-wide seasonal mean for each year
var annualSnow = ee.FeatureCollection(
  years.map(function(year) {
    year = ee.Number(year);

    var yearlyImages = cleanSnow.filter(
      ee.Filter.calendarRange(year, year, 'year')
    );

    // Mean snow-cover value for each pixel
    var seasonalMean = yearlyImages.mean();

    // Spatial mean across entire Indus Basin
    var stats = seasonalMean.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusBasin,
      scale: 500,
      maxPixels: 1e13,
      tileScale: 4
    });

    return ee.Feature(null, {
      year: year,
      snow_cover_mean: stats.get('snow_cover'),
      image_count: yearlyImages.size()
    });
  })
);

// Inspect results
// Quick check without evaluating annual spatial statistics
print('Expected number of years:', years.size());
print('Year range:', years);

// Export annual CSV
Export.table.toDrive({
  collection: annualSnow,
  description: 'indus_may_sep_snow_2001_2025',
  fileFormat: 'CSV',
  selectors: [
    'year',
    'snow_cover_mean',
    'image_count'
  ]
});
