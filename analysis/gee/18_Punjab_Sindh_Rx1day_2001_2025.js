
/*
 * NASA Earth System Trend Detective
 * Punjab vs Sindh — Regional Rx1day
 * 2001–2025 | June–September
 */

// 1. Indus Basin
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusBasin = basins
  .filter(ee.Filter.eq('MAIN_BAS', 4060033640))
  .geometry();

// 2. Punjab and Sindh boundaries
var provinces = ee.FeatureCollection(
  'FAO/GAUL/2015/level1'
).filter(
  ee.Filter.eq('ADM0_NAME', 'Pakistan')
);

var punjab = provinces
  .filter(ee.Filter.eq('ADM1_NAME', 'Punjab'))
  .geometry()
  .intersection(indusBasin, ee.ErrorMargin(100));

var sindh = provinces
  .filter(ee.Filter.eq('ADM1_NAME', 'Sindh'))
  .geometry()
  .intersection(indusBasin, ee.ErrorMargin(100));

// 3. Regional geometries
var regions = ee.FeatureCollection([
  ee.Feature(punjab, {region: 'Punjab'}),
  ee.Feature(sindh, {region: 'Sindh'})
]);

// 4. IMERG V07
var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
).select('precipitation');

// 5. Calculate Rx1day for each year
var years = ee.List.sequence(2001, 2025);

var annualResults = ee.FeatureCollection(
  years.map(function(year) {
    year = ee.Number(year);

    var start = ee.Date.fromYMD(year, 6, 1);
    var end = ee.Date.fromYMD(year, 10, 1);

    var days = ee.List.sequence(
      0, end.difference(start, 'day').subtract(1)
    );

    var dailyRain = ee.ImageCollection.fromImages(
      days.map(function(day) {
        var date = start.advance(day, 'day');

        var halfHourly = imerg.filterDate(
          date, date.advance(1, 'day')
        );

        return halfHourly.sum()
          .multiply(0.5)
          .rename('daily_mm')
          .set('image_count', halfHourly.size());
      })
    );

    var rx1day = dailyRain.max()
      .rename('rx1day_mm');

    var regionalMeans = rx1day.reduceRegions({
      collection: regions,
      reducer: ee.Reducer.mean(),
      scale: 10000,
      tileScale: 4
    });

    var incompleteDays = dailyRain.filter(
      ee.Filter.lt('image_count', 48)
    ).size();

    return regionalMeans.map(function(feature) {
      return ee.Feature(null, {
        year: year,
        region: feature.get('region'),
        rx1day_mm: feature.get('mean'),
        jjas_days: dailyRain.size(),
        incomplete_days: incompleteDays
      });
    });
  })
).flatten();

// 6. Print lightweight checks
print('Expected records:', 50);
print('Expected years:', 25);
print('Expected regions:', 2);

// 7. Export to Google Drive
Export.table.toDrive({
  collection: annualResults,
  description: 'Punjab_Sindh_Rx1day_2001_2025',
  fileNamePrefix: 'punjab_sindh_rx1day_2001_2025',
  fileFormat: 'CSV',
  selectors: [
    'year',
    'region',
    'rx1day_mm',
    'jjas_days',
    'incomplete_days'
  ]
});
