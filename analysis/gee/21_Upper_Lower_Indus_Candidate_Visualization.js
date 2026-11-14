
/*
NASA Space Apps Challenge 2026
Upper–Lower Indus: Candidate Boundary Visualization

Visualizes five hydrologically connected candidate
divisions using HydroBASINS Level 6.

Upper: candidate subbasin plus all upstream contributors
Lower: remaining subbasins

No final boundary is selected yet.
*/

var hydro = ee.FeatureCollection(
  'WWF/HydroSHEDS/v1/Basins/hybas_6'
);

var basin = hydro.filter(
  ee.Filter.eq('MAIN_BAS', 4060033640)
);

var basinGeometry = basin.geometry();

var candidates = [
  {rank: 1, id: 4060794590},
  {rank: 2, id: 4060744390},
  {rank: 3, id: 4060718650},
  {rank: 4, id: 4060685660},
  {rank: 5, id: 4060673550}
];

// For each subbasin, follow NEXT_DOWN until reaching
// a candidate, the outlet, or leaving the basin.
// A subbasin is Upper if its downstream path reaches
// the candidate (including the candidate itself).

var features = basin.toList(basin.size());

var ids = ee.List(
  basin.aggregate_array('HYBAS_ID')
);

var nextDown = ee.List(
  basin.aggregate_array('NEXT_DOWN')
);

function classify(candidateId) {

  candidateId = ee.Number(candidateId);

  var upperIds = ids.map(function(id) {

    id = ee.Number(id);

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
          ee.Number(current.eq(candidateId))
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
        current: id,
        found: 0
      })
    );

    return ee.Algorithms.If(
      ee.Number(
        ee.Dictionary(result).get('found')
      ).eq(1),
      id,
      null
    );

  }).removeAll([null]);

  var upper = basin.filter(
    ee.Filter.inList('HYBAS_ID', upperIds)
  );

  var lower = basin.filter(
    ee.Filter.inList(
      'HYBAS_ID',
      ids.removeAll(upperIds)
    )
  );

  return {
    upper: upper,
    lower: lower
  };
}

Map.centerObject(basinGeometry, 6);

Map.addLayer(
  basin.style({
    color: '333333',
    fillColor: '00000000',
    width: 1
  }),
  {},
  'Indus Basin Boundary',
  true
);

candidates.forEach(function(candidate) {

  var result = classify(candidate.id);

  var upperStyle = result.upper.style({
    color: '1565C0',
    fillColor: '1565C055',
    width: 1
  });

  var lowerStyle = result.lower.style({
    color: 'E65100',
    fillColor: 'E6510055',
    width: 1
  });

  Map.addLayer(
    lowerStyle,
    {},
    'Candidate ' + candidate.rank + ' - Lower',
    candidate.rank === 1
  );

  Map.addLayer(
    upperStyle,
    {},
    'Candidate ' + candidate.rank + ' - Upper',
    candidate.rank === 1
  );

  var selected = basin.filter(
    ee.Filter.eq('HYBAS_ID', candidate.id)
  );

  Map.addLayer(
    selected.style({
      color: 'FFFF00',
      fillColor: 'FFFF0066',
      width: 3
    }),
    {},
    'Candidate ' + candidate.rank + ' - Division Subbasin',
    candidate.rank === 1
  );

  print(
    'Candidate ' + candidate.rank,
    'Upper count:',
    result.upper.size(),
    'Lower count:',
    result.lower.size()
  );

});

var elevation = ee.Image(
  'USGS/SRTMGL1_003'
).select('elevation');

Map.addLayer(
  elevation.clip(basinGeometry),
  {
    min: 0,
    max: 6000,
    palette: [
      '1B5E20',
      '7CB342',
      'FDD835',
      'EF6C00',
      'EEEEEE'
    ]
  },
  'Elevation',
  false
);


/*
Step 6: Geographic verification of Candidate 1
*/

var candidate1 = basin.filter(
  ee.Filter.eq('HYBAS_ID', 4060794590)
);

var candidatePoint = candidate1.geometry().centroid(100);

print(
  'Candidate 1 centroid [longitude, latitude]:',
  candidatePoint.coordinates()
);

print(
  'Candidate 1 properties:',
  candidate1.first().toDictionary()
);

Map.addLayer(
  candidatePoint,
  {color: 'FF00FF'},
  'Candidate 1 centroid',
  true
);

Map.centerObject(candidate1, 8);

