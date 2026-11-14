
/*
 NASA Space Apps Challenge 2026
 Variable 7: Spatial Extreme Precipitation Trends

 Dataset: NASA GPM IMERG V07
 Period: 2001–2025
 Season: June–September
 Metric: Annual maximum daily rainfall (Rx1day)
 Method: Pixel-wise Sen's slope
 Units: mm/year
 QC: >=20 valid annual observations
 Daily boundaries: UTC
*/

// 1. Indus Basin
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

// 2. IMERG V07
var imerg = ee.ImageCollection(
  'NASA/GPM_L3/IMERG_V07'
)
.filterDate('2001-06-01', '2025-10-01')
.select('precipitation');

// 3. Annual JJAS Rx1day
var years = ee.List.sequence(2001, 2025);

var annualRx = ee.ImageCollection.fromImages(
  years.map(function(year) {

    year = ee.Number(year);

    var start = ee.Date.fromYMD(year, 6, 1);
    var end = ee.Date.fromYMD(year, 10, 1);

    var days = end.difference(start, 'day');

    var offsets = ee.List.sequence(
      0, days.subtract(1)
    );

    var daily = ee.ImageCollection.fromImages(
      offsets.map(function(offset) {

        var dayStart = start.advance(
          ee.Number(offset), 'day'
        );

        var dayEnd = dayStart.advance(1, 'day');

        return imerg
          .filterDate(dayStart, dayEnd)
          .sum()
          .multiply(0.5)
          .rename('daily_rain_mm');
      })
    );

    var annualMax = daily
      .max()
      .rename('rx1day');

    var yearBand = ee.Image.constant(year)
      .toFloat()
      .rename('year');

    return yearBand
      .addBands(annualMax)
      .set('year', year)
      .set(
        'system:time_start',
        start.millis()
      );
  })
);

print('Annual Rx1day images:', annualRx.size());

// 4. Sen's slope
var validCount = annualRx
  .select('rx1day')
  .count();

var slope = annualRx
  .select(['year', 'rx1day'])
  .reduce(ee.Reducer.sensSlope())
  .select('slope')
  .updateMask(validCount.gte(20))
  .rename('rx1day_sen_slope');

var spatialTrend = slope.clip(indusBasin);

print(
  'Output bands:',
  spatialTrend.bandNames()
);

// 5. Visualization
Map.centerObject(indusBasin, 6);

Map.addLayer(
  spatialTrend,
  {
    min: -2,
    max: 2,
    palette: [
      '#b2182b',
      '#ef8a62',
      '#fddbc7',
      '#f7f7f7',
      '#d1e5f0',
      '#67a9cf',
      '#2166ac'
    ]
  },
  'Rx1day Sen Slope (mm/year)'
);


/*
 Lightweight spatial trend preview
 Display at approximately 25 km resolution.
 Original spatialTrend calculation remains unchanged.
*/

var preview = spatialTrend
  .reproject({
    crs: 'EPSG:4326',
    scale: 25000
  });

Map.addLayer(
  preview,
  {
    min: -2,
    max: 2,
    palette: [
      '#b2182b',
      '#ef8a62',
      '#fddbc7',
      '#f7f7f7',
      '#d1e5f0',
      '#67a9cf',
      '#2166ac'
    ]
  },
  'Rx1day Sen Slope — 25 km Preview'
);


// 6. Export
Export.image.toDrive({
  image: spatialTrend.unmask(-9999),
  description: 'Indus_JJAS_Rx1day_Sen_Slope_2001_2025',
  fileNamePrefix:
    'indus_jjas_rx1day_sen_slope_qc_2001_2025',
  region: indusBasin,
  scale: 10000,
  maxPixels: 1e13,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    noData: -9999
  }
});

print('Spatial Rx1day export configured.');
