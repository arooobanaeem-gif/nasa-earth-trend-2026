// Shared trend engine + detective tools. Runs in the browser (window.TD) and in Node (require).
// SI-assisted code (Claude). All statistics here are plain linear-trend methods:
// OLS + t-test + 95% CI, Mann-Kendall (lag-1 adjusted), Sen's slope, years-to-detect.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.TD = m;
})(typeof self !== 'undefined' ? self : this, function () {
  // ------------------------------------------------------------------ math
  function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }
  const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
  function lgamma(x) { const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]; let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015; for (let j = 0; j < 6; j++) s += c[j] / ++y; return -t + Math.log(2.5066282746310005 * s / x); }
  function betacf(a, b, x) { let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d; for (let m = 1; m <= 200; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break; } return h; }
  function betai(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  const tTwoSidedP = (t, df) => betai(df / 2, 0.5, df / (df + t * t));
  function tCrit(df) { let lo = 0, hi = 50; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (tTwoSidedP(mid, df) > 0.05) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

  // ------------------------------------------------------------------ trend tests
  function mannKendall(y) {
    const n = y.length; let S = 0;
    for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i]);
    const counts = {}; y.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    let tie = 0; for (const k in counts) { const t = counts[k]; if (t > 1) tie += t * (t - 1) * (2 * t + 5); }
    const varS = (n * (n - 1) * (2 * n + 5) - tie) / 18;
    const z = S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0;
    return { S, varS, z, p: 2 * (1 - normCdf(Math.abs(z))), tau: S / (n * (n - 1) / 2) };
  }
  function senSlope(x, y) { const s = []; for (let i = 0; i < x.length - 1; i++) for (let j = i + 1; j < x.length; j++) if (x[j] !== x[i]) s.push((y[j] - y[i]) / (x[j] - x[i])); const slope = median(s); return { slope, intercept: median(y.map((v, i) => v - slope * x[i])) }; }
  function ols(x, y) {
    const n = x.length, mx = mean(x), my = mean(y); let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
    const slope = sxy / sxx, intercept = my - slope * mx; let sse = 0; const res = [];
    for (let i = 0; i < n; i++) { const r = y[i] - (intercept + slope * x[i]); res.push(r); sse += r * r; }
    const df = n - 2, se = Math.sqrt(sse / df / sxx), t = slope / se, tc = tCrit(df);
    return { slope, intercept, se, t, df, p: tTwoSidedP(t, df), ci: [slope - tc * se, slope + tc * se], res, sigma: Math.sqrt(sse / df) };
  }
  function lag1(r) { const m = mean(r); let num = 0, den = 0; for (let i = 0; i < r.length; i++) { den += (r[i] - m) ** 2; if (i) num += (r[i] - m) * (r[i - 1] - m); } return den ? num / den : 0; }

  // Full linear-trend report for one annual series.
  function trendTest(years, values) {
    const x = [], y = []; years.forEach((yr, i) => { if (values[i] != null && Number.isFinite(values[i])) { x.push(yr); y.push(values[i]); } });
    const n = x.length; if (n < 5) return { n, error: 'Too few years for a trend test (need at least 5).' };
    const mk = mannKendall(y), sen = senSlope(x, y), o = ols(x, y);
    const rho = lag1(y.map((v, i) => v - (sen.intercept + sen.slope * x[i])));
    // lag-1 variance correction (Yue & Wang style), applied only for positive autocorrelation
    let cf = 1; if (rho > 0) { for (let k = 1; k < n; k++) cf += 2 * (1 - k / n) * Math.pow(rho, k); }
    const zAdj = mk.z / Math.sqrt(cf), pAdj = 2 * (1 - normCdf(Math.abs(zAdj)));
    // Weatherhead et al. (1998): years of record needed to detect this trend (90% chance at 95% confidence)
    const phi = Math.max(0, Math.min(0.9, lag1(o.res)));
    const nStar = Math.abs(o.slope) > 0 ? Math.pow(3.3 * Math.sqrt(12) * o.sigma / Math.abs(o.slope) * Math.sqrt((1 + phi) / (1 - phi)), 2 / 3) : Infinity;
    // robustness: drop the single most unusual year and re-test
    let worst = 0; o.res.forEach((r, i) => { if (Math.abs(r) > Math.abs(o.res[worst])) worst = i; });
    const x2 = x.filter((_, i) => i !== worst), y2 = y.filter((_, i) => i !== worst), mk2 = mannKendall(y2), sen2 = senSlope(x2, y2);
    const significant = pAdj < 0.05;
    return {
      n, start_year: x[0], end_year: x[n - 1], mean: mean(y),
      sen_slope_per_year: sen.slope, sen_intercept: sen.intercept,
      ols_slope_per_year: o.slope, ols_intercept: o.intercept, ols_ci95: o.ci, p_ttest: o.p,
      kendall_tau: mk.tau, p_mk: mk.p, p_mk_lag1_adjusted: pAdj, lag1_autocorrelation: rho,
      significant_05: significant,
      years_to_detect: Number.isFinite(nStar) ? Math.ceil(nStar) : null,
      more_years_needed: significant || !Number.isFinite(nStar) ? 0 : Math.max(0, Math.ceil(nStar) - n),
      borderline: !significant && pAdj < 0.15,
      robustness: {
        ols_and_sen_same_direction: Math.sign(o.slope) === Math.sign(sen.slope),
        ttest_and_mk_agree: (o.p < 0.05) === (mk.p < 0.05),
        most_unusual_year: x[worst],
        without_that_year: { sen_slope_per_year: sen2.slope, p_mk: mk2.p, same_direction: Math.sign(sen2.slope) === Math.sign(sen.slope), still_significant: mk2.p < 0.05 },
      },
    };
  }

  // ------------------------------------------------------------------ data access
  let D = null, G = null;
  const init = (data, grids) => { D = data; if (grids) G = grids; };
  const REGION_OF = {};
  const regions = () => D.comparisons.flatMap(c => c.regions);
  const varById = id => D.variables.find(v => v.id === id);
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function matchRegion(name) { const q = norm(name); if (!q) return 'Indus Basin'; const all = regions(); return all.find(r => norm(r) === q) || all.find(r => norm(r).includes(q) || q.includes(norm(r))) || (/(whole|basin|indus|all)/.test(q) ? 'Indus Basin' : null); }
  function matchVariable(name) { const q = norm(name); return (D.variables.find(v => v.id === name) || D.variables.find(v => norm(v.id) === q || norm(v.display_name) === q) || D.variables.find(v => norm(v.display_name).includes(q)) || {}).id || null; }
  const comparisonOf = region => D.comparisons.find(c => c.regions.includes(region));
  const official = (region, variable) => D.results.find(r => r.result_type === 'regional_trend' && r.region === region && r.variable === variable) || null;
  const officialDiff = (comparison, variable) => D.results.find(r => r.result_type === 'difference_trend' && r.comparison === comparison && r.variable === variable) || null;
  const seriesOf = (region, variable) => (D.series[region] || {})[variable] || null;
  const r4 = v => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(4)));
  const round = o => { if (Array.isArray(o)) return o.map(round); if (o && typeof o === 'object') { const x = {}; for (const k in o) x[k] = round(o[k]); return x; } return typeof o === 'number' ? r4(o) : o; };

  // ------------------------------------------------------------------ recommender ("trend potential")
  const TRAITS = {
    'Indus Basin': ['monsoon', 'snow-fed', 'glacierised', 'floodplain'], 'Upper Indus': ['glacierised', 'snow-fed', 'mountain'], 'High Elevation': ['glacierised', 'snow-fed', 'mountain'],
    'Lower Indus': ['monsoon', 'arid plains', 'floodplain'], 'Low Elevation': ['monsoon', 'arid plains', 'floodplain'], 'Punjab': ['monsoon', 'irrigated plains', 'floodplain'], 'Sindh': ['arid plains', 'floodplain', 'monsoon'],
  };
  const TOPIC_VARS = {
    floods: { rx1day_mm: 3, total_runoff_mm: 3, precipitation_mm: 2, surface_runoff_mm: 2, soil_0_10: 1 },
    heat: { lst_c: 3, snow_index: 1.5, soil_0_10: 1 },
    snow: { snow_index: 3, swe_mm: 3, lst_c: 2, total_runoff_mm: 1 },
    water: { total_runoff_mm: 3, subsurface_runoff_mm: 2, soil_0_10: 2, soil_10_40: 2, soil_40_100: 2, soil_100_200: 2, precipitation_mm: 1.5 },
    any: {},
  };
  const TRAIT_VARS = {
    glacierised: { snow_index: 2, swe_mm: 2, lst_c: 2, surface_runoff_mm: 1 }, 'snow-fed': { snow_index: 1.5, swe_mm: 1.5, total_runoff_mm: 1 }, mountain: { lst_c: 1, rx1day_mm: 0.5 },
    monsoon: { precipitation_mm: 2, rx1day_mm: 2 }, 'arid plains': { soil_0_10: 1, lst_c: 1, rx1day_mm: 1 }, 'irrigated plains': { soil_10_40: 1, subsurface_runoff_mm: 1 }, floodplain: { total_runoff_mm: 2, rx1day_mm: 1 },
  };
  function potential(res) { if (!res) return { level: 'none', label: 'No data here' }; if (res.significant) return { level: 'strong', label: 'Proven trend' }; if (res.p_value < 0.2) return { level: 'emerging', label: 'Possible trend' }; return { level: 'weak', label: 'No clear trend yet' }; }
  function recommend({ topic = 'any', region = 'Indus Basin' } = {}) {
    const traits = TRAITS[region] || []; const tw = TOPIC_VARS[topic] || {};
    return D.variables.map(v => {
      const res = official(region, v.id); if (!res) return null;
      const topicScore = tw[v.id] || 0; let traitScore = 0; const because = [];
      traits.forEach(t => { const w = (TRAIT_VARS[t] || {})[v.id]; if (w) { traitScore += w; because.push(t); } });
      const pot = potential(res), signal = pot.level === 'strong' ? 3 : pot.level === 'emerging' ? 1.5 : 0.5;
      const why = [];
      if (topicScore) why.push(`matches your topic`);
      if (because.length) why.push(`this region is ${because.slice(0, 2).join(' and ')}`);
      why.push(pot.level === 'strong' ? 'the quick test found a proven trend' : pot.level === 'emerging' ? 'the quick test found a possible trend that is not proven yet' : 'the quick test found no clear trend yet');
      return { variable: v.id, name: v.display_name, score: r4(topicScore * 2 + traitScore + signal), potential: pot, why: why.join('; '), definition: v.definition };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
  }

  // ------------------------------------------------------------------ map sampling
  function sampleAt(lat, lon) {
    if (!G) return { error: 'Map grids not loaded.' };
    const out = []; let inside = false;
    for (const v of D.variables) {
      const g = G[v.id]; if (!g) continue; const [w, s, e, n] = g.bbox;
      if (lon < w || lon >= e || lat <= s || lat > n) continue;
      const cx = Math.floor((lon - w) / (e - w) * g.w), cy = Math.floor((n - lat) / (n - s) * g.h), val = g.values[cy * g.w + cx];
      if (val == null) continue; inside = true;
      const scale = D.layers[v.id] ? D.layers[v.id].scale : 1;
      out.push({ variable: v.id, name: v.display_name, local_sen_slope_per_year: val, unit: v.trend_unit, direction: val > 0 ? 'increasing' : val < 0 ? 'decreasing' : 'flat', strength_vs_basin: r4(Math.min(1, Math.abs(val) / scale)) });
    }
    if (!inside) return { lat, lon, inside_basin: false, note: 'This point is outside the Indus Basin trend maps.' };
    out.sort((a, b) => b.strength_vs_basin - a.strength_vs_basin);
    return { lat: r4(lat), lon: r4(lon), inside_basin: true, pixel_size_km: '~11 km (resampled)', note: 'Local values are Sen slopes per pixel, 2001-2025. They show the rate of change, NOT statistical significance.', trends: out };
  }
  function findPlace(name) { const q = norm(name); return D.places.find(p => norm(p.name) === q) || D.places.find(p => norm(p.name).includes(q) || q.includes(norm(p.name).split(' ')[0])) || null; }

  // ------------------------------------------------------------------ detective tools (used by the AI agent and the offline detective)
  const TOOLS = [
    { name: 'list_variables', description: 'List the 12 Earth-system indicators available for the Indus Basin (2001-2025) with definitions, units, data source (NASA mission or model) and scientific cautions. Call this first when the user asks what can be investigated.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
    { name: 'recommend_variables', description: 'Rank indicators that are most likely to show a trend for a topic and region, using region traits (glacierised, monsoon, arid plains...) plus a quick trend scan. Use it to turn a vague curiosity into candidate variables.', input_schema: { type: 'object', properties: { topic: { type: 'string', enum: ['floods', 'heat', 'snow', 'water', 'any'] }, region: { type: 'string', description: 'Indus Basin, Upper Indus, Lower Indus, Punjab, Sindh, High Elevation or Low Elevation' } }, additionalProperties: false } },
    { name: 'get_trend', description: 'Official trend result for one indicator in one region for 2001-2025 (Sen slope, confidence interval, Mann-Kendall p-value, significance) plus an exploratory OLS/t-test, years-to-detect and a robustness check. This is the main evidence tool.', input_schema: { type: 'object', properties: { region: { type: 'string' }, variable: { type: 'string', description: 'indicator id such as rx1day_mm, precipitation_mm, lst_c, snow_index, swe_mm, total_runoff_mm, soil_0_10' } }, required: ['region', 'variable'], additionalProperties: false } },
    { name: 'test_period', description: 'Re-run the trend tests on a shorter window of years (for example 2011-2025) to show how record length changes significance. Exploratory recalculation, not the official result.', input_schema: { type: 'object', properties: { region: { type: 'string' }, variable: { type: 'string' }, start_year: { type: 'integer' }, end_year: { type: 'integer' } }, required: ['region', 'variable', 'start_year', 'end_year'], additionalProperties: false } },
    { name: 'compare_regions', description: 'Compare two regions for one indicator: each region\'s trend plus the direct trend of the difference between them with its FDR-adjusted q-value. comparison is one of: "Upper vs Lower Indus", "Punjab vs Sindh", "High vs Low Elevation". Use it for "same process, opposite trends" questions.', input_schema: { type: 'object', properties: { comparison: { type: 'string', enum: ['Upper vs Lower Indus', 'Punjab vs Sindh', 'High vs Low Elevation'] }, variable: { type: 'string' } }, required: ['comparison', 'variable'], additionalProperties: false } },
    { name: 'get_year_anomaly', description: 'How unusual one year was (for example 2010 or 2022) for an indicator in a region: value, long-term mean, percent anomaly and rank among the 25 years.', input_schema: { type: 'object', properties: { region: { type: 'string' }, variable: { type: 'string' }, year: { type: 'integer' } }, required: ['region', 'variable', 'year'], additionalProperties: false } },
    { name: 'investigate_place', description: 'Look up a town, dam or barrage in or near the Indus Basin (or raw lat/lon) and sample the per-pixel trend maps there for all indicators. Returns the local rate of change only; significance comes from the regional tests.', input_schema: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } }, additionalProperties: false } },
    { name: 'show_in_app', description: 'Update the dashboard so the user sees the evidence you are describing: choose the indicator and region (or a comparison) to display on the chart and map. Call it once per answer, with the most relevant view.', input_schema: { type: 'object', properties: { variable: { type: 'string' }, region: { type: 'string' }, comparison: { type: 'string' }, place: { type: 'string' } }, required: ['variable'], additionalProperties: false } },
  ];

  function runTool(name, input = {}) {
    try {
      if (name === 'list_variables') return D.variables.map(v => ({ id: v.id, name: v.display_name, group: v.group, unit: v.unit, source: v.dataset, type: v.kind === 'model' ? 'model estimate' : 'satellite observation', season: v.season, definition: v.definition, caution: v.caution }));
      if (name === 'recommend_variables') { const region = matchRegion(input.region) || 'Indus Basin'; return { region, region_traits: TRAITS[region], ranked: recommend({ topic: input.topic || 'any', region }).slice(0, 6) }; }
      if (name === 'show_in_app') return { ok: true };
      if (name === 'investigate_place') {
        let lat = input.lat, lon = input.lon, label = null;
        if (input.place) { const p = findPlace(input.place); if (!p) return { error: `Unknown place "${input.place}". Known places: ${D.places.map(x => x.name).join(', ')}` }; lat = p.lat; lon = p.lon; label = p.name; }
        if (lat == null || lon == null) return { error: 'Give a place name or lat/lon.' };
        return { place: label, ...sampleAt(lat, lon) };
      }
      const variable = matchVariable(input.variable); if (!variable) return { error: `Unknown variable "${input.variable}". Valid ids: ${D.variables.map(v => v.id).join(', ')}` };
      const v = varById(variable);
      const meta = { variable, name: v.display_name, unit: v.unit, trend_unit: v.trend_unit, source: v.dataset, type: v.kind === 'model' ? 'model estimate' : 'satellite observation', season: v.season, caution: v.caution };
      if (name === 'compare_regions') {
        const c = D.comparisons.find(x => x.id === input.comparison); if (!c || c.regions.length < 2) return { error: 'Unknown comparison.' };
        const diff = officialDiff(c.id, variable); if (!diff) return { error: `${v.display_name} is not available for ${c.id}.` };
        const [a, b] = c.regions.map(r => official(r, variable));
        return round({ ...meta, comparison: c.id, about: c.blurb, [c.regions[0]]: slim(a), [c.regions[1]]: slim(b), opposite_directions: Math.sign(a.sen_slope_per_year) !== Math.sign(b.sen_slope_per_year), difference_trend: { definition: diff.difference_definition, sen_slope_per_year: diff.sen_slope_per_year, p_value: diff.p_value, fdr_q: diff.fdr_q, significant_after_fdr: diff.significant, basis: diff.significance_basis } });
      }
      const region = matchRegion(input.region); if (!region) return { error: `Unknown region "${input.region}". Valid: ${regions().join(', ')}` };
      const s = seriesOf(region, variable); if (!s) return { error: `${v.display_name} is not available for ${region}.` };
      if (name === 'get_trend') { const t = trendTest(D.years, s); return round({ ...meta, region, official_result: slim(official(region, variable)), exploratory_recalculation: { ols_slope_per_year: t.ols_slope_per_year, ols_ci95: t.ols_ci95, p_ttest: t.p_ttest, lag1_autocorrelation: t.lag1_autocorrelation, years_of_record_needed_to_detect: t.years_to_detect, more_years_needed: t.more_years_needed, borderline_record_is_about_long_enough: t.borderline, robustness: t.robustness } }); }
      if (name === 'test_period') { const a = Math.max(2001, input.start_year | 0), b = Math.min(2025, input.end_year | 0); const yrs = D.years.filter(y => y >= a && y <= b); return round({ ...meta, region, note: 'Exploratory recalculation on a shorter window; the official result uses 2001-2025.', ...trendTest(yrs, yrs.map(y => s[y - 2001])) }); }
      if (name === 'get_year_anomaly') { const i = (input.year | 0) - 2001; if (i < 0 || i > 24 || s[i] == null) return { error: 'Year must be 2001-2025.' }; const vals = s.filter(x => x != null), m = mean(vals); const rank = [...vals].sort((x, y) => y - x).indexOf(s[i]) + 1; return round({ ...meta, region, year: input.year | 0, value: s[i], mean_2001_2025: m, anomaly: s[i] - m, percent_anomaly: (s[i] - m) / Math.abs(m) * 100, rank_highest_first: rank, of_years: vals.length, note: 'An extreme year is not the same as a long-term trend.' }); }
      return { error: `Unknown tool ${name}` };
    } catch (e) { return { error: String(e && e.message || e) }; }
  }
  const slim = r => r && ({ sen_slope_per_year: r.sen_slope_per_year, slope_ci95: [r.ci_lower, r.ci_upper], kendall_tau: r.kendall_tau, p_value: r.p_value, method: r.p_value_method, significant_05: r.significant, mean: r.mean, n_years: r.n_years });

  // ------------------------------------------------------------------ plain-language verdicts
  const fmt = (v, d = 3) => { if (v == null || !Number.isFinite(v)) return 'n/a'; const a = Math.abs(v); if (a === 0) return '0'; if (a >= 100) return v.toFixed(0); if (a >= 10) return v.toFixed(1); if (a >= 1) return v.toFixed(2); return Number(v.toPrecision(d)).toString(); };
  const fmtP = p => (p == null ? 'n/a' : p < 0.001 ? '< 0.001' : p.toFixed(3));
  const pEq = p => (p != null && p < 0.001 ? '< 0.001' : '= ' + fmtP(p));
  function verdict(region, variable, level = 'public', t) {
    const v = varById(variable), o = official(region, variable); if (!v || !o) return null;
    t = t || trendTest(D.years, seriesOf(region, variable));
    const up = o.sen_slope_per_year > 0, dir = up ? 'rising' : 'falling', perDec = o.sen_slope_per_year * 10, unit = v.trend_unit.replace('/year', '');
    const name = v.display_name, lname = name.toLowerCase().replace('rx1day', 'Rx1day'), sig = o.significant; let headline, text;
    const where = ({ 'Indus Basin': 'the Indus Basin', 'Upper Indus': 'the Upper Indus', 'Lower Indus': 'the Lower Indus', 'High Elevation': 'the high-elevation zone', 'Low Elevation': 'the low-elevation zone' })[region] || region;
    const more = !sig && t.more_years_needed ? `About ${t.more_years_needed} more year${t.more_years_needed > 1 ? 's' : ''} of data may be needed to reliably detect a trend of this size.` : '';
    if (level === 'student') {
      headline = sig ? `Yes: ${name} is ${dir}` : `Not proven yet: ${name} tilts ${up ? 'up' : 'down'}`;
      text = sig ? `In ${where}, ${lname} changes by about ${fmt(Math.abs(perDec))} ${unit} every 10 years (${dir}). The test says this is very unlikely to be random luck (p ${pEq(o.p_value)}; scientists call a trend "significant" when p is below 0.05).`
        : `In ${where}, the line tilts ${up ? 'up' : 'down'} by about ${fmt(Math.abs(perDec))} ${unit} every 10 years, but the year-to-year ups and downs are bigger than the tilt (p ${pEq(o.p_value)}, we need below 0.05). That does not mean nothing is changing. ${more}`;
    } else if (level === 'scientist') {
      headline = `${sig ? 'Significant' : 'Not significant'} ${up ? 'positive' : 'negative'} trend (α = 0.05)`;
      text = `${name}, ${region}, ${v.season}, n = ${o.n_years}: Sen's slope = ${fmt(o.sen_slope_per_year)} ${v.trend_unit} ${o.ci_lower != null ? `(95% CI ${fmt(o.ci_lower)} to ${fmt(o.ci_upper)})` : ''}, Kendall τ = ${fmt(o.kendall_tau)}, p ${pEq(o.p_value)} (${o.p_value_method}). OLS slope = ${fmt(t.ols_slope_per_year)} (95% CI ${fmt(t.ols_ci95[0])} to ${fmt(t.ols_ci95[1])}), t-test p ${pEq(t.p_ttest)}; lag-1 r = ${fmt(t.lag1_autocorrelation, 2)}. ${sig ? '' : t.years_to_detect ? `Estimated record needed for detection: ~${t.years_to_detect} years (Weatherhead et al. 1998, 90% detection probability).` : ''}`;
    } else {
      headline = sig ? `${name} is ${dir}, and the trend is statistically significant` : `${name} shows a ${up ? 'rising' : 'falling'} tendency that is not yet significant`;
      text = sig ? `Across ${where}, ${lname} is ${dir} by about ${fmt(Math.abs(perDec))} ${unit} per decade over 2001-2025 (p ${pEq(o.p_value)}).`
        : `Across ${where}, ${lname} is ${dir} by about ${fmt(Math.abs(perDec))} ${unit} per decade, but natural year-to-year variability is too large to call it a confirmed trend (p ${pEq(o.p_value)}). ${more} A non-significant result is not evidence of no change.`;
    }
    return { headline, text, significant: sig, direction: dir, caution: v.caution };
  }

  // ------------------------------------------------------------------ offline detective (rule-based fallback when no LLM is connected)
  const KEY_VARS = [[/extreme|cloudburst|heaviest|wettest|rx1|downpour|flash/, 'rx1day_mm'], [/flood|runoff|river|discharge/, 'total_runoff_mm'], [/rain|monsoon|precip|wet/, 'precipitation_mm'], [/heat|hot|warm|temperature|lst/, 'lst_c'], [/swe|snow water|snowpack/, 'swe_mm'], [/snow|ice|glacier|melt/, 'snow_index'], [/deep soil|groundwater/, 'soil_100_200'], [/soil|drought|dry|moisture/, 'soil_0_10']];
  function offlineDetective(question, state = {}) {
    const q = norm(question), steps = [];
    const call = (name, input) => { const output = runTool(name, input); steps.push({ name, input, output }); return output; };
    let variable = (KEY_VARS.find(([re]) => re.test(q)) || [])[1] || (/\b20[0-2]\d\b/.test(q) ? 'precipitation_mm' : state.variable || 'rx1day_mm');
    const place = D.places.find(p => q.includes(norm(p.name).split(' ')[0]));
    let region = regions().find(r => r !== 'Indus Basin' && q.includes(norm(r))) || (/upper|mountain|north/.test(q) ? 'Upper Indus' : /lower|plain|south/.test(q) ? 'Lower Indus' : null);
    const year = (q.match(/\b(20[0-2]\d)\b/) || [])[1];
    const wantsCompare = /compare|versus| vs |opposite|differ|contrast|both/.test(q);
    const level = state.level || 'public'; const parts = []; let action = { variable };
    const topicHit = /flood|worse|danger|risk/.test(q) ? 'floods' : /snow|ice|glacier|melt/.test(q) ? 'snow' : /heat|hot|warm/.test(q) ? 'heat' : /drought|dry|water/.test(q) ? 'water' : null;
    const broadTopic = topicHit && !/rain|precip|runoff|rx1|wettest|extreme|swe|soil|temperature|lst|cover/.test(q) ? topicHit : null;
    if (/what can|which variable|options|what data|variables/.test(q)) { const l = call('list_variables', {}); parts.push(`I can investigate ${l.length} indicators for 2001-2025: ${l.map(x => x.name).join(', ')}. Pick one, or ask about floods, heat, snow or soil.`); }
    else if (place) { const s = call('investigate_place', { place: place.name }); action.place = place.name; if (s.inside_basin) { const top = s.trends.slice(0, 3); parts.push(`At ${place.name}, the strongest local changes on the 2001-2025 trend maps are: ${top.map(x => `${x.name} (${x.direction}, ${fmt(x.local_sen_slope_per_year)} ${x.unit})`).join('; ')}.`, 'These are local rates of change, not significance tests; ask about a region to see whether the trend is significant.'); action.variable = top[0].variable; } else parts.push(s.note); }
    else if (wantsCompare) { const cmp = /punjab|sindh/.test(q) ? 'Punjab vs Sindh' : /elevation|high|low/.test(q) ? 'High vs Low Elevation' : 'Upper vs Lower Indus'; const c = call('compare_regions', { comparison: cmp, variable }); if (c.error) parts.push(c.error); else { const [a, b] = D.comparisons.find(x => x.id === cmp).regions; parts.push(`${c.name}: ${a} is ${c[a].sen_slope_per_year > 0 ? 'rising' : 'falling'} (${fmt(c[a].sen_slope_per_year)} ${c.trend_unit}, p ${pEq(c[a].p_value)}) while ${b} is ${c[b].sen_slope_per_year > 0 ? 'rising' : 'falling'} (${fmt(c[b].sen_slope_per_year)} ${c.trend_unit}, p ${pEq(c[b].p_value)}).`, `The difference between them ${c.difference_trend.significant_after_fdr ? 'IS' : 'is NOT'} significant after FDR correction (q ${pEq(c.difference_trend.fdr_q)}).`); action.comparison = cmp; } }
    else if (broadTopic && !year) {
      region = region || (/indus|basin|pakistan/.test(q) ? 'Indus Basin' : state.region || 'Indus Basin');
      const relevant = r => recommend({ topic: broadTopic, region: r }).filter(x => (TOPIC_VARS[broadTopic] || {})[x.variable]);
      if (!relevant(region).some(x => (TOPIC_VARS[broadTopic][x.variable] || 0) >= 3)) { parts.push(`The main ${broadTopic} indicators were not analysed for ${region}, so I am using the whole Indus Basin instead.`); region = 'Indus Basin'; }
      const rec = call('recommend_variables', { topic: broadTopic, region }), top = relevant(region).slice(0, 3);
      parts.push(`For a question about ${broadTopic === 'water' ? 'water in soil and rivers' : broadTopic} in ${region} (${rec.region_traits.join(', ')}), I ranked the clues and tested the top ${top.length}:`);
      const lines = top.map(r => { const t = call('get_trend', { region, variable: r.variable }), o = t.official_result; return `• ${t.name}: ${o.sen_slope_per_year > 0 ? 'rising' : 'falling'} ${fmt(Math.abs(o.sen_slope_per_year * 10))} ${t.trend_unit.replace('/year', '')} per decade, p ${pEq(o.p_value)}, ${o.significant_05 ? 'significant' : 'not yet significant'} (${t.type}, ${t.source}).`; });
      parts.push(lines.join('\n'));
      const sigN = top.filter(r => official(region, r.variable).significant).length;
      parts.push(`${sigN} of ${top.length} clues show a statistically significant trend over 2001-2025. ${sigN < top.length ? 'Not significant does not mean no change: the record may simply be too short. ' : ''}Caution: ${varById(top[0].variable).caution}`);
      action = { variable: top[0].variable, region };
    }
    else { region = region || state.region || 'Indus Basin'; if (!seriesOf(region, variable)) region = 'Indus Basin'; call('get_trend', { region, variable }); const vd = verdict(region, variable, level); parts.push(`${vd.headline}. ${vd.text}`); if (year) { const a = call('get_year_anomaly', { region, variable, year: +year }); if (!a.error) parts.push(`${year} was ${fmt(Math.abs(a.percent_anomaly))}% ${a.anomaly > 0 ? 'above' : 'below'} the 2001-2025 mean (rank ${a.rank_highest_first} of ${a.of_years}). One extreme year is not a trend.`); } parts.push(`Caution: ${vd.caution}`); action.region = region; }
    steps.push({ name: 'show_in_app', input: action, output: { ok: true } });
    return { text: parts.join('\n\n'), steps, actions: [action], mode: 'offline' };
  }

  return { init, trendTest, mannKendall, senSlope, ols, recommend, potential, sampleAt, findPlace, runTool, TOOLS, verdict, offlineDetective, official, officialDiff, seriesOf, varById, comparisonOf, matchRegion, matchVariable, regions, fmt, fmtP, pEq, TRAITS, get data() { return D; }, get grids() { return G; } };
});
