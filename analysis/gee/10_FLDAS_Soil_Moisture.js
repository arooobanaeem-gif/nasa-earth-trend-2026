
/*
 NASA Space Apps Challenge 2026
 Variable 5: Soil Moisture
 Step 1: Verify FLDAS soil moisture bands
*/

var fldas = ee.ImageCollection(
  'NASA/FLDAS/NOAH01/C/GL/M/V001'
)
.filterDate('2001-01-01', '2026-01-01')
.filter(
  ee.Filter.calendarRange(6, 9, 'month')
);

var first = ee.Image(fldas.first());

print('JJAS image count:', fldas.size());

print(
  'Soil moisture bands:',
  first.bandNames().filter(
    ee.Filter.stringContains('item', 'SoilMoi')
  )
);

print('All available bands:', first.bandNames());



/*
 STEP 2: Inspect soil moisture
 June 2001 — Indus Basin
*/

var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

var soilBands = [
  'SoilMoi00_10cm_tavg',
  'SoilMoi10_40cm_tavg',
  'SoilMoi40_100cm_tavg',
  'SoilMoi100_200cm_tavg'
];

var firstSoil = ee.Image(
  fldas.filterDate('2001-06-01', '2001-07-01').first()
).select(soilBands);

print(
  'June 2001 soil moisture statistics:',
  firstSoil.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: indusBasin,
    scale: 10000,
    maxPixels: 1e13,
    tileScale: 4
  })
);

Map.centerObject(indusBasin, 6);

Map.addLayer(
  firstSoil.select('SoilMoi00_10cm_tavg').clip(indusBasin),
  {
    min: 0,
    max: 40,
    palette: [
      '#f7fcf0',
      '#ccebc5',
      '#7bccc4',
      '#2b8cbe',
      '#084081'
    ]
  },
  'June 2001 Surface Soil Moisture (0–10 cm)'
);


/*
 STEP 3: Annual JJAS soil moisture, 2001–2025
 Four soil depths — basin-wide means
*/

var years = ee.List.sequence(2001, 2025);

var annualSoil = ee.FeatureCollection(
  years.map(function(year) {
    year = ee.Number(year);

    var seasonalMean = fldas
      .filter(ee.Filter.calendarRange(year, year, 'year'))
      .select(soilBands)
      .mean();

    var basinStats = seasonalMean.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: indusBasin,
      scale: 10000,
      maxPixels: 1e13,
      tileScale: 4
    });

    return ee.Feature(null, basinStats)
      .set('year', year);
  })
);

print('Annual soil moisture rows:', annualSoil.size());
print('First annual record:', annualSoil.first());

Export.table.toDrive({
  collection: annualSoil,
  description: 'Indus_JJAS_Soil_Moisture_2001_2025',
  fileNamePrefix: 'indus_jjas_soil_moisture_2001_2025',
  fileFormat: 'CSV',
  selectors: [
    'year',
    'SoilMoi00_10cm_tavg',
    'SoilMoi10_40cm_tavg',
    'SoilMoi40_100cm_tavg',
    'SoilMoi100_200cm_tavg'
  ]
});
