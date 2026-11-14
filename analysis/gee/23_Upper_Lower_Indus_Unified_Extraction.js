
/*
 * NASA Earth System Trend Detective
 * Upper vs Lower Indus — Unified Extraction
 *
 * PERIOD: 2001–2025
 *
 * REGIONAL DEFINITION:
 * Chashma-area HydroBASINS L6 partition
 * Boundary HYBAS_ID: 4060718650
 *
 * Upper: selected subbasin + upstream catchment
 * Lower: all remaining Indus subbasins
 *
 * EXPECTED:
 * Upper: 43 subbasins
 * Lower: 58 subbasins
 *
 * 12 VARIABLES:
 *  1. Rx1day precipitation (mm)
 *  2. Seasonal precipitation (mm)
 *  3. Surface runoff (mm)
 *  4. Subsurface runoff (mm)
 *  5. Total runoff (mm)
 *  6. Soil moisture 0–10 cm (m3/m3)
 *  7. Soil moisture 10–40 cm (m3/m3)
 *  8. Soil moisture 40–100 cm (m3/m3)
 *  9. Soil moisture 100–200 cm (m3/m3)
 * 10. Daytime LST (degrees C)
 * 11. NDSI snow-cover index (0–100)
 * 12. Snow water equivalent (mm)
 *
 * SEASONS:
 * JJAS: precipitation, LST, runoff, soil moisture
 * May–Sep: snow-cover index, SWE
 *
 * OUTPUT:
 * One CSV, 50 rows (25 years x 2 regions)
 *
 * NOTE:
 * MODIS daytime LST is not air temperature.
 * Snow-cover index is not percent snow-covered area.
 * FLDAS runoff and SWE are model-derived quantities.
 */


// ========================================
// 1. HYDROBASINS INDUS BASIN
// ========================================

var basin = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
).filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var basinGeometry = basin.geometry();

var boundaryId = 4060718650;


// ========================================
// 2. HYDROLOGICAL REGION CLASSIFICATION
// ========================================

// Trace each subbasin's NEXT_DOWN chain.
// A subbasin belongs to Upper if its downstream
// path reaches boundaryId.
//
// This matches the validated Python partition.

var ids = ee.List(
  basin.aggregate_array('HYBAS_ID')
);

var nextDown = ee.List(
  basin.aggregate_array('NEXT_DOWN')
);

function isUpstream(startId) {

  startId = ee.Number(startId);

  var result = ee.List.sequence(0, 101).iterate(
    function(step, state) {

      state = ee.Dictionary(state);

      var current = ee.Number(
        state.get('current')
      );

      var found = ee.Number(
        state.get('found')
      );

      var index = ids.indexOf(current);

      var next = ee.Number(
        ee.Algorithms.If(
          index.gte(0),
          nextDown.get(index.max(0)),
          -1
        )
      );

      var nowFound = found.max(
        ee.Number(current.eq(boundaryId))
      );

      return ee.Dictionary({
        current: ee.Number(
          ee.Algorithms.If(
            nowFound.eq(1),
            current,
            next
          )
        ),
        found: nowFound
      });

    },
    ee.Dictionary({
      current: startId,
      found: 0
    })
  );

  return ee.Number(
    ee.Dictionary(result).get('found')
  );
}

var upperIds = ids.map(function(id) {
  return ee.Algorithms.If(
    isUpstream(id).eq(1),
    id,
    null
  );
}).removeAll([null]);

var lowerIds = ids.removeAll(upperIds);

var upper = basin.filter(
  ee.Filter.inList('HYBAS_ID', upperIds)
);

var lower = basin.filter(
  ee.Filter.inList('HYBAS_ID', lowerIds)
);

var regions = ee.FeatureCollection([
  ee.Feature(upper.geometry(), {
    region: 'Upper Indus'
  }),
  ee.Feature(lower.geometry(), {
    region: 'Lower Indus'
  })
]);


// ========================================
// 3. DATASETS
// ========================================

// GPM IMERG V07: precipitation rate mm/hour.

var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
).select('precipitation');

// FLDAS Noah monthly land-surface model.

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
);

// MODIS Terra 8-day daytime LST.

var modisLST = ee.ImageCollection(
  'MODIS/061/MOD11A2'
).select([
  'LST_Day_1km',
  'QC_Day'
]);

// MODIS Terra daily NDSI snow cover.

var modisSnow = ee.ImageCollection(
  'MODIS/061/MOD10A1'
).select('NDSI_Snow_Cover');

var soilBands = [
  'SoilMoi00_10cm_tavg',
  'SoilMoi10_40cm_tavg',
  'SoilMoi40_100cm_tavg',
  'SoilMoi100_200cm_tavg'
];


// ========================================
// 4. FLDAS MONTHLY RUNOFF CONVERSION
// ========================================

// FLDAS runoff rates: kg/m2/s = mm/s.
// Convert using actual calendar month length.

var monthlyRunoff = fldas
  .select(['Qs_tavg', 'Qsb_tavg'])
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
// 5. MODIS LST PREPROCESSING
// ========================================

// MOD11A2 LST scale factor: 0.02 K.
// Convert Kelvin to degrees Celsius.
//
// QC_Day bits 0–1:
// 0 = good quality
// 1 = other quality
// 2/3 = not produced
//
// Here we retain mandatory QA values 0 and 1.
// We calculate a seasonal mean of valid 8-day
// composites; this is not an exact daily mean.

var processedLST = modisLST.map(
  function(image) {

    var qc = image.select('QC_Day');

    var mandatoryQA = qc
      .bitwiseAnd(3);

    var valid = mandatoryQA.lte(1);

    var lst = image
      .select('LST_Day_1km')
      .multiply(0.02)
      .subtract(273.15)
      .updateMask(valid)
      .rename('lst_c');

    return lst.copyProperties(
      image,
      ['system:time_start']
    );
  }
);


// ========================================
// 6. MODIS SNOW-COVER INDEX
// ========================================

// NDSI_Snow_Cover valid index values: 0–100.
// Mask values above 100 (special flags).
//
// This is a mean NDSI-derived snow-cover
// index, NOT snow-covered area percentage.

var processedSnow = modisSnow.map(
  function(image) {

    var snow = image.select(
      'NDSI_Snow_Cover'
    );

    return snow
      .updateMask(
        snow.gte(0).and(snow.lte(100))
      )
      .rename('snow_index')
      .copyProperties(
        image,
        ['system:time_start']
      );
  }
);


// ========================================
// 7. STUDY PERIOD
// ========================================

var years = ee.List.sequence(
  2001, 2025
);


// ========================================
// 8. UNIFIED ANNUAL EXTRACTION
// ========================================

var annualResults = ee.FeatureCollection(
  years.map(function(year) {

    year = ee.Number(year);

    var jjasStart = ee.Date.fromYMD(
      year, 6, 1
    );

    var jjasEnd = ee.Date.fromYMD(
      year, 10, 1
    );

    var snowStart = ee.Date.fromYMD(
      year, 5, 1
    );

    var snowEnd = jjasEnd;


    // ------------------------------------
    // A. DAILY IMERG PRECIPITATION
    // ------------------------------------

    var days = ee.List.sequence(
      0,
      jjasEnd.difference(
        jjasStart, 'day'
      ).subtract(1)
    );

    var dailyRain = ee.ImageCollection.fromImages(
      days.map(function(day) {

        var date = jjasStart.advance(
          day, 'day'
        );

        var halfHourly = imerg.filterDate(
          date,
          date.advance(1, 'day')
        );

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
    // B. Rx1day
    // ------------------------------------

    var rx1day = dailyRain
      .max()
      .rename('rx1day_mm');


    // ------------------------------------
    // C. JJAS PRECIPITATION
    // ------------------------------------

    var precipitation = imerg
      .filterDate(jjasStart, jjasEnd)
      .sum()
      .multiply(0.5)
      .rename('precipitation_mm');


    // ------------------------------------
    // D. JJAS RUNOFF
    // ------------------------------------

    var seasonalRunoff = monthlyRunoff
      .filterDate(jjasStart, jjasEnd)
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

    var seasonalSoil = fldas
      .filterDate(jjasStart, jjasEnd)
      .select(soilBands)
      .mean()
      .rename([
        'soil_0_10',
        'soil_10_40',
        'soil_40_100',
        'soil_100_200'
      ]);


    // ------------------------------------
    // F. JJAS DAYTIME LST
    // ------------------------------------

    var lstCollection = processedLST
      .filterDate(jjasStart, jjasEnd);

    var seasonalLST = lstCollection
      .mean()
      .rename('lst_c');


    // ------------------------------------
    // G. MAY–SEP SNOW-COVER INDEX
    // ------------------------------------

    var snowCollection = processedSnow
      .filterDate(snowStart, snowEnd);

    var seasonalSnow = snowCollection
      .mean()
      .rename('snow_index');


    // ------------------------------------
    // H. MAY–SEP SWE
    // ------------------------------------

    // SWE_inst is an instantaneous FLDAS
    // snow water equivalent field in mm.
    //
    // Use a seasonal mean, not a sum.

    var sweCollection = fldas
      .filterDate(snowStart, snowEnd)
      .select('SWE_inst');

    var seasonalSWE = sweCollection
      .mean()
      .rename('swe_mm');


    // ------------------------------------
    // I. COMBINE ALL 12 VARIABLES
    // ------------------------------------

    var combined = rx1day
      .addBands(precipitation)
      .addBands(seasonalRunoff)
      .addBands(totalRunoff)
      .addBands(seasonalSoil)
      .addBands(seasonalLST)
      .addBands(seasonalSnow)
      .addBands(seasonalSWE);


    // ------------------------------------
    // J. REGIONAL SPATIAL MEANS
    // ------------------------------------

    var regionalMeans = combined.reduceRegions({
      collection: regions,
      reducer: ee.Reducer.mean(),
      scale: 10000,
      tileScale: 4
    });


    // ------------------------------------
    // K. COMPLETENESS CHECKS
    // ------------------------------------

    var incompleteDays = dailyRain
      .filter(
        ee.Filter.lt('image_count', 48)
      )
      .size();

    var imergCount = imerg
      .filterDate(jjasStart, jjasEnd)
      .size();

    var fldasCount = fldas
      .filterDate(jjasStart, jjasEnd)
      .size();

    var lstCount = lstCollection.size();

    var snowCount = snowCollection.size();

    var sweCount = sweCollection.size();


    // ------------------------------------
    // L. OUTPUT RECORDS
    // ------------------------------------

    return regionalMeans.map(function(f) {

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

        lst_c:
          f.get('lst_c'),

        snow_index:
          f.get('snow_index'),

        swe_mm:
          f.get('swe_mm'),

        jjas_days:
          dailyRain.size(),

        incomplete_days:
          incompleteDays,

        imerg_images:
          imergCount,

        fldas_months:
          fldasCount,

        lst_composites:
          lstCount,

        snow_daily_images:
          snowCount,

        swe_months:
          sweCount

      });
    });

  })
).flatten();


// ========================================
// 9. BOUNDARY VALIDATION
// ========================================

print('Upper subbasins:', upper.size());
print('Lower subbasins:', lower.size());
print('Total subbasins:', basin.size());

print(
  'Upper area (km2):',
  upper.geometry().area(100).divide(1e6)
);

print(
  'Lower area (km2):',
  lower.geometry().area(100).divide(1e6)
);

print(
  'Expected records:', 50
);

print(
  'Variables:', 12
);


// ========================================
// 10. MAP
// ========================================

Map.centerObject(basinGeometry, 6);

Map.addLayer(
  upper.style({
    color: '1565C0',
    fillColor: '1565C044',
    width: 1
  }),
  {},
  'Upper Indus - Chashma upstream'
);

Map.addLayer(
  lower.style({
    color: 'E65100',
    fillColor: 'E6510044',
    width: 1
  }),
  {},
  'Lower Indus - Remaining basin'
);

Map.addLayer(
  basin.style({
    color: '333333',
    fillColor: '00000000',
    width: 2
  }),
  {},
  'Full Indus Basin'
);


// ========================================
// 11. EXPORT ONE UNIFIED CSV
// ========================================

Export.table.toDrive({

  collection: annualResults,

  description:
    'Upper_Lower_Indus_All_Variables_2001_2025',

  fileNamePrefix:
    'upper_lower_indus_all_variables_2001_2025',

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

    'lst_c',
    'snow_index',
    'swe_mm',

    'jjas_days',
    'incomplete_days',
    'imerg_images',
    'fldas_months',
    'lst_composites',
    'snow_daily_images',
    'swe_months'
  ]

});


/*
 * TEST EXPORT — 2022 only
 * Upper vs Lower Indus
 */

var test2022 = annualResults.filter(
  ee.Filter.eq('year', 2022)
);

Export.table.toDrive({
  collection: test2022,
  description: 'Upper_Lower_Indus_2022_TEST',
  fileNamePrefix: 'upper_lower_indus_2022_test',
  fileFormat: 'CSV',
  selectors: [
    'year', 'region',
    'rx1day_mm', 'precipitation_mm',
    'surface_runoff_mm',
    'subsurface_runoff_mm',
    'total_runoff_mm',
    'soil_0_10', 'soil_10_40',
    'soil_40_100', 'soil_100_200',
    'lst_c', 'snow_index', 'swe_mm',
    'jjas_days', 'incomplete_days',
    'imerg_images', 'fldas_months',
    'lst_composites', 'snow_daily_images',
    'swe_months'
  ]
});
