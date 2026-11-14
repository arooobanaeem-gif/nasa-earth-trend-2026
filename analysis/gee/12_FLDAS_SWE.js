
/*
 NASA Space Apps Challenge 2026
 Variable 6: Snow Water Equivalent (SWE)
 Step 1: Dataset verification
*/

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
)
.filterDate('2001-01-01', '2026-01-01')
.filter(ee.Filter.calendarRange(5, 9, 'month'));

var first = ee.Image(fldas.first());

print('May–September image count:', fldas.size());
print('First image date:',
  ee.Date(first.get('system:time_start'))
    .format('YYYY-MM-dd')
);

print('SWE band available:',
  first.bandNames().contains('SWE_inst')
);

print('First SWE image:', first.select('SWE_inst'));


/*
 STEP 2: Inspect SWE
 May–September 2001
 Indus River Basin
*/

// 1. Indus Basin boundary

var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

print('Indus subbasins:', indusSubbasins.size());

print(
  'Basin area (km2):',
  indusBasin.area().divide(1e6)
);

// 2. May–September mean SWE for 2001

var swe2001 = fldas
  .filter(ee.Filter.calendarRange(2001, 2001, 'year'))
  .select('SWE_inst')
  .mean();

// 3. Basin-wide statistics

var stats2001 = swe2001.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: indusBasin,
  scale: 10000,
  maxPixels: 1e13,
  tileScale: 4
});

print('2001 May–September mean SWE:', stats2001);

// 4. Map visualization

Map.centerObject(indusBasin, 6);

Map.addLayer(
  swe2001.clip(indusBasin),
  {
    min: 0,
    max: 150,
    palette: [
      '#ffffff',
      '#dbeafe',
      '#93c5fd',
      '#3b82f6',
      '#1d4ed8',
      '#172554'
    ]
  },
  '2001 May–September Mean SWE (mm)'
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
 STEP 3: Annual May–September SWE
 Indus River Basin | 2001–2025
*/

var years = ee.List.sequence(2001, 2025);

var annualSWE = ee.FeatureCollection(
  years.map(function(year) {
    year = ee.Number(year);

    var seasonalMean = fldas
      .filter(ee.Filter.calendarRange(year, year, 'year'))
      .select('SWE_inst')
      .mean();

    var stats = seasonalMean.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusBasin,
      scale: 10000,
      maxPixels: 1e13,
      tileScale: 4
    });

    return ee.Feature(null, stats)
      .set('year', year);
  })
);

print('Annual SWE records:', annualSWE.size());
print('First annual SWE record:', annualSWE.first());

Export.table.toDrive({
  collection: annualSWE,
  description: 'Indus_May_Sep_SWE_2001_2025',
  fileNamePrefix: 'indus_may_sep_swe_2001_2025',
  fileFormat: 'CSV',
  selectors: [
    'year',
    'SWE_inst'
  ]
});

