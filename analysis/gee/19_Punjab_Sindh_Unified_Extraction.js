
/*
 * NASA Earth System Trend Detective
 * Punjab vs Sindh — Unified Regional Extraction
 *
 * FINAL EXTRACTION: 2001–2025
 * Season: June–September (JJAS)
 *
 * DATASETS:
 * NASA GPM IMERG V07
 * NASA FLDAS Noah V001
 *
 * VARIABLES:
 * 1. Rx1day extreme precipitation (mm)
 * 2. Seasonal precipitation (mm)
 * 3. Surface runoff (mm)
 * 4. Subsurface runoff (mm)
 * 5. Total runoff (mm)
 * 6. Soil moisture 0–10 cm (m3/m3)
 * 7. Soil moisture 10–40 cm (m3/m3)
 * 8. Soil moisture 40–100 cm (m3/m3)
 * 9. Soil moisture 100–200 cm (m3/m3)
 *
 * REGIONS:
 * Punjab and Sindh intersected with
 * HydroBASINS Indus River Basin.
 *
 * OUTPUT:
 * 50 records (25 years x 2 regions)
 */

// ========================================
// 1. INDUS RIVER BASIN
// ========================================

var indusBasin = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
)
.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
)
.geometry();


// ========================================
// 2. PROVINCIAL BOUNDARIES
// ========================================

var provinces = ee.FeatureCollection(
  'FAO/GAUL/2015/level1'
)
.filter(
  ee.Filter.eq('ADM0_NAME', 'Pakistan')
);

var punjab = provinces
  .filter(
    ee.Filter.eq('ADM1_NAME', 'Punjab')
  )
  .geometry()
  .intersection(
    indusBasin,
    ee.ErrorMargin(100)
  );

var sindh = provinces
  .filter(
    ee.Filter.eq('ADM1_NAME', 'Sindh')
  )
  .geometry()
  .intersection(
    indusBasin,
    ee.ErrorMargin(100)
  );

var regions = ee.FeatureCollection([
  ee.Feature(punjab, {
    region: 'Punjab'
  }),
  ee.Feature(sindh, {
    region: 'Sindh'
  })
]);


// ========================================
// 3. NASA DATASETS
// ========================================

// IMERG precipitation rate: mm/hour.
// Half-hourly images.

var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
).select('precipitation');

// FLDAS monthly land-surface model data.

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
);

var soilBands = [
  'SoilMoi00_10cm_tavg',
  'SoilMoi10_40cm_tavg',
  'SoilMoi40_100cm_tavg',
  'SoilMoi100_200cm_tavg'
];


// ========================================
// 4. CONVERT MONTHLY RUNOFF TO mm
// ========================================

// FLDAS runoff rates are kg/m2/s,
// equivalent to mm/s of water.
//
// Multiply each monthly mean rate by
// the actual number of seconds in
// its calendar month.

var monthlyRunoff = fldas
  .select([
    'Qs_tavg',
    'Qsb_tavg'
  ])
  .map(function(image) {

    var date = ee.Date(
      image.get('system:time_start')
    );

    var seconds = date
      .advance(1, 'month')
      .difference(date, 'second');

    var surface = image
      .select('Qs_tavg')
      .multiply(seconds)
      .rename('surface_runoff_mm');

    var subsurface = image
      .select('Qsb_tavg')
      .multiply(seconds)
      .rename('subsurface_runoff_mm');

    return surface
      .addBands(subsurface)
      .copyProperties(
        image,
        ['system:time_start']
      );

  });


// ========================================
// 5. STUDY PERIOD
// ========================================

var years = ee.List.sequence(
  2001,
  2025
);


// ========================================
// 6. UNIFIED ANNUAL EXTRACTION
// ========================================

var annualResults = ee.FeatureCollection(
  years.map(function(year) {

    year = ee.Number(year);

    var start = ee.Date.fromYMD(
      year, 6, 1
    );

    var end = ee.Date.fromYMD(
      year, 10, 1
    );


    // ------------------------------------
    // A. DAILY IMERG PRECIPITATION
    // ------------------------------------

    var days = ee.List.sequence(
      0,
      end.difference(start, 'day')
        .subtract(1)
    );

    var dailyRain = ee.ImageCollection.fromImages(
      days.map(function(day) {

        var date = start.advance(
          day,
          'day'
        );

        var halfHourly = imerg.filterDate(
          date,
          date.advance(1, 'day')
        );

        // mm/hour x 0.5 hour = mm
        return halfHourly
          .sum()
          .multiply(0.5)
          .rename('daily_mm')
          .set(
            'image_count',
            halfHourly.size()
          );

      })
    );


    // ------------------------------------
    // B. Rx1day EXTREME PRECIPITATION
    // ------------------------------------

    // Maximum daily precipitation
    // at each pixel during JJAS.

    var rx1day = dailyRain
      .max()
      .rename('rx1day_mm');


    // ------------------------------------
    // C. JJAS SEASONAL PRECIPITATION
    // ------------------------------------

    // Sum all half-hourly rainfall depths
    // across June–September.

    var precipitation = imerg
      .filterDate(start, end)
      .sum()
      .multiply(0.5)
      .rename('precipitation_mm');


    // ------------------------------------
    // D. JJAS SURFACE + SUBSURFACE RUNOFF
    // ------------------------------------

    // Sum four converted monthly depths.

    var seasonalRunoff = monthlyRunoff
      .filterDate(start, end)
      .sum();

    var totalRunoff = seasonalRunoff
      .select('surface_runoff_mm')
      .add(
        seasonalRunoff.select(
          'subsurface_runoff_mm'
        )
      )
      .rename('total_runoff_mm');


    // ------------------------------------
    // E. JJAS SOIL MOISTURE
    // ------------------------------------

    // Mean of four monthly images,
    // for each of the four depths.

    var seasonalSoil = fldas
      .filterDate(start, end)
      .select(soilBands)
      .mean()
      .rename([
        'soil_0_10',
        'soil_10_40',
        'soil_40_100',
        'soil_100_200'
      ]);


    // ------------------------------------
    // F. COMBINE ALL NINE VARIABLES
    // ------------------------------------

    var combined = rx1day
      .addBands(precipitation)
      .addBands(seasonalRunoff)
      .addBands(totalRunoff)
      .addBands(seasonalSoil);


    // ------------------------------------
    // G. REGIONAL SPATIAL MEANS
    // ------------------------------------

    var regionalMeans = combined
      .reduceRegions({
        collection: regions,
        reducer: ee.Reducer.mean(),
        scale: 10000,
        tileScale: 4
      });


    // ------------------------------------
    // H. DATA COMPLETENESS CHECKS
    // ------------------------------------

    var incompleteDays = dailyRain
      .filter(
        ee.Filter.lt(
          'image_count',
          48
        )
      )
      .size();

    var imergCount = imerg
      .filterDate(start, end)
      .size();

    var fldasCount = fldas
      .filterDate(start, end)
      .size();


    // ------------------------------------
    // I. OUTPUT RECORDS
    // ------------------------------------

    return regionalMeans.map(
      function(f) {

        return ee.Feature(null, {

          year: year,
          region: f.get('region'),

          rx1day_mm:
            f.get('rx1day_mm'),

          precipitation_mm:
            f.get('precipitation_mm'),

          surface_runoff_mm:
            f.get('surface_runoff_mm'),

          subsurface_runoff_mm:
            f.get('subsurface_runoff_mm'),

          total_runoff_mm:
            f.get('total_runoff_mm'),

          soil_0_10:
            f.get('soil_0_10'),

          soil_10_40:
            f.get('soil_10_40'),

          soil_40_100:
            f.get('soil_40_100'),

          soil_100_200:
            f.get('soil_100_200'),

          jjas_days:
            dailyRain.size(),

          incomplete_days:
            incompleteDays,

          imerg_images:
            imergCount,

          fldas_months:
            fldasCount

        });

      }
    );

  })
).flatten();


// ========================================
// 7. LIGHTWEIGHT CONSOLE CHECKS
// ========================================

// Avoid evaluating all 25 years
// interactively in the Console.

print('Expected regional records:', 50);
print('Study years:', 25);
print('Regions:', 2);
print('Variables:', 9);
print('Expected JJAS days per year:', 122);
print('Expected FLDAS months per year:', 4);
print('Expected IMERG images per year:', 5856);


// ========================================
// 8. MAP VISUALIZATION
// ========================================

Map.centerObject(regions, 6);

Map.addLayer(
  regions.style({
    color: 'yellow',
    fillColor: '00000000',
    width: 2
  }),
  {},
  'Punjab and Sindh Study Areas'
);


// ========================================
// 9. EXPORT ALL VARIABLES TO GOOGLE DRIVE
// ========================================

Export.table.toDrive({

  collection: annualResults,

  description:
    'Punjab_Sindh_All_Variables_2001_2025',

  fileNamePrefix:
    'punjab_sindh_all_variables_2001_2025',

  fileFormat: 'CSV',

  selectors: [
    'year',
    'region',
    'rx1day_mm',
    'precipitation_mm',
    'surface_runoff_mm',
    'subsurface_runoff_mm',
    'total_runoff_mm',
    'soil_0_10',
    'soil_10_40',
    'soil_40_100',
    'soil_100_200',
    'jjas_days',
    'incomplete_days',
    'imerg_images',
    'fldas_months'
  ]

});
