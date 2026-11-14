
/*
 NASA Space Apps Challenge 2026
 Variable 7: Extreme Precipitation (Rx1day)
 Step 1: Verify GPM IMERG V07
*/

var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
);

print('IMERG first image:', imerg.first());
print('IMERG band names:', imerg.first().bandNames());

var sample = imerg.filterDate(
  '2022-07-01',
  '2022-07-02'
);

print('Images on July 1, 2022:', sample.size());

print('First image timestamp:',
  ee.Date(imerg.first().get('system:time_start'))
    .format('YYYY-MM-dd HH:mm')
);


/*
 Variable 7 — Step 2
 Verify precipitation band and units
*/

var firstImage = ee.Image(imerg.first());

print(
  'Complete IMERG band list:',
  firstImage.bandNames()
);

print(
  'Precipitation band metadata:',
  firstImage.select('precipitation')
);

print(
  'Sample precipitation projection:',
  firstImage.select('precipitation').projection()
);

print(
  'Sample image properties:',
  firstImage.propertyNames()
);

/*
 Variable 7 — Step 3
 Test daily IMERG rainfall aggregation
 Date: July 1, 2022 (UTC)
*/

// Indus Basin
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

// Select one UTC day
var dayStart = ee.Date('2022-07-01');
var dayEnd = dayStart.advance(1, 'day');

var dailyImages = imerg
  .filterDate(dayStart, dayEnd)
  .select('precipitation');

print('Half-hourly images:', dailyImages.size());

// Convert mm/hour to mm per 30 minutes
var rainfallDepths = dailyImages.map(function(img) {
  return img.multiply(0.5).rename('rain_mm');
});

// Sum to daily rainfall depth
var dailyRain = rainfallDepths.sum()
  .rename('daily_rain_mm');

print('Daily rainfall band:', dailyRain.bandNames());

// Basin-wide mean daily rainfall
var basinStats = dailyRain.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: indusBasin,
  scale: 10000,
  maxPixels: 1e13,
  tileScale: 4
});

print('Basin mean daily rainfall (mm):', basinStats);

// Visualize
Map.centerObject(indusBasin, 6);

Map.addLayer(
  dailyRain.clip(indusBasin),
  {
    min: 0,
    max: 50,
    palette: [
      '#ffffff',
      '#c6dbef',
      '#6baed6',
      '#2171b5',
      '#08306b'
    ]
  },
  'Daily Rainfall — July 1, 2022'
);

Map.addLayer(
  indusSubbasins.style({
    color: '222222',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Basin Boundary'
);


/*
 Variable 7 — Step 4
 Test annual JJAS Rx1day for 2022
 Pixel-wise maximum daily precipitation
*/

// June 1 through September 30, 2022 (UTC)
var seasonStart = ee.Date('2022-06-01');
var seasonEnd = ee.Date('2022-10-01');

var nDays = seasonEnd.difference(
  seasonStart, 'day'
);

print('JJAS days in 2022:', nDays);

// Build daily rainfall images
var dayOffsets = ee.List.sequence(
  0, nDays.subtract(1)
);

var dailyCollection = ee.ImageCollection.fromImages(
  dayOffsets.map(function(offset) {

    var start = seasonStart.advance(
      ee.Number(offset), 'day'
    );

    var end = start.advance(1, 'day');

    var halfHourly = imerg
      .filterDate(start, end)
      .select('precipitation');

    var dailyTotal = halfHourly
      .sum()
      .multiply(0.5)
      .rename('daily_rain_mm');

    return dailyTotal
      .set('system:time_start', start.millis())
      .set('date', start.format('YYYY-MM-dd'))
      .set('image_count', halfHourly.size());
  })
);

print('Daily rainfall images:', dailyCollection.size());

// Check for missing half-hourly observations
var incompleteDays = dailyCollection.filter(
  ee.Filter.neq('image_count', 48)
);

print('Incomplete days:', incompleteDays.size());

// Maximum daily rainfall at each pixel
var rx1day2022 = dailyCollection
  .max()
  .rename('rx1day_mm');

// Basin-wide mean of pixel-wise Rx1day
var stats = rx1day2022.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: indusBasin,
  scale: 10000,
  maxPixels: 1e13,
  tileScale: 4
});

print('2022 basin mean Rx1day (mm):', stats);

// Map
Map.addLayer(
  rx1day2022.clip(indusBasin),
  {
    min: 0,
    max: 150,
    palette: [
      '#ffffff',
      '#c6dbef',
      '#6baed6',
      '#2171b5',
      '#08306b',
      '#4a1486'
    ]
  },
  '2022 JJAS Rx1day (mm)'
);


/*
 Variable 7 — Step 5
 Annual JJAS Rx1day: 2001–2025

 Method:
 1. Aggregate half-hourly precipitation to daily totals
 2. Find each pixel's maximum daily rainfall per JJAS season
 3. Calculate basin mean of pixel-wise maxima

 Units: mm
 Daily boundaries: UTC
*/

var rxYears = ee.List.sequence(2001, 2025);

var annualRx1day = ee.FeatureCollection(
  rxYears.map(function(year) {

    year = ee.Number(year);

    var start = ee.Date.fromYMD(year, 6, 1);
    var end = ee.Date.fromYMD(year, 10, 1);

    var days = end.difference(start, 'day');

    var offsets = ee.List.sequence(
      0, days.subtract(1)
    );

    var dailyImages = ee.ImageCollection.fromImages(
      offsets.map(function(offset) {

        var dayStart = start.advance(
          ee.Number(offset), 'day'
        );

        var dayEnd = dayStart.advance(1, 'day');

        var halfHourly = imerg
          .filterDate(dayStart, dayEnd)
          .select('precipitation');

        var dailyRain = halfHourly
          .sum()
          .multiply(0.5)
          .rename('daily_rain_mm');

        return dailyRain.set({
          'system:time_start': dayStart.millis(),
          'image_count': halfHourly.size()
        });
      })
    );

    // Pixel-wise maximum daily rainfall
    var annualMax = dailyImages
      .max()
      .rename('rx1day_mm');

    // Basin mean of pixel-wise annual maxima
    var basinMean = annualMax.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusBasin,
      scale: 10000,
      maxPixels: 1e13,
      tileScale: 4
    });

    // Number of incomplete UTC days
    var incompleteDays = dailyImages.filter(
      ee.Filter.neq('image_count', 48)
    ).size();

    return ee.Feature(null, basinMean).set({
      'year': year,
      'jjas_days': days,
      'incomplete_days': incompleteDays
    });
  })
);

print('Annual Rx1day records:', annualRx1day.size());

print(
  'First annual Rx1day record:',
  annualRx1day.first()
);

print(
  '2022 annual Rx1day record:',
  annualRx1day.filter(
    ee.Filter.eq('year', 2022)
  ).first()
);

// Export annual statistics
Export.table.toDrive({
  collection: annualRx1day,
  description: 'Indus_JJAS_Rx1day_2001_2025',
  fileNamePrefix: 'indus_jjas_rx1day_2001_2025',
  fileFormat: 'CSV',
  selectors: [
    'year',
    'rx1day_mm',
    'jjas_days',
    'incomplete_days'
  ]
});

print('Annual Rx1day CSV export configured.');
