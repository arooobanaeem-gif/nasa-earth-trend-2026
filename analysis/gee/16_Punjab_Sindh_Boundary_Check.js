
/*
 * NASA Earth System Trend Detective
 * Regional Study: Punjab vs Sindh
 * Step 3: Provincial boundaries within Indus Basin
 */

// 1. Indus River Basin boundary
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var indusBasin = indusSubbasins.geometry();

// 2. Pakistan provincial boundaries
var provinces = ee.FeatureCollection(
  'FAO/GAUL/2015/level1'
);

var pakistan = provinces.filter(
  ee.Filter.eq('ADM0_NAME', 'Pakistan')
);

// 3. Select Punjab and Sindh
var punjab = pakistan.filter(
  ee.Filter.eq('ADM1_NAME', 'Punjab')
).geometry();

var sindh = pakistan.filter(
  ee.Filter.eq('ADM1_NAME', 'Sindh')
).geometry();

// 4. Clip both provinces to the Indus Basin
var punjabIndus = punjab.intersection(
  indusBasin, ee.ErrorMargin(100)
);

var sindhIndus = sindh.intersection(
  indusBasin, ee.ErrorMargin(100)
);

// 5. Calculate area in square kilometres
print(
  'Punjab within Indus (km²):',
  punjabIndus.area(100).divide(1e6)
);

print(
  'Sindh within Indus (km²):',
  sindhIndus.area(100).divide(1e6)
);

// 6. Display boundaries
Map.centerObject(indusBasin, 6);

Map.addLayer(
  indusBasin,
  {color: 'black'},
  'Indus Basin'
);

Map.addLayer(
  punjabIndus,
  {color: 'blue'},
  'Punjab within Indus'
);

Map.addLayer(
  sindhIndus,
  {color: 'red'},
  'Sindh within Indus'
);
