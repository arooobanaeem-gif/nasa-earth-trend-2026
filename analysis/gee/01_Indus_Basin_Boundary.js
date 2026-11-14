
var basins = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

// Select Indus drainage system
var indusSubbasins = basins.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

// Merge the sub-basins into one geometry
var indusGeometry = indusSubbasins.geometry();

// Create a single basin feature
var indusBasin = ee.Feature(
  indusGeometry,
  {name: 'Indus River Basin'}
);

// Calculate basin area in square kilometres
var areaKm2 = indusGeometry.area(100).divide(1e6);

// Display results
print('Number of sub-basins:', indusSubbasins.size());
print('Combined basin area (km²):', areaKm2);
print('Combined basin feature:', indusBasin);

// Display merged boundary
Map.centerObject(indusBasin, 5);

Map.addLayer(
  indusBasin,
  {
    color: '0066FF',
    fillColor: '0066FF22'
  },
  'Indus Basin - Combined'
);

var exportBoundary = ee.FeatureCollection([
  indusBasin
]);

Export.table.toDrive({
  collection: exportBoundary,
  description: 'Indus_Basin_Boundary',
  folder: 'NASA_Earth_Trend_2026',
  fileNamePrefix: 'indus_basin',
  fileFormat: 'GeoJSON'
});

var dissolvedIndus = indusSubbasins.geometry().dissolve(100);

var dissolvedFeature = ee.Feature(dissolvedIndus, {
  name: 'Indus River Basin',
  source: 'HydroBASINS Level 6'
});

print('Dissolved geometry type:', dissolvedIndus.type());
print(
  'Dissolved area (km2):',
  dissolvedIndus.area(100).divide(1e6)
);

Map.addLayer(
  dissolvedIndus,
  {color: '00FF00'},
  'Dissolved Indus Basin'
);

Export.table.toDrive({
  collection: ee.FeatureCollection([dissolvedFeature]),
  description: 'Indus_Basin_Dissolved',
  folder: 'NASA_Earth_Trend_2026',
  fileNamePrefix: 'indus_basin_dissolved',
  fileFormat: 'GeoJSON'
});

