
/*
NASA Space Apps Challenge 2026
Comparison 3 — Elevation Zone Validation

Indus River Basin: HydroBASINS Level 6
Elevation: NASA SRTM DEM
Threshold: 1500 m

Purpose:
Check basin area distribution before
finalizing high/low elevation zones.
*/

// --------------------------------------
// 1. INDUS BASIN
// --------------------------------------

var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indus = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var basin = indus.geometry();

Map.centerObject(indus, 6);

// --------------------------------------
// 2. DIGITAL ELEVATION MODEL
// --------------------------------------

var dem = ee.Image(
  'USGS/SRTMGL1_003'
).select('elevation');

// --------------------------------------
// 3. ELEVATION ZONES
// --------------------------------------

var threshold = 1500;

var low = dem.lt(threshold);

var high = dem.gte(threshold);

// --------------------------------------
// 4. AREA CALCULATION
// --------------------------------------

var pixelArea = ee.Image.pixelArea();

function zoneArea(mask) {

  var area = pixelArea
    .updateMask(mask)
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: basin,
      scale: 1000,
      maxPixels: 1e13,
      tileScale: 4
    });

  return ee.Number(
    area.get('area')
  ).divide(1e6);
}

var lowArea = zoneArea(low);

var highArea = zoneArea(high);

var classifiedArea = lowArea.add(highArea);

print('Low elevation area (km²)', lowArea);
print('High elevation area (km²)', highArea);

print(
  'Total classified area (km²)',
  classifiedArea
);

print(
  'Low elevation percentage',
  lowArea.divide(classifiedArea).multiply(100)
);

print(
  'High elevation percentage',
  highArea.divide(classifiedArea).multiply(100)
);

// --------------------------------------
// 5. MAP VISUALIZATION
// --------------------------------------

Map.addLayer(
  dem.clip(basin),
  {
    min: 0,
    max: 6000,
    palette: [
      '#2b83ba',
      '#abdda4',
      '#ffffbf',
      '#fdae61',
      '#d7191c'
    ]
  },
  'Elevation (m)',
  false
);

Map.addLayer(
  low.selfMask().clip(basin),
  {palette: ['#e9a23b']},
  'Low elevation (<1500 m)'
);

Map.addLayer(
  high.selfMask().clip(basin),
  {palette: ['#377eb8']},
  'High elevation (>=1500 m)'
);

Map.addLayer(
  indus.style({
    color: 'ffffff',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Basin Boundary'
);
