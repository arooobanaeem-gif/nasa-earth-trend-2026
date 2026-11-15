// Indus Trend Detective - front-end. SI-assisted code (Claude).
/* global TD, L, Plotly */
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => (k === 'class' ? (e.className = v) : e.setAttribute(k, v))); e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = { variable: 'rx1day_mm', region: 'Indus Basin', level: 'public', startYear: 2001, topic: 'floods', comparison: 'Upper vs Lower Indus', year: 2022, ai: false, model: null };
const C = { a: '#2a6fb0', b: '#d1661f', ink: '#17222e', muted: '#7b8794', grid: '#e6e3da' };
const RAMPS = { wet: ['#8c510a', '#d8b365', '#f5f5f0', '#5ab4ac', '#01665e'], heat: ['#2166ac', '#92c5de', '#f5f5f0', '#ef8a62', '#b2182b'] };
const TOPICS = [['floods', 'Floods & heavy rain'], ['heat', 'Heat'], ['snow', 'Snow & ice'], ['water', 'Water in soil & rivers'], ['any', 'Surprise me']];
const STARTS = [[2001, 'All 25 years (2001)'], [2006, 'Last 20 (2006)'], [2011, 'Last 15 (2011)'], [2016, 'Last 10 (2016)']];
let D, map, overlay, subLayer, popup;
const { fmt, fmtP, pEq } = TD;
const PLOT = { displayModeBar: false, responsive: true };
const baseLayout = () => ({ margin: { l: 58, r: 14, t: 30, b: 34 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', font: { family: 'Figtree, Segoe UI, sans-serif', size: 12, color: C.ink }, xaxis: { gridcolor: C.grid, dtick: 4, tick0: 2001, zeroline: false }, yaxis: { gridcolor: C.grid, zeroline: false }, legend: { orientation: 'h', y: 1.22, x: 0 }, hovermode: 'x unified' });

// ------------------------------------------------------------------ boot
async function boot() {
  const [data, basin] = await Promise.all([fetch('data/app_data.json').then(r => r.json()), fetch('data/basin.json').then(r => r.json())]);
  D = data; TD.init(D);
  fetch('data/grids.json').then(r => r.json()).then(g => TD.init(D, g));
  try { const st = await fetch('api/status').then(r => r.json()); S.ai = !!st.ai; S.model = st.model; S.provider = st.provider; } catch { S.ai = false; }
  document.body.className = 'lvl-' + S.level;
  buildControls(); initMap(basin); Modes.init(basin); renderAll(); initChat(); buildCases();
}
const available = (region, variable) => !!TD.seriesOf(region, variable);
function setState(patch, opts = {}) {
  Object.assign(S, patch);
  if (!available(S.region, S.variable)) { if (patch.region && !patch.variable) S.variable = TD.recommend({ topic: S.topic, region: S.region })[0].variable; else S.region = 'Indus Basin'; }
  const c = TD.comparisonOf(S.region); if (c && c.regions.length === 2 && !patch.comparison) S.comparison = c.id;
  renderAll(); if (opts.scroll) document.querySelector(opts.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ------------------------------------------------------------------ controls
function chips(host, items, get, set) { const h = $(host); h.innerHTML = ''; items.forEach(([val, label]) => { const b = el('button', { class: 'chip' + (get() === val ? ' on' : ''), type: 'button' }, esc(label)); b.onclick = () => set(val); h.appendChild(b); }); }
function buildControls() {
  $('#selVar').innerHTML = D.variables.map(v => `<option value="${v.id}">${esc(v.display_name)}</option>`).join('');
  $('#selRegion').innerHTML = D.comparisons.map(c => `<optgroup label="${esc(c.id)}">${c.regions.map(r => `<option>${esc(r)}</option>`).join('')}</optgroup>`).join('');
  $('#selCmp').innerHTML = D.comparisons.filter(c => c.regions.length === 2).map(c => `<option>${esc(c.id)}</option>`).join('');
  $('#selVar').onchange = e => setState({ variable: e.target.value });
  $('#selRegion').onchange = e => setState({ region: e.target.value });
  $('#selCmp').onchange = e => setState({ comparison: e.target.value });
  $('#winSlider').oninput = e => { S.startYear = +e.target.value; renderChart(); renderVerdict(); renderControlsState(); };
  document.querySelectorAll('#levelSeg button').forEach(b => b.onclick = () => { S.level = b.dataset.l; document.body.className = 'lvl-' + S.level; renderAll(); });
  $('#defs').innerHTML = D.variables.map(v => `<dt>${esc(v.display_name)} <span class="tag">${v.kind === 'model' ? 'model' : 'satellite'}</span></dt><dd>${esc(v.definition)} <i>${esc(v.dataset)}, ${esc(v.season)}, ${esc(v.unit)}.</i> Caution: ${esc(v.caution)}</dd>`).join('');
}
function renderControlsState() {
  chips('#yearChips', [[2010, '2010'], [2022, '2022'], [2025, '2025']], () => S.year, v => { S.year = v; renderControlsState(); renderAnomaly(); });
  $('#selVar').value = S.variable; $('#selRegion').value = S.region; $('#selCmp').value = S.comparison; $('#winSlider').value = Math.min(2016, S.startYear);
  document.querySelectorAll('#levelSeg button').forEach(b => b.classList.toggle('on', b.dataset.l === S.level));
}
function renderAll() { renderControlsState(); renderBoard(); renderChart(); renderVerdict(); renderMap(); renderCompare(); renderAnomaly(); Modes.render(); }

// ------------------------------------------------------------------ evidence board
const ICON = { strong: '✓', emerging: '◐', weak: '○', none: '–' };
function renderBoard() {
  const hit = Modes.searchIds(S.search), ranked = TD.recommend({ topic: S.topic, region: S.region }).filter(r => !hit || hit.includes(r.variable));
  $('#boardTitle').textContent = hit ? `Data variables matching “${S.search}” in ${S.region} (${ranked.length})` : `Evidence board: ${TOPICS.find(t => t[0] === S.topic)[1].toLowerCase()} in ${S.region} (${(TD.TRAITS[S.region] || []).join(', ')})`;
  const h = $('#board'); h.innerHTML = '';
  if (!ranked.length) h.innerHTML = '<p class="note">No data variable matches that search here. Try words like rain, snow, soil, heat, river or drought.</p>';
  ranked.forEach((r, i) => {
    const v = TD.varById(r.variable), o = TD.official(S.region, r.variable);
    const b = el('button', { class: 'ev' + (r.variable === S.variable ? ' on' : ''), type: 'button' }, `<div class="top"><b>${i + 1}. ${esc(v.display_name)}</b><span class="badge ${r.potential.level}">${ICON[r.potential.level]} ${esc(r.potential.label)}</span></div><p>${esc(v.definition)}</p><div class="row" style="gap:6px"><span class="tag">${v.kind === 'model' ? 'model estimate' : 'satellite'}</span><span class="tag">${esc(v.dataset)}</span><span class="tag">${o.sen_slope_per_year > 0 ? '▲' : '▼'} ${fmt(Math.abs(o.sen_slope_per_year * 10))} ${esc(v.trend_unit.replace('/year', ''))}/decade</span></div><div class="why">Why: ${esc(r.why)}.</div>`);
    b.onclick = () => setState({ variable: r.variable }, { scroll: '#investigation' }); h.appendChild(b);
  });
}

// ------------------------------------------------------------------ chart + verdict
function windowTest() { const yrs = D.years.filter(y => y >= S.startYear), s = TD.seriesOf(S.region, S.variable); return { yrs, t: TD.trendTest(yrs, yrs.map(y => s[y - 2001])) }; }
function eventShapes(ymin, ymax) { const shapes = [], ann = []; Object.keys(D.events).forEach(y => { shapes.push({ type: 'line', x0: +y, x1: +y, yref: 'paper', y0: 0, y1: 1, line: { color: C.muted, width: 1, dash: 'dot' } }); ann.push({ x: +y, yref: 'paper', y: 1, yanchor: 'bottom', text: y, showarrow: false, font: { size: 10.5, color: C.muted } }); }); return { shapes, ann }; }
function renderChart() {
  const v = TD.varById(S.variable), s = TD.seriesOf(S.region, S.variable), { yrs, t } = windowTest();
  $('#invTitle').textContent = `Investigation: ${v.display_name} · ${S.region}`;
  $('#chartTitle').textContent = `${v.display_name} each ${/May/.test(v.season) ? 'May–September' : 'monsoon (Jun–Sep)'}, ${S.region}`;
  const x0 = yrs[0], x1 = 2025, hov = `%{y:.4~g} ${v.unit}<extra>%{fullData.name}</extra>`;
  const traces = [
    { x: D.years, y: s, mode: 'lines+markers', name: 'Yearly value', line: { color: C.a, width: 2 }, marker: { size: 7, color: C.a, line: { color: '#fcfcfb', width: 1.5 } }, hovertemplate: hov },
  ];
  if (!Modes.needsGuess()) traces.push({ x: [x0, x1], y: [t.sen_intercept + t.sen_slope_per_year * x0, t.sen_intercept + t.sen_slope_per_year * x1], mode: 'lines', name: S.level === 'scientist' ? "Trend (Sen's slope)" : 'Trend line', line: { color: C.ink, width: 2, dash: 'dash' }, hoverinfo: 'skip' });
  if (S.level === 'scientist') traces.push({ x: [x0, x1], y: [t.ols_intercept + t.ols_slope_per_year * x0, t.ols_intercept + t.ols_slope_per_year * x1], mode: 'lines', name: 'OLS fit', line: { color: C.muted, width: 1.5, dash: 'dot' }, hoverinfo: 'skip' });
  const { shapes, ann } = eventShapes(); if (S.startYear > 2001) shapes.push({ type: 'rect', x0: 2000.5, x1: S.startYear - 0.5, yref: 'paper', y0: 0, y1: 1, fillcolor: '#b9b5a8', opacity: 0.22, line: { width: 0 } });
  const lay = baseLayout(); lay.shapes = shapes; lay.annotations = ann; lay.yaxis.title = { text: `${v.unit}`, standoff: 6 }; lay.xaxis.range = [2000.5, 2025.5];
  Plotly.react('chart', traces, lay, PLOT);
  $('#winLabel').textContent = `Record used: ${S.startYear}–2025 (${2025 - S.startYear + 1} yrs)`;
}
function renderVerdict() {
  const v = TD.varById(S.variable), o = TD.official(S.region, S.variable), { t } = windowTest(), full = S.startYear === 2001, unit = v.trend_unit.replace('/year', '');
  const box = $('#verdict'), sci = S.level === 'scientist', stu = S.level === 'student'; let sig;
  if (Modes.needsGuess()) { Modes.renderGuess(box); $('#stats').innerHTML = ''; $('#robust').innerHTML = ''; return; }
  const slope = full ? o.sen_slope_per_year : t.sen_slope_per_year, p = full ? o.p_value : t.p_mk_lag1_adjusted;
  const top = s => `<div class="vtop"><span class="stamp ${s ? 'sig' : 'ns'}">${s ? 'Proven trend' : 'Not proven yet'}</span><span class="vrate">${slope > 0 ? '▲ rising' : '▼ falling'} ${fmt(Math.abs(slope * 10))} ${esc(unit)} per decade</span></div>`;
  if (full) {
    const vd = TD.verdict(S.region, S.variable, S.level, t); sig = vd.significant;
    box.innerHTML = `${Modes.guessBanner()}${top(sig)}<h3>${esc(vd.headline)}</h3><p>${esc(vd.text)}</p>${meter(p)}<p class="note"><span class="tag">${v.kind === 'model' ? 'model estimate' : 'satellite observation'}</span> ${esc(v.dataset)} · ${esc(v.season)} · Caution: ${esc(v.caution)}</p>`;
  } else {
    sig = t.significant_05; const up = t.sen_slope_per_year > 0;
    box.innerHTML = `${top(sig)}<h3>With only ${t.n} years (${S.startYear}–2025): ${sig ? 'still proven' : 'not proven'}</h3><p>${esc(v.display_name)} ${up ? 'rises' : 'falls'} by about ${fmt(Math.abs(t.sen_slope_per_year * 10))} ${esc(unit)} per decade in this shorter record (p ${pEq(t.p_mk_lag1_adjusted)}). With the full 2001–2025 record the trend is ${o.significant ? 'proven' : 'not proven'} (p ${pEq(o.p_value)}). ${o.significant && !sig ? 'Same data, shorter record, weaker verdict: record length matters.' : ''}</p>${meter(p)}<p class="note">Recalculated in your browser for this shorter record. Drag the slider back to 2001 for the validated result.</p>`;
  }
  box.className = 'vd';
  const ci = full && o.ci_lower != null ? [o.ci_lower, o.ci_upper] : t.ols_ci95;
  const cells = [
    [stu ? 'How fast' : 'Rate of change', `${slope > 0 ? '+' : ''}${fmt(slope * 10)} ${unit}/decade`], [sci ? '95% confidence interval' : 'Likely range (95% sure)', `${fmt(ci[0] * 10)} to ${fmt(ci[1] * 10)}`],
    [stu ? 'Chance it is just luck (p)' : sci ? `Mann-Kendall p${full ? '' : ' (recalc.)'}` : 'p-value (trend test)', fmtP(p)], [stu ? 'Years of data' : sci ? 't-test p (OLS)' : 'p-value (second test)', stu ? String(t.n) : fmtP(t.p_ttest)],
  ];
  if (!stu && !sci) cells.push(['Years of data', String(t.n)], ['Years needed to prove it', t.years_to_detect ? `about ${t.years_to_detect}` : 'n/a']);
  if (sci) cells.push(["Kendall's τ", fmt(full ? o.kendall_tau : t.kendall_tau, 2)], ['Years in record', String(t.n)], ['Lag-1 autocorrelation', fmt(t.lag1_autocorrelation, 2)], ['Record needed to detect', t.years_to_detect ? `~${t.years_to_detect} yrs` : 'n/a']);
  $('#stats').innerHTML = cells.map(([k, val]) => `<div class="stat"><small>${esc(k)}</small><b>${esc(val)}</b></div>`).join('');
  const r = t.robustness, w = r.without_that_year;
  $('#robust').innerHTML = sci ? `<b>Robustness check.</b> t-test and Mann-Kendall ${r.ttest_and_mk_agree ? 'agree' : 'disagree'}. Most unusual year: <b>${r.most_unusual_year}</b>. Without it the trend ${w.same_direction ? 'keeps its direction' : 'changes direction'} and is ${w.still_significant ? 'significant' : 'not significant'} (p ${pEq(w.p_mk)}).${full ? ` Official test: ${esc(o.p_value_method)}.` : ''}`
    : `<b>Double-check.</b> The most unusual year is <b>${r.most_unusual_year}</b>. If we leave it out, the trend ${w.same_direction ? 'keeps going the same way' : 'flips direction'} and is ${w.still_significant ? 'proven' : 'not proven'} (p ${pEq(w.p_mk)}). ${r.ttest_and_mk_agree ? 'Two different tests agree.' : 'Two different tests disagree, so treat this one with care.'}`;
}
// Evidence meter: how strong the evidence is compared with the usual proof line (p = 0.05).
function meter(p) {
  const pos = Math.max(0, Math.min(1, -Math.log10(Math.max(p, 1e-4)) / 3)) * 100, line = -Math.log10(0.05) / 3 * 100;
  return `<div class="meter" role="img" aria-label="Evidence strength: p ${pEq(p)}"><div class="track"><div class="fill" style="width:${pos}%"></div><i class="bar" style="left:${line}%"></i><i class="dot" style="left:${pos}%"></i></div><div class="mlab"><span>weak evidence</span><span class="mid" style="left:${line}%">proof line (p = 0.05)</span><span>strong evidence</span></div></div>`;
}

// ------------------------------------------------------------------ map
function initMap(basin) {
  map = L.map('map', { zoomSnap: 0.25, attributionControl: true }).setView([30.6, 73.2], 5.25);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 10, opacity: 0.55 }).addTo(map);
  map.createPane('trend'); map.getPane('trend').style.zIndex = 350;
  if (basin.outline) L.geoJSON(basin.outline, { style: { color: '#17222e', weight: 1.6, fill: false }, interactive: false }).addTo(map);
  subLayer = L.geoJSON(basin.subbasins, { style: f => ({ color: f.properties.region === 'Upper Indus' ? C.a : C.b, weight: 0.8, fill: false, opacity: 0.8 }), interactive: false });
  D.places.forEach(p => L.circleMarker([p.lat, p.lon], { radius: 4, color: '#17222e', weight: 1, fillColor: '#fff', fillOpacity: 1 }).bindTooltip(p.name).on('click', e => { L.DomEvent.stopPropagation(e); showPlace(p.name); }).addTo(map));
  map.on('click', e => showLocal(e.latlng.lat, e.latlng.lng));
}
function renderMap() {
  const lay = D.layers[S.variable], v = TD.varById(S.variable);
  if (overlay) { map.removeLayer(overlay); overlay = null; }
  if (lay) overlay = L.imageOverlay(lay.png, lay.bounds, { opacity: 0.88, pane: 'trend' }).addTo(map);
  const isUL = S.comparison === 'Upper vs Lower Indus' && ['Upper Indus', 'Lower Indus'].includes(S.region);
  if (isUL) subLayer.addTo(map); else map.removeLayer(subLayer);
  const ramp = RAMPS[lay ? lay.ramp : 'wet'], lo = lay && lay.ramp === 'heat' ? 'cooling' : 'decreasing', hi = lay && lay.ramp === 'heat' ? 'warming' : 'increasing';
  $('#legend').innerHTML = lay ? `<span>${lo} −${fmt(lay.scale)}</span><span class="bar" style="background:linear-gradient(90deg,${ramp.join(',')})"></span><span>+${fmt(lay.scale)} ${hi}</span><span>(${esc(v.trend_unit)}, Sen's slope per pixel 2001–2025)</span>` : 'No trend map for this indicator.';
  $('#mapNote').innerHTML = `Map of <b>${esc(v.display_name)}</b> trend. Colours show the <b>rate of change, not statistical significance</b>. Click the basin for local values.${isUL ? ' Outlines: <span style="color:' + C.a + '">Upper</span> / <span style="color:' + C.b + '">Lower</span> Indus sub-basins.' : ''}`;
}
function showLocal(lat, lon, label) {
  const r = TD.sampleAt(lat, lon); let html;
  if (r.error) html = 'Map data still loading…';
  else if (!r.inside_basin) html = '<b>Outside the Indus Basin maps.</b>';
  else {
    const cur = r.trends.find(t => t.variable === S.variable);
    html = `<b>${esc(label || `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`)}</b><br>${cur ? `${esc(cur.name)}: <b>${cur.local_sen_slope_per_year > 0 ? '+' : ''}${fmt(cur.local_sen_slope_per_year)} ${esc(cur.unit)}</b><br>` : ''}<span style="color:#7b8794">Strongest local changes:</span><br>${r.trends.slice(0, 3).map(t => `${t.direction === 'increasing' ? '▲' : '▼'} ${esc(t.name)}`).join('<br>')}<br><a href="#" id="askPlace">Ask the detective about this spot →</a>`;
  }
  popup = L.popup({ maxWidth: 260 }).setLatLng([lat, lon]).setContent(html).openOn(map);
  setTimeout(() => { const a = document.getElementById('askPlace'); if (a) a.onclick = ev => { ev.preventDefault(); openChat(); ask(label ? `What is changing around ${label}?` : `What is changing at latitude ${lat.toFixed(2)}, longitude ${lon.toFixed(2)}?`); }; }, 50);
}
function showPlace(name, scroll) { const p = TD.findPlace(name); if (!p) return; if (scroll) $('#investigation').scrollIntoView({ behavior: 'smooth' }); map.flyTo([p.lat, p.lon], 7, { duration: 0.8 }); setTimeout(() => showLocal(p.lat, p.lon, p.name), 900); }

// ------------------------------------------------------------------ compare
function renderCompare() {
  const c = D.comparisons.find(x => x.id === S.comparison), v = TD.varById(S.variable), [ra, rb] = c.regions;
  $('#cmpBlurb').textContent = c.blurb; const d = TD.officialDiff(c.id, S.variable);
  if (!d) { Plotly.purge('cmpChart'); $('#cmpChart').innerHTML = ''; $('#cmpText').innerHTML = `<p class="note">${esc(v.display_name)} was not analysed for ${esc(c.id)}. Try another indicator or comparison.</p>`; return; }
  const tr = (r, col) => { const s = TD.seriesOf(r, S.variable), o = TD.official(r, S.variable), t = TD.trendTest(D.years, s); return [{ x: D.years, y: s, mode: 'lines+markers', name: r, line: { color: col, width: 2 }, marker: { size: 6, color: col, line: { color: '#fcfcfb', width: 1.5 } }, hovertemplate: `%{y:.4~g} ${v.unit}<extra>${r}</extra>` }, { x: [2001, 2025], y: [t.sen_intercept + o.sen_slope_per_year * 2001, t.sen_intercept + o.sen_slope_per_year * 2025], mode: 'lines', showlegend: false, line: { color: col, width: 1.5, dash: 'dash' }, hoverinfo: 'skip' }]; };
  const lay = baseLayout(); lay.yaxis.title = { text: v.unit, standoff: 6 }; const ev = eventShapes(); lay.shapes = ev.shapes; lay.annotations = ev.ann; lay.xaxis.range = [2000.5, 2025.5];
  Plotly.react('cmpChart', [...tr(ra, C.a), ...tr(rb, C.b)], lay, PLOT);
  const a = TD.official(ra, S.variable), b = TD.official(rb, S.variable), unit = v.trend_unit.replace('/year', ''), opp = Math.sign(a.sen_slope_per_year) !== Math.sign(b.sen_slope_per_year);
  const line = (r, o, col) => `<p><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col}"></span> <b>${esc(r)}</b>: ${o.sen_slope_per_year > 0 ? '▲ rising' : '▼ falling'} ${fmt(Math.abs(o.sen_slope_per_year * 10))} ${esc(unit)}/decade · p ${pEq(o.p_value)} · <span class="badge ${o.significant ? 'strong' : 'weak'}">${o.significant ? '✓ proven trend' : '○ not proven yet'}</span></p>`;
  const qLabel = S.level === 'scientist' ? 'FDR-adjusted q' : 'the test for the gap gives q';
  $('#cmpText').innerHTML = `<h3>${esc(v.display_name)}: ${esc(ra)} vs ${esc(rb)}</h3>${line(ra, a, C.a)}${line(rb, b, C.b)}<div class="vd" style="margin-top:8px"><div class="vtop"><span class="stamp ${d.significant ? 'sig' : 'ns'}">${d.significant ? 'Proven difference' : 'No proven difference'}</span></div><h3>${d.significant ? 'The two regions are drifting apart' : 'The two regions cannot be told apart yet'}</h3><p>${opp ? '<b>Opposite directions.</b> ' : 'Same direction, different speed. '}The gap between them (${esc(d.difference_definition || ra + ' minus ' + rb)}) changes by ${fmt(d.sen_slope_per_year * 10)} ${esc(unit)}/decade; ${qLabel} ${pEq(d.fdr_q)}${d.significant ? ', below the 0.05 proof line even after correcting for running many tests.' : ', above the 0.05 proof line after correcting for running many tests.'}</p>${meter(d.fdr_q)}<p class="note">A difference between regions counts only if the gap itself passes the test, not because one region is proven and the other is not.</p></div>`;
}

// ------------------------------------------------------------------ extreme-year story
function renderAnomaly() {
  const v = TD.varById(S.variable), abs = S.variable === 'lst_c';
  const rows = TD.regions().filter(r => available(r, S.variable)).map(r => { const a = TD.runTool('get_year_anomaly', { region: r, variable: S.variable, year: S.year }); return { r, val: abs ? a.anomaly : a.percent_anomaly, rank: a.rank_highest_first, sig: TD.official(r, S.variable).significant }; }).sort((x, y) => x.val - y.val);
  const top = rows[rows.length - 1];
  $('#storyNote').innerHTML = `How unusual was <b>${S.year}</b> for ${esc(v.display_name.toLowerCase())}? Bars show the departure from each region's own 2001–2025 average. In ${esc(top.r)} it was ${fmt(Math.abs(top.val))}${abs ? ' °C' : '%'} ${top.val > 0 ? 'above' : 'below'} average (rank ${top.rank} of 25), ${top.sig ? 'and the long-term trend there is also proven' : 'yet the long-term trend there is <b>not</b> proven'}. One dramatic year cannot prove a trend by itself; the trend tests above do that job.`;
  const lay = baseLayout(); lay.margin.l = 120; lay.hovermode = 'closest'; lay.xaxis = { gridcolor: C.grid, zeroline: true, zerolinecolor: C.ink, title: { text: abs ? 'Departure from average (°C)' : 'Departure from average (%)' } }; lay.yaxis = { automargin: true }; lay.showlegend = false; lay.bargap = 0.35;
  Plotly.react('anomChart', [{ type: 'bar', orientation: 'h', y: rows.map(x => x.r), x: rows.map(x => x.val), marker: { color: C.a }, text: rows.map(x => `${x.val > 0 ? '+' : ''}${fmt(x.val)}${abs ? '' : '%'}`), textposition: 'outside', cliponaxis: false, hovertemplate: '%{y}: %{x:.3~g}' + (abs ? ' °C' : '%') + '<extra></extra>' }], lay, PLOT);
}

// ------------------------------------------------------------------ AI detective chat
const chatHistory = [];
function openChat() { $('#chat').classList.add('open'); $('#chatBtn').style.display = 'none'; $('#chatInput').focus(); }
function initChat() {
  const local = S.provider === 'ollama';
  $('#chatMode').textContent = S.ai ? (local ? `local AI · ${S.model}` : 'live AI agent') : 'offline mode';
  $('#chatTitle').textContent = S.ai ? 'AI Trend Detective' : 'Trend Detective';
  $('#chatBtn').textContent = S.ai ? '🔎 Ask the AI detective' : '🔎 Ask the detective'; $('#askHero').textContent = S.ai ? 'Ask the AI detective' : 'Ask the detective';
  $('#siMode').textContent = local ? `In this deployment the detective chat is a free, open language model (${S.model}) running locally through Ollama. It is not a general chatbot: the model first turns the question into a plan, the app's own trend tools produce the numbers, the model writes the answer from those results only, and every number is checked against the tool results before it is shown.` : S.ai ? 'In this deployment the chat is a large language model that calls the trend tools of this app, and every number it states is checked against tool results.' : 'This deployment runs the detective chat in offline mode: a rule-based assistant that reads the question, picks the tools (variable ranking, trend tests, regional comparison, place lookup) and reports their results. The same tools can be driven by a large language model when an API key is configured on the server.';
  $('#chatBtn').onclick = openChat; $('#askHero').onclick = openChat;
  $('#chatClose').onclick = () => { $('#chat').classList.remove('open'); $('#chatBtn').style.display = ''; };
  $('#chatForm').onsubmit = e => { e.preventDefault(); const q = $('#chatInput').value.trim(); if (q) { $('#chatInput').value = ''; ask(q); } };
  addMsg('a', S.ai ? 'I am your AI trend detective. Ask me a question in plain language. I will choose the variables, run the trend tests and show you the evidence.' : 'Ask me a question in plain language. I will pick the clues, run the trend tests and show you the evidence. (Offline mode: rule-based, no language model.)');
  const sugg = ['Are Indus floods getting worse?', 'Is the mountain snow disappearing?', 'Was 2022 in Sindh a trend or a one-off?', 'What is changing around Sukkur?', 'Compare Upper and Lower Indus runoff'];
  sugg.forEach(q => { const b = el('button', { class: 'chip', type: 'button' }, esc(q)); b.onclick = () => ask(q); $('#sugg').appendChild(b); });
}
function addMsg(role, text) { const m = el('div', { class: 'msg ' + role }); m.textContent = text; $('#msgs').appendChild(m); $('#msgs').scrollTop = 1e9; return m; }
const stepLabel = s => `🔍 ${s.name}(${Object.values(s.input || {}).map(x => String(x)).join(', ')})`;
function applyActions(actions) {
  const a = (actions || []).slice(-1)[0]; if (!a) return; const patch = {};
  const v = TD.matchVariable(a.variable); if (v) patch.variable = v;
  if (a.comparison && D.comparisons.some(c => c.id === a.comparison)) { patch.comparison = a.comparison; if (!a.region) patch.region = D.comparisons.find(c => c.id === a.comparison).regions[0]; }
  const r = a.region && TD.matchRegion(a.region); if (r) patch.region = r;
  setState(patch, { scroll: a.comparison ? '#compare' : '#investigation' }); if (a.place) showPlace(a.place);
}
function finishAnswer(m, stepsBox, res) {
  stepsBox.innerHTML = ''; (res.steps || []).forEach(s => stepsBox.appendChild(el('div', { class: 'step' }, esc(stepLabel(s)))));
  const body = el('div'); body.textContent = res.text || '(no answer)'; m.appendChild(body);
  if (res.grounding) { const g = res.grounding, ok = !g.unverified.length; m.appendChild(el('div', { class: 'ground ' + (ok ? 'ok' : 'bad') }, ok ? `✓ ${g.checked} number${g.checked === 1 ? '' : 's'} traced to tool results` : `⚠ could not trace: ${esc(g.unverified.join(', '))}`)); }
  else if (res.mode === 'offline') m.appendChild(el('div', { class: 'ground ok' }, '✓ numbers come straight from the trend tools'));
  if (res.note) m.appendChild(el('div', { class: 'ground note' }, esc(res.note)));
  chatHistory.push({ role: 'assistant', content: res.text || '' }); applyActions(res.actions); $('#msgs').scrollTop = 1e9;
}
async function ask(q) {
  openChat(); addMsg('u', q); chatHistory.push({ role: 'user', content: q });
  const m = el('div', { class: 'msg a' }), stepsBox = el('div', { class: 'steps' }); stepsBox.appendChild(el('div', { class: 'step' }, 'investigating…')); m.appendChild(stepsBox); $('#msgs').appendChild(m); $('#msgs').scrollTop = 1e9;
  const offline = () => finishAnswer(m, stepsBox, TD.offlineDetective(q, S));
  if (!S.ai) return setTimeout(offline, 350);
  try {
    const res = await fetch('api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: chatHistory, state: { variable: S.variable, region: S.region, level: S.level } }) });
    const reader = res.body.getReader(), dec = new TextDecoder(); let buf = '', done = false, first = true;
    while (!done) {
      const r = await reader.read(); done = r.done; buf += dec.decode(r.value || new Uint8Array(), { stream: !done });
      let i; while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue; const ev = JSON.parse(line);
        if (ev.type === 'step') { if (first) { stepsBox.innerHTML = ''; first = false; } stepsBox.appendChild(el('div', { class: 'step' }, esc(stepLabel(ev)))); $('#msgs').scrollTop = 1e9; }
        else if (ev.type === 'final') finishAnswer(m, stepsBox, ev);
        else if (ev.type === 'error') { chatHistory.pop(); chatHistory.push({ role: 'user', content: q }); offline(); }
      }
    }
  } catch { offline(); }
}

// ------------------------------------------------------------------ demo cases (auto-play walkthroughs)
const go = sel => document.querySelector(sel).scrollIntoView({ behavior: 'smooth', block: 'start' });
function casesList() {
  const tool = (n, i) => TD.runTool(n, i), u = id => TD.varById(id).trend_unit.replace('/year', '');
  const rx = tool('get_trend', { region: 'Indus Basin', variable: 'rx1day_mm' }), rxo = rx.official_result, rxe = rx.exploratory_recalculation;
  const ro = tool('compare_regions', { comparison: 'Upper vs Lower Indus', variable: 'total_runoff_mm' }), sn = tool('compare_regions', { comparison: 'Upper vs Lower Indus', variable: 'snow_index' });
  const sp = tool('get_trend', { region: 'Sindh', variable: 'precipitation_mm' }).official_result, an = tool('get_year_anomaly', { region: 'Sindh', variable: 'precipitation_mm', year: 2022 }), short = tool('test_period', { region: 'Sindh', variable: 'precipitation_mm', start_year: 2011, end_year: 2025 });
  const show = (region, variable) => { Modes.reveal(region, variable); };
  return [
    Modes.tour(),
    { title: 'Are monsoon downpours getting heavier?', sub: 'Extreme rain over the whole Indus Basin', steps: [
      [() => { show('Indus Basin', 'rx1day_mm'); setState({ topic: 'floods', region: 'Indus Basin', startYear: 2001, variable: 'rx1day_mm' }); go('#interview'); }, 'The question: are the heaviest monsoon downpours over the Indus getting heavier? The detective ranks the clues for a flood question in this region.'],
      [() => go('#investigation'), `Clue: Rx1day, the wettest single day of each monsoon, measured by NASA's GPM IMERG satellites. One dot per year, 2001–2025.`],
      [() => {}, `How fast? The dashed trend line rises by ${fmt(rxo.sen_slope_per_year * 10)} mm per decade.`],
      [() => {}, `Is it significant? p ${pEq(rxo.p_value)}. That is close, but above the 0.05 bar, so the trend is not proven yet. A near miss is still a finding.`],
      [() => {}, `Robustness check: the most unusual year is ${rxe.robustness.most_unusual_year}. Without it, the trend ${rxe.robustness.without_that_year.still_significant ? 'becomes significant' : 'stays not significant'} (p ${pEq(rxe.robustness.without_that_year.p_mk)}). ${rxe.more_years_needed ? `To be confident either way we may need about ${rxe.more_years_needed} more years of data.` : ''}`],
      [() => { map.flyTo([29.5, 71], 5.5); }, 'Where? Green areas on the map are where the wettest day is growing fastest. Colours show the rate of change, not significance. Click anywhere for local values.'],
    ] },
    { title: 'Same river, two different stories', sub: 'Mountain headwaters vs the plains', steps: [
      [() => { setState({ region: 'Upper Indus', variable: 'total_runoff_mm', comparison: 'Upper vs Lower Indus', startYear: 2001 }); go('#compare'); }, 'One river basin, one monsoon, but do the mountains and the plains change in the same way? We split the Indus at Chashma Barrage.'],
      [() => {}, `Modelled runoff (NASA FLDAS) is rising in both: ${fmt(ro['Upper Indus'].sen_slope_per_year * 10)} ${u('total_runoff_mm')} per decade upstream, but ${fmt(ro['Lower Indus'].sen_slope_per_year * 10)} per decade downstream.`],
      [() => {}, `Is that gap real? The difference itself is tested, with a correction for running many tests: q ${pEq(ro.difference_trend.fdr_q)}, ${ro.difference_trend.significant_after_fdr ? 'significant. The plains are changing faster than the mountains.' : 'not significant.'}`],
      [() => setState({ variable: 'snow_index', comparison: 'Upper vs Lower Indus' }), `Now snow cover. Upstream it is ${sn['Upper Indus'].sen_slope_per_year > 0 ? 'rising' : 'falling'}, downstream ${sn['Lower Indus'].sen_slope_per_year > 0 ? 'rising' : 'falling'}: ${sn.opposite_directions ? 'opposite directions' : 'the same direction'}.`],
      [() => {}, `But q ${pEq(sn.difference_trend.fdr_q)}: ${sn.difference_trend.significant_after_fdr ? 'the contrast is significant.' : 'the contrast is not significant. Opposite arrows are a clue, not proof.'} A good detective reports both.`],
    ] },
    { title: '2022: record flood year. Is it a trend?', sub: 'Sindh monsoon rain and the power of record length', steps: [
      [() => { show('Sindh', 'precipitation_mm'); setState({ region: 'Sindh', variable: 'precipitation_mm', startYear: 2001, year: 2022 }); go('#story'); }, `In 2022 Sindh's monsoon rain was ${fmt(an.percent_anomaly)}% above its 2001–2025 average, the wettest of all 25 years.`],
      [() => go('#investigation'), 'One extreme year grabs attention. But a trend is about all the years, not one. Look at the full record.'],
      [() => {}, `Over 25 years, Sindh's monsoon rain rises by ${fmt(sp.sen_slope_per_year * 10)} mm per decade, p ${pEq(sp.p_value)}: ${sp.significant_05 ? 'statistically significant' : 'not significant'}.`],
      [() => { S.startYear = 2011; renderAll(); }, `Now pretend the satellites only started in 2011. Same place, shorter record: p ${pEq(short.p_mk_lag1_adjusted)}, ${short.significant_05 ? 'still significant' : 'no longer significant'}.`],
      [() => { S.startYear = 2001; renderAll(); }, 'The lesson: sometimes all a trend needs to become significant is a longer record. That is why long satellite missions matter.'],
    ] },
  ];
}
let demo = null;
function buildCases() { const list = casesList(); const h = $('#cases'); list.forEach((c, i) => { const b = el('button', { class: 'case' + (c.tour ? ' tour' : ''), type: 'button' }, `<span class="cno">${c.tour ? 'Start here: the tour' : 'Case file no. ' + i}</span><b>${esc(c.title)}</b><span class="sub">${esc(c.sub)}</span><span class="walk">${c.steps.length} steps · walk me through <i>→</i></span>`); b.onclick = () => startDemo(list[i]); h.appendChild(b); }); $('#demoNext').onclick = () => demoStep(1); $('#demoExit').onclick = stopDemo; $('#demoPause').onclick = () => { demo.paused = !demo.paused; $('#demoPause').textContent = demo.paused ? 'Play' : 'Pause'; if (!demo.paused) schedule(); else clearTimeout(demo.timer); }; }
function startDemo(c) { stopDemo(); demo = { c, i: -1, paused: false, timer: null }; $('#demo').classList.add('on'); $('#chatBtn').style.display = 'none'; $('#demoPause').textContent = 'Pause'; demoStep(1); }
function schedule() { clearTimeout(demo.timer); demo.timer = setTimeout(() => demoStep(1), 7000); }
function demoStep(d) { if (!demo) return; demo.i += d; if (demo.i >= demo.c.steps.length) return stopDemo(); const [fn, text] = demo.c.steps[demo.i]; fn(); $('#demoT').textContent = `Case file: ${demo.c.title} · step ${demo.i + 1} of ${demo.c.steps.length}`; $('#demoP').textContent = text; $('#demoDots').innerHTML = demo.c.steps.map((_, k) => `<i class="${k <= demo.i ? 'on' : ''}"></i>`).join(''); if (!demo.paused) schedule(); }
function stopDemo() { if (demo) clearTimeout(demo.timer); demo = null; $('#demo').classList.remove('on'); if (!$('#chat').classList.contains('open')) $('#chatBtn').style.display = ''; }

boot().catch(e => { console.error(e); document.querySelector('main').prepend(el('div', { class: 'card' }, 'Could not load the app data: ' + esc(e.message))); });
