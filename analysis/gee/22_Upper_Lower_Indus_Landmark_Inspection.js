
/*
NASA Space Apps Challenge 2026
Upper–Lower Indus — Landmark Inspection

Identify HydroBASINS Level 6 subbasins containing
or nearest to key hydrological reference locations.

Coordinates are approximate reference locations.
Final boundary selection requires map verification.
*/

var basin = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
).filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var landmarks = [
  {
    name: 'Tarbela Dam',
    lon: 72.698,
    lat: 34.089
  },
  {
    name: 'Attock / Indus-Kabul confluence',
    lon: 72.240,
    lat: 33.900
  },
  {
    name: 'Chashma Barrage',
    lon: 71.370,
    lat: 32.430
  }
];

Map.centerObject(basin, 6);

Map.addLayer(
  basin.style({
    color: '555555',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Subbasins'
);

landmarks.forEach(function(item) {

  var point = ee.Geometry.Point([
    item.lon,
    item.lat
  ]);

  var containing = basin.filterBounds(point);

  var nearest = basin.map(function(feature) {
    return feature.set(
      'distance_m',
      feature.geometry().distance(point, 100)
    );
  }).sort('distance_m').first();

  print(
    item.name + ' - containing subbasins:',
    containing.select([
      'HYBAS_ID',
      'NEXT_DOWN',
      'PFAF_ID',
      'SUB_AREA',
      'UP_AREA'
    ])
  );

  print(
    item.name + ' - nearest subbasin:',
    ee.Feature(nearest).toDictionary([
      'HYBAS_ID',
      'NEXT_DOWN',
      'PFAF_ID',
      'SUB_AREA',
      'UP_AREA',
      'distance_m'
    ])
  );

  Map.addLayer(
    point,
    {color: 'FF00FF'},
    item.name,
    true
  );

  Map.addLayer(
    containing.style({
      color: 'FFFF00',
      fillColor: 'FFFF0055',
      width: 3
    }),
    {},
    item.name + ' - containing subbasin',
    true
  );

});
