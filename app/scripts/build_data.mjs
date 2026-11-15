// Build web-ready data for the app from the scientific outputs.
// SI-assisted code (Claude). Run: npm run build:data
// Inputs : ../data, ../results (repo) and the trend rasters / basin GeoJSON folder (arg 1)
// Outputs: public/data/app_data.json, public/data/grids.json, public/data/maps/*.png, public/data/basin.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromArrayBuffer } from 'geotiff';
import { PNG } from 'pngjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const rasterDir = process.argv[2] || path.resolve(repo, '..', 'RemainingFiles', 'RemainingFiles');
const out = path.resolve(here, '..', 'public', 'data');
fs.mkdirSync(path.join(out, 'maps'), { recursive: true });

// ---------- CSV helpers ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const read = p => parseCSV(fs.readFileSync(path.join(repo, p), 'utf8'));
const num = v => (v === '' || v == null ? null : Number(v));

// ---------- dictionary ----------
const VARS = ['precipitation_mm', 'rx1day_mm', 'lst_c', 'snow_index', 'swe_mm', 'surface_runoff_mm', 'subsurface_runoff_mm', 'total_runoff_mm', 'soil_0_10', 'soil_10_40', 'soil_40_100', 'soil_100_200'];
const dictRows = read('results/scientific_data_dictionary.csv');
const kind = v => (/NASA FLDAS/.test(v.dataset) ? 'model' : 'satellite');
const variables = VARS.map(id => { const d = dictRows.find(r => r.variable === id); return { id, ...d, kind: kind(d) }; });

// ---------- annual series ----------
const series = {}; // region -> variable -> [values by year 2001..2025]
const YEARS = Array.from({ length: 25 }, (_, i) => 2001 + i);
const put = (region, v, year, val) => { ((series[region] ??= {})[v] ??= Array(25).fill(null))[Math.round(year) - 2001] = val; };
const basinFiles = [
  ['data/indus_jjas_precipitation_2001_2025.csv', { precipitation_mm: 'precipitation_mm' }],
  ['data/indus_jjas_rx1day_2001_2025.csv', { rx1day_mm: 'rx1day_mm' }],
  ['data/indus_jjas_lst_2001_2025.csv', { lst_celsius: 'lst_c' }],
  ['data/indus_may_sep_snow_2001_2025.csv', { snow_cover_mean: 'snow_index' }],
  ['data/indus_may_sep_swe_2001_2025.csv', { SWE_inst: 'swe_mm' }],
  ['data/indus_jjas_runoff_2001_2025.csv', { surface_runoff_mm: 'surface_runoff_mm', subsurface_runoff_mm: 'subsurface_runoff_mm', total_runoff_mm: 'total_runoff_mm' }],
  ['data/indus_jjas_soil_moisture_2001_2025.csv', { SoilMoi00_10cm_tavg: 'soil_0_10', SoilMoi10_40cm_tavg: 'soil_10_40', SoilMoi40_100cm_tavg: 'soil_40_100', SoilMoi100_200cm_tavg: 'soil_100_200' }],
];
for (const [f, map] of basinFiles) for (const r of read(f)) for (const [col, v] of Object.entries(map)) put('Indus Basin', v, num(r.year), num(r[col]));
for (const f of ['data/punjab_sindh_all_variables_2001_2025.csv', 'data/upper_lower_indus_all_variables_2001_2025.csv', 'data/indus_high_low_all_variables_2001_2025.csv'])
  for (const r of read(f)) for (const v of VARS) if (r[v] !== undefined && r[v] !== '') put(r.region, v, num(r.year), num(r[v]));

// ---------- master trend results ----------
const results = read('results/master_scientific_results.csv').map(r => ({
  comparison: r.comparison, result_type: r.result_type, region: r.region, variable: r.variable,
  unit: r.unit.replace('Â', ''), season: r.season, n_years: num(r.n_years), mean: num(r.mean),
  sen_slope_per_year: num(r.sen_slope_per_year), ci_lower: num(r.slope_ci_lower), ci_upper: num(r.slope_ci_upper),
  kendall_tau: num(r.kendall_tau), p_value: num(r.p_value), p_value_method: r.p_value_method,
  fdr_q: num(r.fdr_q), significant: r.significant_05 === 'True', significance_basis: r.significance_basis,
  difference_definition: r.difference_definition || null,
}));

// ---------- regions / comparisons ----------
const comparisons = [
  { id: 'Basin-wide', regions: ['Indus Basin'], blurb: 'The whole Indus River Basin (HydroBASINS).' },
  { id: 'Upper vs Lower Indus', regions: ['Upper Indus', 'Lower Indus'], blurb: 'Operational catchment split at Chashma Barrage: mountain headwaters vs the plains downstream.' },
  { id: 'Punjab vs Sindh', regions: ['Punjab', 'Sindh'], blurb: 'The two downstream provinces of Pakistan hit hardest by the 2010 and 2022 floods.' },
  { id: 'High vs Low Elevation', regions: ['High Elevation', 'Low Elevation'], blurb: 'The basin split by terrain elevation: cryosphere zone vs lowlands.' },
];

// ---------- annual differences (region A minus region B) ----------
const differences = {};
for (const [cmp, f] of [['Upper vs Lower Indus', 'results/upper_lower_annual_differences.csv'], ['Punjab vs Sindh', 'results/punjab_sindh_annual_differences.csv'], ['High vs Low Elevation', 'results/high_low_elevation_annual_differences.csv']]) {
  differences[cmp] = {};
  for (const r of read(f)) for (const v of VARS) if (r[v] !== undefined && r[v] !== '') (differences[cmp][v] ??= Array(25).fill(null))[Math.round(num(r.year)) - 2001] = num(r[v]);
}

// ---------- rasters -> PNG overlays + coarse grids for point sampling ----------
const LAYERS = [
  { id: 'precipitation_mm', file: 'indus_jjas_sen_slope_2001_2025_clean.tif', band: 0, ramp: 'wet' },
  { id: 'rx1day_mm', file: 'indus_jjas_rx1day_sen_slope_qc_2001_2025.tif', band: 0, ramp: 'wet' },
  { id: 'lst_c', file: 'indus_jjas_lst_sen_slope_qc_2001_2025_clean.tif', band: 0, ramp: 'heat' },
  { id: 'snow_index', file: 'indus_may_sep_snow_sen_slope_qc_2001_2025_clean.tif', band: 0, ramp: 'wet' },
  { id: 'swe_mm', file: 'indus_may_sep_swe_sen_slope_qc_2001_2025.tif', band: 0, ramp: 'wet' },
  { id: 'surface_runoff_mm', file: 'indus_jjas_runoff_sen_slope_qc_2001_2025_clean.tif', band: 0, ramp: 'wet' },
  { id: 'subsurface_runoff_mm', file: 'indus_jjas_runoff_sen_slope_qc_2001_2025_clean.tif', band: 1, ramp: 'wet' },
  { id: 'total_runoff_mm', file: 'indus_jjas_runoff_sen_slope_qc_2001_2025_clean.tif', band: 2, ramp: 'wet' },
  { id: 'soil_0_10', file: 'indus_jjas_soil_moisture_sen_slope_qc_2001_2025_clean.tif', band: 0, ramp: 'wet' },
  { id: 'soil_10_40', file: 'indus_jjas_soil_moisture_sen_slope_qc_2001_2025_clean.tif', band: 1, ramp: 'wet' },
  { id: 'soil_40_100', file: 'indus_jjas_soil_moisture_sen_slope_qc_2001_2025_clean.tif', band: 2, ramp: 'wet' },
  { id: 'soil_100_200', file: 'indus_jjas_soil_moisture_sen_slope_qc_2001_2025_clean.tif', band: 3, ramp: 'wet' },
];
// diverging ramps: negative -> neutral -> positive
const RAMPS = {
  wet: [[140, 81, 10], [216, 179, 101], [245, 245, 240], [90, 180, 172], [1, 102, 94]],   // drier/less -> wetter/more
  heat: [[33, 102, 172], [146, 197, 222], [245, 245, 240], [239, 138, 98], [178, 24, 43]], // cooling -> warming
};
function color(ramp, t) { // t in [-1, 1]
  const stops = RAMPS[ramp], x = (Math.max(-1, Math.min(1, t)) + 1) / 2 * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return stops[i].map((c, k) => Math.round(c + (stops[i + 1][k] - c) * f));
}
const GRID_W = 164, MAX_PNG_W = 1100;
const layers = {}, grids = {};
const cache = {};
for (const L of LAYERS) {
  const p = path.join(rasterDir, L.file);
  if (!fs.existsSync(p)) { console.warn('missing raster', L.file); continue; }
  if (!cache[L.file]) {
    const buf = fs.readFileSync(p);
    const tiff = await fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const img = await tiff.getImage();
    cache[L.file] = { img, data: await img.readRasters() };
  }
  const { img, data } = cache[L.file];
  const w = img.getWidth(), h = img.getHeight(), bbox = img.getBoundingBox(); // [w, s, e, n]
  const band = data[L.band];
  // percentile scale (symmetric)
  const sample = [];
  const step = Math.max(1, Math.floor(band.length / 200000));
  for (let i = 0; i < band.length; i += step) { const v = band[i]; if (Number.isFinite(v) && v > -9000) sample.push(Math.abs(v)); }
  sample.sort((a, b) => a - b);
  const scale = sample[Math.floor(sample.length * 0.96)] || 1;
  const isData = v => Number.isFinite(v) && v > -9000;
  // PNG (downsampled by block mean)
  const f = Math.max(1, Math.ceil(w / MAX_PNG_W)), pw = Math.floor(w / f), ph = Math.floor(h / f);
  const png = new PNG({ width: pw, height: ph });
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    let s = 0, n = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) { const v = band[(y * f + dy) * w + (x * f + dx)]; if (isData(v)) { s += v; n++; } }
    const o = (y * pw + x) * 4;
    if (!n) { png.data[o + 3] = 0; continue; }
    const [r, g, b] = color(L.ramp, (s / n) / scale);
    png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 235;
  }
  fs.writeFileSync(path.join(out, 'maps', `${L.id}.png`), PNG.sync.write(png));
  // coarse grid for point sampling (block mean to ~GRID_W columns)
  const gf = Math.max(1, Math.round(w / GRID_W)), gw = Math.floor(w / gf), gh = Math.floor(h / gf);
  const g = new Array(gw * gh);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    let s = 0, n = 0;
    for (let dy = 0; dy < gf; dy++) for (let dx = 0; dx < gf; dx++) { const v = band[(y * gf + dy) * w + (x * gf + dx)]; if (isData(v)) { s += v; n++; } }
    g[y * gw + x] = n ? Number((s / n).toPrecision(4)) : null;
  }
  const pxW = (bbox[2] - bbox[0]) / w, pxH = (bbox[3] - bbox[1]) / h;
  grids[L.id] = { w: gw, h: gh, bbox: [bbox[0], bbox[3] - gh * gf * pxH, bbox[0] + gw * gf * pxW, bbox[3]], values: g };
  layers[L.id] = { png: `data/maps/${L.id}.png`, bounds: [[bbox[1] + (h - ph * f) * pxH, bbox[0]], [bbox[3], bbox[0] + pw * f * pxW]], scale: Number(scale.toPrecision(3)), ramp: L.ramp, native_km: Math.round(pxW * 111.32 * 10) / 10 };
  console.log('layer', L.id, `${pw}x${ph}`, 'scale ±' + scale.toPrecision(3));
}

// ---------- basin outline + upper/lower sub-basins (simplified) ----------
const simplify = (ring, tol) => { // radial-distance simplification
  const o = [ring[0]]; let last = ring[0];
  for (const p of ring) if (Math.hypot(p[0] - last[0], p[1] - last[1]) > tol) { o.push(p); last = p; }
  o.push(ring[0]); return o.map(p => [Number(p[0].toFixed(3)), Number(p[1].toFixed(3))]);
};
const simpGeom = (g, tol) => {
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(r => simplify(r, tol)).filter(r => r.length > 4) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(p => p.map(r => simplify(r, tol)).filter(r => r.length > 4)).filter(p => p.length) };
  if (g.type === 'GeometryCollection') return { type: 'GeometryCollection', geometries: g.geometries.filter(x => /Polygon/.test(x.type)).map(x => simpGeom(x, tol)) };
  return g;
};
const basin = { outline: null, subbasins: { type: 'FeatureCollection', features: [] } };
const bp = path.join(rasterDir, 'indus_basin_dissolved.geojson');
if (fs.existsSync(bp)) { const j = JSON.parse(fs.readFileSync(bp, 'utf8')); basin.outline = { type: 'Feature', properties: { name: 'Indus River Basin' }, geometry: simpGeom((j.features || [j])[0].geometry, 0.02) }; }
for (const r of read('data/upper_lower_indus_subbasins.csv')) {
  try { basin.subbasins.features.push({ type: 'Feature', properties: { region: r.region, id: r.HYBAS_ID }, geometry: simpGeom(JSON.parse(r['.geo']), 0.02) }); } catch { /* skip */ }
}

// ---------- gazetteer (places inside / next to the basin) ----------
const places = [
  ['Gilgit', 35.92, 74.31], ['Skardu', 35.30, 75.63], ['Hunza (Karimabad)', 36.32, 74.66], ['Chitral', 35.85, 71.79], ['Swat (Mingora)', 34.77, 72.36],
  ['Buner', 34.44, 72.50], ['Peshawar', 34.01, 71.58], ['Islamabad', 33.69, 73.06], ['Muzaffarabad', 34.37, 73.47], ['Srinagar', 34.08, 74.80], ['Leh', 34.15, 77.58],
  ['Kabul', 34.53, 69.17], ['Tarbela Dam', 34.09, 72.69], ['Chashma Barrage', 32.44, 71.38], ['Lahore', 31.55, 74.34], ['Faisalabad', 31.42, 73.08], ['Multan', 30.20, 71.47],
  ['Dera Ghazi Khan', 30.05, 70.64], ['Bahawalpur', 29.40, 71.68], ['Guddu Barrage', 28.42, 69.71], ['Sukkur', 27.71, 68.86], ['Jacobabad', 28.28, 68.44], ['Larkana', 27.56, 68.21],
  ['Dadu', 26.73, 67.78], ['Nawabshah', 26.24, 68.41], ['Hyderabad', 25.39, 68.37], ['Kotri Barrage', 25.44, 68.31], ['Thatta', 24.75, 67.92],
].map(([name, lat, lon]) => ({ name, lat, lon }));

const app = { generated: new Date().toISOString().slice(0, 10), years: YEARS, variables, comparisons, series, results, differences, layers, places, events: { 2010: '2010 Pakistan floods', 2022: '2022 monsoon floods', 2025: '2025 floods' } };
fs.writeFileSync(path.join(out, 'app_data.json'), JSON.stringify(app));
fs.writeFileSync(path.join(out, 'grids.json'), JSON.stringify(grids));
fs.writeFileSync(path.join(out, 'basin.json'), JSON.stringify(basin));
for (const f of ['app_data.json', 'grids.json', 'basin.json']) console.log(f, (fs.statSync(path.join(out, f)).size / 1024).toFixed(0) + ' KB');
console.log('regions:', Object.keys(series).join(', '), '| results:', results.length, '| subbasins:', basin.subbasins.features.length);
