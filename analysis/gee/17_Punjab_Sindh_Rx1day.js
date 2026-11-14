
/*
 * NASA Earth System Trend Detective
 * Punjab vs Sindh Regional Rx1day
 * Test year: 2022
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

var punjab = provinces.filter(
  ee.Filter.eq('ADM1_NAME', 'Punjab')
).geometry().intersection(indusBasin, ee.ErrorMargin(100));

var sindh = provinces.filter(
  ee.Filter.eq('ADM1_NAME', 'Sindh')
).geometry().intersection(indusBasin, ee.ErrorMargin(100));

// 3. GPM IMERG half-hourly precipitation
var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
).select('precipitation');

// 4. JJAS 2022 dates
var start = ee.Date('2022-06-01');
var end = ee.Date('2022-10-01');

var days = ee.List.sequence(
  0, end.difference(start, 'day').subtract(1)
);

// 5. Calculate daily precipitation (mm)
var dailyRain = ee.ImageCollection.fromImages(
  days.map(function(day) {
    var date = start.advance(day, 'day');

    var halfHourly = imerg.filterDate(
      date, date.advance(1, 'day')
    );

    return halfHourly.sum()
      .multiply(0.5)
      .rename('daily_mm')
      .set('system:time_start', date.millis())
      .set('image_count', halfHourly.size());
  })
);

// 6. Pixel-wise annual maximum daily rainfall
var rx1day = dailyRain.max().rename('rx1day_mm');

// 7. Regional means
var regions = ee.FeatureCollection([
  ee.Feature(punjab, {region: 'Punjab'}),
  ee.Feature(sindh, {region: 'Sindh'})
]);

var regionalResults = rx1day.reduceRegions({
  collection: regions,
  reducer: ee.Reducer.mean(),
  scale: 10000,
  tileScale: 4
});


print(
  'Punjab Rx1day 2022 (mm):',
  regionalResults
    .filter(ee.Filter.eq('region', 'Punjab'))
    .first()
    .get('mean')
);

print(
  'Sindh Rx1day 2022 (mm):',
  regionalResults
    .filter(ee.Filter.eq('region', 'Sindh'))
    .first()
    .get('mean')
);


// 8. Check data completeness
print('Number of JJAS days:', dailyRain.size());

print('Days with incomplete IMERG coverage:',
  dailyRain.filter(
    ee.Filter.lt('image_count', 48)
  ).size()
);

// 9. Visualize
Map.centerObject(regions, 7);

Map.addLayer(
  rx1day.clip(indusBasin),
  {
    min: 0,
    max: 120,
    palette: ['white', 'yellow', 'orange', 'red', 'purple']
  },
  'Rx1day 2022 (mm)',
  false
);

Map.addLayer(
  regions.style({
    color: 'black',
    fillColor: '00000000',
    width: 2
  }),
  {},
  'Punjab and Sindh'
);
