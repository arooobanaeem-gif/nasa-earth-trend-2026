
/*
NASA SPACE APPS CHALLENGE 2026
Earth System Trend Detective

COMPARISON 3:
High-Elevation vs Low-Elevation Indus Basin

Period: 2001–2025
Elevation threshold: 1500 m

Study area:
HydroBASINS Level 6
MAIN_BAS = 4060033640

Low elevation:  < 1500 m
High elevation: >= 1500 m

Variables:
 1. Rx1day precipitation
 2. JJAS precipitation
 3. Surface runoff
 4. Subsurface runoff
 5. Total runoff
 6. Soil moisture 0–10 cm
 7. Soil moisture 10–40 cm
 8. Soil moisture 40–100 cm
 9. Soil moisture 100–200 cm
10. Daytime LST
11. NDSI snow-cover index
12. SWE

IMPORTANT:
FLDAS runoff and SWE are model-derived.
Snow index is NOT snow-covered area percentage.
*/

// ==================================================
// 1. CONFIGURATION
// ==================================================

// TEST MODE:
// true  = only 2022, 2 records
// false = 2001–2025, 50 records

var TEST_MODE = false;

var START_YEAR = 2001;
var END_YEAR = 2025;

var ELEVATION_THRESHOLD = 1500;

var ANALYSIS_SCALE = 10000;


// ==================================================
// 2. INDUS BASIN
// ==================================================

var indusSubbasins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
).filter(
  ee.Filter.eq(
    'MAIN_BAS',
    4060033640
  )
);

var basin = indusSubbasins.geometry();

Map.centerObject(indusSubbasins, 6);


// ==================================================
// 3. DEM AND ELEVATION ZONES
// ==================================================

var dem = ee.Image(
  'USGS/SRTMGL1_003'
).select('elevation');

var lowMask = dem
  .lt(ELEVATION_THRESHOLD);

var highMask = dem
  .gte(ELEVATION_THRESHOLD);

// Use nearest-neighbor classification when
// sampling DEM-derived masks at coarser scales.
// This preserves categorical zone membership,
// but does not reproduce fractional elevation
// composition inside every 10 km pixel.



Map.addLayer(
  lowMask.selfMask().clip(basin),
  {
    palette: ['#e9a23b']
  },
  'Low elevation (<1500 m)'
);

Map.addLayer(
  highMask.selfMask().clip(basin),
  {
    palette: ['#377eb8']
  },
  'High elevation (>=1500 m)'
);

Map.addLayer(
  indusSubbasins.style({
    color: 'ffffff',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Basin Boundary'
);


// ==================================================
// 4. COLLECTIONS
// ==================================================

var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
);

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
);

var modisLST = ee.ImageCollection(
  'MODIS/061/MOD11A2'
);

var modisSnow = ee.ImageCollection(
  'MODIS/061/MOD10A1'
);


// ==================================================
// 5. HELPERS
// ==================================================

function getSeason(year, firstMonth, lastMonth) {

  year = ee.Number(year);

  var start = ee.Date.fromYMD(
    year,
    firstMonth,
    1
  );

  var end = ee.Date.fromYMD(
    year,
    lastMonth,
    1
  ).advance(
    1,
    'month'
  );

  return {
    start: start,
    end: end
  };
}


// --------------------------------------------------
// Area-weighted zonal mean
// --------------------------------------------------

function zonalMean(image, bandName, zoneMask) {

  // Convert mapped server-side band name
  // to a valid Earth Engine selector list.

  bandName = ee.String(bandName);

  var selected = image
    .select(
      ee.List([bandName])
    )
    .updateMask(zoneMask)
    .rename('value');

  var area = ee.Image.pixelArea();

  var numerator = selected
    .multiply(area)
    .rename('weighted');

  var denominator = area
    .updateMask(
      selected.mask()
    )
    .rename('valid_area');

  var combined = numerator.addBands(
    denominator
  );

  var stats = combined.reduceRegion({

    reducer: ee.Reducer.sum(),

    geometry: basin,

    scale: ANALYSIS_SCALE,

    maxPixels: 1e13,

    tileScale: 4

  });

  var weightedSum = ee.Number(
    stats.get('weighted')
  );

  var validArea = ee.Number(
    stats.get('valid_area')
  );

  return weightedSum.divide(
    validArea
  );
}


// --------------------------------------------------
// FLDAS runoff conversion
// --------------------------------------------------

function convertRunoff(image) {

  var date = ee.Date(
    image.get('system:time_start')
  );

  var seconds = date
    .advance(1, 'month')
    .difference(
      date,
      'second'
    );

  return image.select([
    'Qs_tavg',
    'Qsb_tavg'
  ]).multiply(
    seconds
  ).rename([
    'surface_runoff_mm',
    'subsurface_runoff_mm'
  ]).copyProperties(
    image,
    ['system:time_start']
  );
}


// ==================================================
// 6. ANNUAL IMAGE BUILDER
// ==================================================

function buildAnnualImages(year) {

  year = ee.Number(year);

  var jjas = getSeason(
    year,
    6,
    9
  );

  var maySep = getSeason(
    year,
    5,
    9
  );

  var days = ee.Number(
    jjas.end.difference(
      jjas.start,
      'day'
    )
  );


  // ================================================
  // A. IMERG PRECIPITATION
  // ================================================

  var imergJJAS = imerg
    .filterDate(
      jjas.start,
      jjas.end
    )
    .select('precipitation');

  // Half-hourly rainfall rate (mm/hour).
  // Convert each 30-minute image to depth (mm).

  var precipitation = imergJJAS
    .sum()
    .multiply(0.5)
    .rename('precipitation_mm');


  // Build daily totals for Rx1day.

  var dayIndices = ee.List.sequence(
    0,
    days.subtract(1)
  );

  var dailyCollection = ee.ImageCollection.fromImages(
    dayIndices.map(function(index) {

      index = ee.Number(index);

      var dayStart = jjas.start.advance(
        index,
        'day'
      );

      var dayEnd = dayStart.advance(
        1,
        'day'
      );

      var dailyImages = imergJJAS.filterDate(
        dayStart,
        dayEnd
      );

      var dailyTotal = dailyImages
        .sum()
        .multiply(0.5)
        .rename('daily_precip_mm');

      return dailyTotal.set({

        'system:time_start':
          dayStart.millis(),

        'image_count':
          dailyImages.size()

      });

    })
  );

  var rx1day = dailyCollection
    .max()
    .rename('rx1day_mm');


  // Actual daily completeness:
  // A complete day requires 48 half-hour images.

  var incompleteDays = ee.Number(
    dailyCollection.filter(
      ee.Filter.neq(
        'image_count',
        48
      )
    ).size()
  );


  // ================================================
  // B. FLDAS RUNOFF
  // ================================================

  var fldasJJAS = fldas.filterDate(
    jjas.start,
    jjas.end
  );

  var runoff = fldasJJAS.map(
    convertRunoff
  ).sum();

  var surface = runoff.select(
    'surface_runoff_mm'
  );

  var subsurface = runoff.select(
    'subsurface_runoff_mm'
  );

  var totalRunoff = surface.add(
    subsurface
  ).rename(
    'total_runoff_mm'
  );


  // ================================================
  // C. FLDAS SOIL MOISTURE
  // ================================================

  var soil = fldasJJAS.select([
    'SoilMoi00_10cm_tavg',
    'SoilMoi10_40cm_tavg',
    'SoilMoi40_100cm_tavg',
    'SoilMoi100_200cm_tavg'
  ]).mean().rename([
    'soil_0_10',
    'soil_10_40',
    'soil_40_100',
    'soil_100_200'
  ]);


  // ================================================
  // D. MODIS DAYTIME LST
  // ================================================

  var lstCollection = modisLST.filterDate(
    jjas.start,
    jjas.end
  );

  var lst = lstCollection.map(
    function(image) {

      var qc = image.select(
        'QC_Day'
      );

      var good = qc
        .bitwiseAnd(3)
        .lte(1);

      return image.select(
        'LST_Day_1km'
      ).updateMask(
        good
      ).multiply(
        0.02
      ).subtract(
        273.15
      ).rename('lst_c');

    }
  ).mean();


  // ================================================
  // E. MODIS NDSI SNOW-COVER INDEX
  // ================================================

  var snowCollection = modisSnow.filterDate(
    maySep.start,
    maySep.end
  );

  var snow = snowCollection.map(
    function(image) {

      var ndsi = image.select(
        'NDSI_Snow_Cover'
      );

      var valid = ndsi.gte(0)
        .and(
          ndsi.lte(100)
        );

      return ndsi
        .updateMask(valid)
        .rename('snow_index');

    }
  ).mean();


  // ================================================
  // F. FLDAS SNOW WATER EQUIVALENT
  // ================================================

  var sweCollection = fldas.filterDate(
    maySep.start,
    maySep.end
  );

  var swe = sweCollection
    .select('SWE_inst')
    .mean()
    .rename('swe_mm');


  // ================================================
  // G. COMBINE ALL VARIABLES
  // ================================================

  var combined = ee.Image.cat([
    rx1day,
    precipitation,
    surface,
    subsurface,
    totalRunoff,
    soil,
    lst,
    snow,
    swe
  ]);

  return {

    image: combined,

    jjasDays: days,

    incompleteDays:
      incompleteDays,

    imergCount:
      imergJJAS.size(),

    fldasCount:
      fldasJJAS.size(),

    lstCount:
      lstCollection.size(),

    snowCount:
      snowCollection.size(),

    sweCount:
      sweCollection.size()

  };
}


// ==================================================
// 7. VARIABLES
// ==================================================

var variableNames = ee.List([

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

  'swe_mm'

]);


// ==================================================
// 8. BUILD OUTPUT TABLE
// ==================================================

var years = TEST_MODE
  ? ee.List([2022])
  : ee.List.sequence(
      START_YEAR,
      END_YEAR
    );

var zoneNames = ee.List([
  'Low Elevation',
  'High Elevation'
]);

var records = years.map(
  function(year) {

    year = ee.Number(year);

    var annual = buildAnnualImages(
      year
    );

    var lowValues = ee.Dictionary.fromLists(
      variableNames,
      variableNames.map(
        function(band) {

          return zonalMean(
            annual.image,
            band,
            lowMask
          );

        }
      )
    );

    var highValues = ee.Dictionary.fromLists(
      variableNames,
      variableNames.map(
        function(band) {

          return zonalMean(
            annual.image,
            band,
            highMask
          );

        }
      )
    );

    var metadata = ee.Dictionary({

      year: year,

      jjas_days:
        annual.jjasDays,

      incomplete_days:
        annual.incompleteDays,

      imerg_images:
        annual.imergCount,

      fldas_months:
        annual.fldasCount,

      lst_composites:
        annual.lstCount,

      snow_daily_images:
        annual.snowCount,

      swe_months:
        annual.sweCount

    });

    var lowFeature = ee.Feature(
      null,
      lowValues.combine(
        metadata,
        true
      ).set(
        'region',
        'Low Elevation'
      )
    );

    var highFeature = ee.Feature(
      null,
      highValues.combine(
        metadata,
        true
      ).set(
        'region',
        'High Elevation'
      )
    );

    return ee.FeatureCollection([
      lowFeature,
      highFeature
    ]);

  }
);

var table = ee.FeatureCollection(
  records
).flatten();


// ==================================================
// 9. CONSOLE VALIDATION
// ==================================================

print(
  'MODE:',
  TEST_MODE
    ? '2022 TEST'
    : 'FULL 2001–2025'
);

print(
  'Expected records:',
  TEST_MODE ? 2 : 50
);

print(
  'Actual records:',
  table.size()
);

print(
  'Variable count:',
  variableNames.size()
);

print(
  'Records:',
  table
);


// ==================================================
// 10. EXPORT
// ==================================================

Export.table.toDrive({

  collection: table,

  description: TEST_MODE
    ? 'indus_high_low_2022_test'
    : 'indus_high_low_all_variables_2001_2025',

  folder:
    'NASA_SpaceApps_2026',

  fileNamePrefix: TEST_MODE
    ? 'indus_high_low_2022_test'
    : 'indus_high_low_all_variables_2001_2025',

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
