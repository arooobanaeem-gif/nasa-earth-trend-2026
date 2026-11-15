// Reader modes (Student / Curious citizen / Scientist), guided questions, variable search and the tool tour.
// SI-assisted code (Claude). Loaded before app.js; uses its globals at call time.
/* global TD, S, D, $, el, esc, setState, renderAll, renderBoard, renderChart, renderVerdict, showPlace, openChat, ask, go, map */
const Modes = (() => {
  const TOPIC_TILES = [['floods', '🌧️', 'Floods & heavy rain', 'Downpours, runoff, wet soil'], ['heat', '🌡️', 'Heat', 'Temperature of the land surface'], ['snow', '❄️', 'Snow & ice', 'Snow cover and water stored in snow'], ['water', '💧', 'Water in soil & rivers', 'Soil moisture and runoff'], ['any', '🎲', 'Surprise me', 'Whatever is changing the most']];
  const REGION_TILES = { 'Indus Basin': ['🗺️', 'The whole river basin'], 'Upper Indus': ['⛰️', 'Mountain headwaters above Chashma Barrage'], 'Lower Indus': ['🌾', 'The plains below Chashma Barrage'], 'Punjab': ['🌾', 'Province: irrigated plains'], 'Sindh': ['🏜️', 'Province: the lower floodplain'], 'High Elevation': ['🏔️', 'The high mountain zone'], 'Low Elevation': ['🏞️', 'The lowland zone'] };
  const START_TILES = [[2001, '📅', 'All 25 years', '2001–2025: the full record'], [2006, '📅', 'Last 20 years', '2006–2025'], [2011, '📅', 'Last 15 years', '2011–2025'], [2016, '📅', 'Last 10 years', '2016–2025: short records rarely prove a trend']];
  const SYN = [[/rain|precip|monsoon|wet/, ['precipitation_mm', 'rx1day_mm'], 'floods'], [/extreme|cloudburst|downpour|storm|heav|flash/, ['rx1day_mm'], 'floods'], [/flood|river|runoff|flow|discharge/, ['total_runoff_mm', 'surface_runoff_mm', 'subsurface_runoff_mm', 'rx1day_mm'], 'floods'], [/drought|dry|soil|moist|crop|farm|agri/, ['soil_0_10', 'soil_10_40', 'soil_40_100', 'soil_100_200'], 'water'], [/ground|deep|aquifer|water/, ['subsurface_runoff_mm', 'soil_100_200', 'total_runoff_mm'], 'water'], [/snow|ice|glacier|melt|cryo/, ['snow_index', 'swe_mm'], 'snow'], [/heat|hot|warm|temperat|cool/, ['lst_c'], 'heat']];
  const { fmt, fmtP, pEq } = TD;
  let step = 0; const revealed = {}; const score = { guess: 0, quiz: 0 }; let quiz = null, qi = 0, answered = null, guess = {};

  // ---------------------------------------------------------------- variable search
  function searchIds(q) {
    q = String(q || '').toLowerCase().trim(); if (!q) return null; const ids = new Set();
    SYN.forEach(([re, list]) => { if (re.test(q)) list.forEach(i => ids.add(i)); });
    D.variables.forEach(v => { if (`${v.display_name} ${v.definition} ${v.dataset} ${v.group}`.toLowerCase().includes(q)) ids.add(v.id); });
    return [...ids];
  }
  const topicOf = q => { const hit = SYN.find(([re]) => re.test(String(q).toLowerCase())); return hit ? hit[2] : 'any'; };

  // ---------------------------------------------------------------- guided questions (one at a time)
  function tiles(items, attr) { return `<div class="tiles">${items.map(([val, ic, t, d, on], i) => `<button type="button" class="tile t${i}${on ? ' on' : ''}" data-${attr}="${esc(val)}"><span class="ic">${ic}</span><b>${esc(t)}</b><small>${esc(d)}</small></button>`).join('')}</div>`; }
  function renderWizard() {
    const h = $('#wizard'); if (!h) return; const labels = ['What?', 'Where?', 'How far back?', 'Your clues'];
    let html = `<div class="wz-steps">${labels.map((l, i) => `<span class="${i === step ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${l}</span>`).join('')}</div>`;
    if (step === 0) html += `<h3>Question 1 of 3: what are you curious about?</h3>${tiles(TOPIC_TILES.map(t => [...t, false]), 'topic')}<div class="row"><span class="note">or say it in your own words:</span><input id="wzText" placeholder="e.g. drought, glacier melt, cloudburst"><button class="btn sm" id="wzGo" type="button">Find</button></div>`;
    else if (step === 1) html += `<h3>Question 2 of 3: where do you want to investigate?</h3>${tiles(TD.regions().map(r => [r, REGION_TILES[r][0], r, REGION_TILES[r][1], false]), 'region')}<div class="row"><span class="note">or start from a place:</span><select id="wzPlace"><option value="">choose a town, dam or barrage…</option>${D.places.map(p => `<option>${esc(p.name)}</option>`).join('')}</select></div>`;
    else if (step === 2) html += `<h3>Question 3 of 3: how far back should we look?</h3>${tiles(START_TILES.map(t => [...t, false]), 'start')}<p class="note">Longer records make it easier to tell a real trend from natural ups and downs.</p>`;
    else html += `<div class="wz-done"><span><b>Your case:</b> ${esc(S.search ? `“${S.search}”` : TOPIC_TILES.find(t => t[0] === S.topic)[2])} · ${esc(S.region)} · ${S.startYear}–2025</span><span class="note">The matching data variables are ranked below.</span><button class="btn alt sm" id="wzRestart" type="button">Start over</button></div>`;
    if (step > 0 && step < 3) html += `<button class="btn alt sm" id="wzBack" type="button" style="margin-top:8px">‹ Back</button>`;
    h.innerHTML = html;
    h.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => { S.topic = b.dataset.topic; S.search = ''; $('#varSearch').value = ''; step = 1; renderAll(); });
    h.querySelectorAll('[data-region]').forEach(b => b.onclick = () => { step = 2; setState({ region: b.dataset.region }); });
    h.querySelectorAll('[data-start]').forEach(b => b.onclick = () => finish(+b.dataset.start));
    const t = $('#wzText'); if (t) { const goText = () => { const q = t.value.trim(); if (!q) return; S.search = q; $('#varSearch').value = q; S.topic = topicOf(q); step = 1; renderAll(); }; $('#wzGo').onclick = goText; t.onkeydown = e => { if (e.key === 'Enter') goText(); }; }
    const p = $('#wzPlace'); if (p) p.onchange = () => { if (!p.value) return; step = 2; S.place = p.value; setState({ region: 'Indus Basin' }); };
    const b = $('#wzBack'); if (b) b.onclick = () => { step--; renderWizard(); };
    const r = $('#wzRestart'); if (r) r.onclick = () => { step = 0; S.search = ''; S.place = null; $('#varSearch').value = ''; renderAll(); };
  }
  function finish(start) {
    step = 3; S.startYear = start; const hit = searchIds(S.search), ranked = TD.recommend({ topic: S.topic, region: S.region }).filter(r => !hit || hit.includes(r.variable));
    if (ranked.length) S.variable = ranked[0].variable; renderAll(); go('#boardTitle'); if (S.place) setTimeout(() => showPlace(S.place), 600);
  }

  // ---------------------------------------------------------------- student: guess before you peek
  const key = () => `${S.variable}|${S.region}`;
  const needsGuess = () => S.level === 'student' && S.startYear === 2001 && !revealed[key()];
  function renderGuess(box) {
    const v = TD.varById(S.variable), o = TD.official(S.region, S.variable); guess = {};
    box.className = 'vd guess';
    box.innerHTML = `<div class="kicker">Detective challenge</div><h3>Look at the dots. What do you think is happening to ${esc(v.display_name.toLowerCase())}?</h3><div><div class="gq">1. Which way is it going?</div><div class="opts" data-g="dir"><button class="opt" data-v="up">⬆️ Going up</button><button class="opt" data-v="down">⬇️ Going down</button></div></div><div><div class="gq">2. Is the trend proven, or could it be luck?</div><div class="opts" data-g="sig"><button class="opt" data-v="yes">✅ Proven</button><button class="opt" data-v="no">🤔 Not proven yet</button></div></div><p class="note">Pick both answers to reveal the trend line and the verdict.</p>`;
    box.querySelectorAll('.opts').forEach(g => g.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      guess[g.dataset.g] = b.dataset.v; g.querySelectorAll('.opt').forEach(x => x.classList.toggle('right', x === b));
      if (guess.dir && guess.sig) { const ok1 = (guess.dir === 'up') === (o.sen_slope_per_year > 0), ok2 = (guess.sig === 'yes') === o.significant, pts = ok1 + ok2; score.guess += pts; revealed[key()] = { pts }; setTimeout(() => { renderChart(); renderVerdict(); renderPanel(); }, 350); }
    }));
  }
  const guessBanner = () => { const r = revealed[key()]; return S.level === 'student' && r ? `<div class="explain" style="margin:0 0 10px">${r.pts === 2 ? '🎉 Both right! +2 points.' : r.pts === 1 ? '👍 One right! +1 point.' : '🕵️ Not this time. Even detectives get surprised by data.'} You have <b>${score.guess + score.quiz}</b> detective points.</div>` : ''; };

  // ---------------------------------------------------------------- student: quiz
  function buildQuiz() {
    const o = (r, v) => TD.official(r, v), name = v => TD.varById(v).display_name, s = TD.seriesOf('Sindh', 'precipitation_mm');
    const wet = 2001 + s.indexOf(Math.max(...s)), yrs = [...new Set([wet, 2010, 2015, 2020, 2022])].slice(0, 4).sort();
    const rx = o('Indus Basin', 'rx1day_mm'), sn = o('Upper Indus', 'snow_index'), up = o('Upper Indus', 'total_runoff_mm'), lo = o('Lower Indus', 'total_runoff_mm');
    const an = TD.runTool('get_year_anomaly', { region: 'Sindh', variable: 'precipitation_mm', year: 2022 }), sh = TD.runTool('test_period', { region: 'Sindh', variable: 'precipitation_mm', start_year: 2011, end_year: 2025 });
    const sat = D.variables.find(v => v.id === 'rx1day_mm'), models = D.variables.filter(v => v.kind === 'model' && ['total_runoff_mm', 'soil_0_10', 'swe_mm'].includes(v.id));
    return [
      { q: 'Which year had the wettest monsoon in Sindh?', options: yrs.map(String), a: yrs.indexOf(wet), why: `${wet} was the wettest of all 25 monsoons in Sindh: ${fmt(an.percent_anomaly)}% above average.`, show: { region: 'Sindh', variable: 'precipitation_mm' } },
      { q: 'Does one extreme year, like 2022, prove a long-term trend?', options: ['Yes', 'No'], a: 1, why: 'No. A trend is about all the years together. One wild year can happen by chance, so detectives test the whole record.', show: { region: 'Sindh', variable: 'precipitation_mm' } },
      { q: `The test for the wettest monsoon day over the whole basin gives p ${pEq(rx.p_value)}. Is the trend proven?`, options: ['Yes, proven', 'Not yet'], a: rx.significant ? 0 : 1, why: `A trend counts as proven when p is below 0.05. Here p ${pEq(rx.p_value)}, so it is ${rx.significant ? 'proven' : 'close, but not proven yet'}.`, show: { region: 'Indus Basin', variable: 'rx1day_mm' } },
      { q: 'In the mountains of the Upper Indus, which way is the snow-cover index going?', options: ['Going up', 'Going down'], a: sn.sen_slope_per_year > 0 ? 0 : 1, why: `It is going ${sn.sen_slope_per_year > 0 ? 'up' : 'down'}, but p ${pEq(sn.p_value)}, so the trend is ${sn.significant ? 'proven' : 'not proven yet'}.`, show: { region: 'Upper Indus', variable: 'snow_index' } },
      { q: 'Where is the modelled runoff rising faster?', options: ['Mountains (Upper Indus)', 'Plains (Lower Indus)'], a: lo.sen_slope_per_year > up.sen_slope_per_year ? 1 : 0, why: `Upper Indus: ${fmt(up.sen_slope_per_year * 10)} mm per decade. Lower Indus: ${fmt(lo.sen_slope_per_year * 10)} mm per decade.`, show: { region: 'Upper Indus', variable: 'total_runoff_mm', comparison: 'Upper vs Lower Indus' } },
      { q: 'Which of these is seen directly from a satellite, not estimated by a computer model?', options: [sat, ...models].map(v => v.display_name), a: 0, why: `${sat.display_name} comes from ${sat.dataset} satellite measurements. Runoff, soil moisture and snow water come from the FLDAS computer model.`, show: { region: 'Indus Basin', variable: 'rx1day_mm' } },
      { q: `Sindh's rain trend is proven with 25 years of data. If satellites had only started in 2011, would it still be proven?`, options: ['Yes', 'No'], a: sh.significant_05 ? 0 : 1, why: `With only 15 years, p ${pEq(sh.p_mk_lag1_adjusted)}: ${sh.significant_05 ? 'still proven' : 'not proven'}. Longer records make trends easier to prove.`, show: { region: 'Sindh', variable: 'precipitation_mm' } },
    ];
  }
  const rankName = n => (n >= 12 ? 'Chief Detective 🏆' : n >= 7 ? 'Senior Investigator 🕵️' : n >= 3 ? 'Junior Detective 🔎' : 'Rookie 🐣');
  function studentPanel(h) {
    quiz = quiz || buildQuiz(); const total = score.guess + score.quiz;
    let html = `<div class="kicker">Detective training</div><h2>Trend quiz: can you crack ${quiz.length} cases?</h2><div class="rank"><b>${rankName(total)}</b><span class="pips">${quiz.map((_, i) => `<i class="${i < score.quiz ? 'on' : ''}"></i>`).join('')}</span><span class="note">${total} points (quiz + guessing game)</span></div>`;
    if (qi >= quiz.length) html += `<div class="explain"><b>Case closed!</b> You answered ${score.quiz} of ${quiz.length} correctly. Your rank: ${rankName(total)}.</div><button class="btn" id="qzAgain" style="margin-top:10px">Play again</button>`;
    else { const Q = quiz[qi]; html += `<div class="quiz"><div class="qtext">${qi + 1}. ${esc(Q.q)}</div><div class="opts">${Q.options.map((t, i) => `<button class="opt${answered != null ? (i === Q.a ? ' right' : i === answered ? ' wrong' : '') : ''}" data-i="${i}" ${answered != null ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>${answered != null ? `<div class="explain">${answered === Q.a ? '✅ Correct! ' : '❌ Not quite. '}${esc(Q.why)}</div><div class="row" style="margin-top:10px"><button class="btn alt" id="qzShow">Show me the evidence</button><button class="btn" id="qzNext">${qi + 1 < quiz.length ? 'Next question ›' : 'See my result'}</button></div>` : ''}</div>`; }
    h.innerHTML = html;
    h.querySelectorAll('.opt').forEach(b => b.onclick = () => { answered = +b.dataset.i; if (answered === quiz[qi].a) score.quiz++; studentPanel(h); });
    const nx = $('#qzNext'); if (nx) nx.onclick = () => { qi++; answered = null; studentPanel(h); };
    const sh = $('#qzShow'); if (sh) sh.onclick = () => { const k = quiz[qi].show; revealed[`${k.variable}|${k.region}`] = revealed[`${k.variable}|${k.region}`] || { pts: 0 }; setState(k, { scroll: k.comparison ? '#compare' : '#investigation' }); };
    const ag = $('#qzAgain'); if (ag) ag.onclick = () => { qi = 0; answered = null; score.quiz = 0; studentPanel(h); };
  }

  // ---------------------------------------------------------------- curious citizen: the case in plain words
  function summaryParts() {
    const v = TD.varById(S.variable), o = TD.official(S.region, S.variable), t = TD.trendTest(D.years, TD.seriesOf(S.region, S.variable)), vd = TD.verdict(S.region, S.variable, 'public', t), unit = v.trend_unit.replace('/year', '');
    return {
      looked: `${v.display_name} in ${S.region}, ${v.season}, 2001–2025. ${v.definition} Source: ${v.dataset} (${v.kind === 'model' ? 'a model estimate' : 'satellite observations'}).`,
      found: `It is ${o.sen_slope_per_year > 0 ? 'rising' : 'falling'} by about ${fmt(Math.abs(o.sen_slope_per_year * 10))} ${unit} per decade.`,
      sure: o.significant ? `The trend is proven: the test gives p ${pEq(o.p_value)}, below the usual bar of 0.05, so scientists treat it as a real trend rather than chance.` : `Not proven yet: the test gives p ${pEq(o.p_value)}, above the usual bar of 0.05, so it could still be natural ups and downs.${t.more_years_needed ? ` About ${t.more_years_needed} more years of data may be needed.` : ''} That is not the same as "no change".`,
      not: `${v.caution} This describes the background trend. It cannot predict a particular flood or say what caused one.`, vd,
    };
  }
  function publicPanel(h) {
    const p = summaryParts();
    h.innerHTML = `<div class="kicker">For the curious citizen</div><h2>Your case in plain words</h2><div class="plain"><div><small>What we looked at</small>${esc(p.looked)}</div><div><small>What we found</small>${esc(p.found)}</div><div><small>How sure are we?</small>${esc(p.sure)}</div><div><small>What this does not tell us</small>${esc(p.not)}</div></div><div class="row"><button class="btn" id="cpCopy">Copy this summary</button><button class="btn alt" id="cpAsk">Ask the detective to explain</button><span class="note">Check your own area:</span><select id="cpPlace"><option value="">choose a town, dam or barrage…</option>${D.places.map(x => `<option>${esc(x.name)}</option>`).join('')}</select></div><div id="cpLocal" style="margin-top:10px"></div>`;
    $('#cpCopy').onclick = () => { const txt = `Indus Trend Detective case summary\nWhat we looked at: ${p.looked}\nWhat we found: ${p.found}\nHow sure are we: ${p.sure}\nWhat this does not tell us: ${p.not}`; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => { $('#cpCopy').textContent = 'Copied ✓'; }).catch(() => { $('#cpCopy').textContent = 'Copy not available'; }); };
    $('#cpAsk').onclick = () => { openChat(); ask(`Explain what is happening to ${TD.varById(S.variable).display_name} in ${S.region} and why it matters.`); };
    $('#cpPlace').onchange = e => { const pl = TD.findPlace(e.target.value); if (!pl) return; const r = TD.sampleAt(pl.lat, pl.lon); showPlace(pl.name); $('#cpLocal').innerHTML = r.inside_basin ? `<b>Around ${esc(pl.name)}</b>, the trend maps show these local changes (rate of change only, not a significance test):<ul style="margin:6px 0">${r.trends.slice(0, 5).map(t => `<li>${t.direction === 'increasing' ? '▲' : '▼'} ${esc(t.name)}: ${t.local_sen_slope_per_year > 0 ? '+' : ''}${fmt(t.local_sen_slope_per_year)} ${esc(t.unit)}</li>`).join('')}</ul>` : `<span class="note">${esc(pl.name)} is outside the trend maps.</span>`; };
  }

  // ---------------------------------------------------------------- scientist: full statistics + downloads
  const csv = rows => rows.map(r => r.map(c => { const s = c == null ? '' : String(c); return s.includes(',') || s.includes('"') ? '"' + s.split('"').join('""') + '"' : s; }).join(',')).join('\n');
  function download(name, text) { const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/csv' })), download: name }); document.body.appendChild(a); a.click(); a.remove(); }
  function scientistPanel(h) {
    const vars = D.variables.filter(v => TD.seriesOf(S.region, v.id)), c = D.comparisons.find(x => x.id === S.comparison);
    const rows = vars.map(v => { const o = TD.official(S.region, v.id), t = TD.trendTest(D.years, TD.seriesOf(S.region, v.id)); return { v, o, t }; });
    const diffs = D.variables.map(v => ({ v, d: TD.officialDiff(c.id, v.id) })).filter(x => x.d);
    h.innerHTML = `<div class="kicker">For the scientist</div><h2>Full statistics: ${esc(S.region)}, 2001–2025</h2><p class="note">Sen's slope, CI, τ and p are the validated results (master table). OLS, t-test, lag-1 r and years-to-detect are recalculated in the browser. Click a row to open that indicator.</p><div class="scroll"><table class="sci"><thead><tr><th>Indicator</th><th>Sen slope / yr</th><th>95% CI</th><th>Kendall τ</th><th>p</th><th>Test</th><th>Sig.</th><th>OLS slope / yr</th><th>t-test p</th><th>lag-1 r</th><th>Yrs to detect</th></tr></thead><tbody>${rows.map(({ v, o, t }) => `<tr data-v="${v.id}"><td>${esc(v.display_name)} <span class="tag">${esc(v.trend_unit)}</span></td><td>${fmt(o.sen_slope_per_year)}</td><td>${o.ci_lower != null ? `${fmt(o.ci_lower)} to ${fmt(o.ci_upper)}` : 'n/a'}</td><td>${fmt(o.kendall_tau, 2)}</td><td>${fmtP(o.p_value)}</td><td>${o.p_value_method.startsWith('Yue') ? 'MK (Yue-Wang)' : 'MK'}</td><td>${o.significant ? 'yes' : 'no'}</td><td>${fmt(t.ols_slope_per_year)}</td><td>${fmtP(t.p_ttest)}</td><td>${fmt(t.lag1_autocorrelation, 2)}</td><td>${t.years_to_detect || 'n/a'}</td></tr>`).join('')}</tbody></table></div><h3 style="margin-top:16px">Difference trends: ${esc(c.id)} (Benjamini-Hochberg FDR)</h3><div class="scroll"><table class="sci"><thead><tr><th>Indicator</th><th>Difference</th><th>Sen slope / yr</th><th>p</th><th>FDR q</th><th>Sig. after FDR</th></tr></thead><tbody>${diffs.map(({ v, d }) => `<tr data-v="${v.id}"><td>${esc(v.display_name)}</td><td>${esc(d.difference_definition || '')}</td><td>${fmt(d.sen_slope_per_year)}</td><td>${fmtP(d.p_value)}</td><td>${fmtP(d.fdr_q)}</td><td>${d.significant ? 'yes' : 'no'}</td></tr>`).join('')}</tbody></table></div><div class="row" style="margin-top:12px"><button class="btn" id="dlSeries">Download yearly series (CSV)</button><button class="btn alt" id="dlTrends">Download trend results (CSV)</button></div>`;
    h.querySelectorAll('tr[data-v]').forEach(tr => tr.onclick = () => setState({ variable: tr.dataset.v }, { scroll: '#investigation' }));
    $('#dlSeries').onclick = () => download(`indus_${S.region.replace(/ /g, '_').toLowerCase()}_series_2001_2025.csv`, csv([['year', ...vars.map(v => `${v.id} (${v.unit})`)], ...D.years.map((y, i) => [y, ...vars.map(v => TD.seriesOf(S.region, v.id)[i])])]));
    $('#dlTrends').onclick = () => download('indus_trend_results.csv', csv([['comparison', 'result_type', 'region', 'variable', 'unit', 'sen_slope_per_year', 'ci_lower', 'ci_upper', 'kendall_tau', 'p_value', 'p_value_method', 'fdr_q', 'significant_05'], ...D.results.map(r => [r.comparison, r.result_type, r.region, r.variable, r.unit, r.sen_slope_per_year, r.ci_lower, r.ci_upper, r.kendall_tau, r.p_value, r.p_value_method, r.fdr_q, r.significant])]));
  }
  function renderPanel() { const h = $('#levelPanel'); if (!h) return; if (S.level === 'student') studentPanel(h); else if (S.level === 'scientist') scientistPanel(h); else publicPanel(h); }

  // ---------------------------------------------------------------- tour: how the tool works
  function tour() {
    return { title: 'How this tool works', sub: 'A one-minute tour: from a question to a verdict', tour: true, steps: [
      [() => { step = 0; S.search = ''; renderAll(); go('#interview'); }, 'Every case starts with three short questions. Question 1: what are you curious about? You can pick a tile or type it in your own words.'],
      [() => { S.topic = 'floods'; step = 1; renderAll(); }, 'We pick "Floods & heavy rain". Question 2: where? Choose the whole basin, a region, or a town.'],
      [() => { step = 2; setState({ region: 'Sindh' }); }, 'We pick Sindh. Question 3: how far back? Longer records make trends easier to prove.'],
      [() => { finish(2001); }, 'Your answers search the data. The matching variables are ranked, each with a plain definition and a quick result: proven trend, possible trend, or no clear trend yet.'],
      [() => { revealed[key()] = revealed[key()] || { pts: 0 }; renderAll(); go('#investigation'); }, 'Click a variable to investigate it. Each dot is one monsoon season, and the dashed line is the trend.'],
      [() => {}, 'The verdict tells you how fast it is changing and whether the trend is proven. The meter shows how strong the evidence is compared with the proof line.'],
      [() => { map.flyTo([27.5, 69], 6); }, 'The map shows where the change is strongest. Click any spot, or a town, to read the local values.'],
      [() => { go('#levelPanel'); }, 'Students get a quiz, citizens get a plain-words summary, and scientists get the full statistics. Switch at the top. Now open your own case!'],
    ] };
  }

  // ---------------------------------------------------------------- landing: the basin and the river, drawn from the data
  function landing(basin) {
    const svg = $('#riverArt'); if (!svg) return;
    const W = 520, H = 480, pad = 14, box = [66, 23.8, 82.7, 37.3];
    const px = ([lon, lat]) => [pad + (lon - box[0]) / (box[2] - box[0]) * (W - 2 * pad), pad + (box[3] - lat) / (box[3] - box[1]) * (H - 2 * pad)];
    const d = pts => pts.map((p, i) => (i ? 'L' : 'M') + px(p).map(n => n.toFixed(1)).join(' ')).join('') ;
    let html = '';
    const g = basin && basin.outline && basin.outline.geometry;
    if (g) { const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : (g.geometries || []).flatMap(x => (x.type === 'Polygon' ? [x.coordinates] : x.coordinates)); const ring = polys.map(p => p[0]).sort((a, b) => b.length - a.length)[0]; if (ring) html += `<path class="basin" pathLength="1" d="${d(ring)}Z"/>`; }
    // schematic course of the Indus main stem, joined through places along the river
    const stem = ['Leh', 'Skardu', 'Tarbela Dam', 'Chashma Barrage', 'Dera Ghazi Khan', 'Guddu Barrage', 'Sukkur', 'Dadu', 'Kotri Barrage', 'Thatta'].map(n => D.places.find(p => p.name === n)).filter(Boolean).map(p => [p.lon, p.lat]);
    if (stem.length > 3) { const pts = stem.map(px); let c = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; c += ` Q${a[0].toFixed(1)} ${a[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; } c += ` L${pts[pts.length - 1][0].toFixed(1)} ${pts[pts.length - 1][1].toFixed(1)}`; html += `<path class="river" pathLength="1" d="${c}"/><path class="flow" d="${c}"/>`; }
    const labelled = ['Gilgit', 'Islamabad', 'Lahore', 'Multan', 'Sukkur', 'Hyderabad'];
    D.places.forEach((p, i) => { const [x, y] = px([p.lon, p.lat]), big = labelled.includes(p.name); html += `<g class="town" style="animation-delay:${(3.4 + i * 0.07).toFixed(2)}s"><circle class="ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" style="animation-delay:${(i * 0.37 % 2.8).toFixed(2)}s"/><circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${big ? 3.4 : 2.2}"/>${big ? `<text x="${(x + 8).toFixed(1)}" y="${(y + 4).toFixed(1)}">${esc(p.name)}</text>` : ''}</g>`; });
    svg.innerHTML = html;
    // count-up facts
    document.querySelectorAll('.facts b[data-count]').forEach(b => { const n = +b.dataset.count, t0 = performance.now() + 900; const tick = t => { const k = Math.max(0, Math.min(1, (t - t0) / 1100)); b.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    // reveal sections as they scroll into view
    const secs = document.querySelectorAll('main > section');
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.06 }); secs.forEach(s => { s.classList.add('reveal'); io.observe(s); }); }
  }

  // ---------------------------------------------------------------- download the current trend map as a labelled PNG
  let BASIN = null;
  function downloadMap() {
    const lay = D.layers[S.variable], v = TD.varById(S.variable); if (!lay) return;
    const img = new Image(); img.onload = () => {
      const W = 1400, m = 50, top = 110, mapW = W - 2 * m, [[s, w], [n, e]] = lay.bounds, mapH = Math.round(mapW * ((n - s) / ((e - w) * Math.cos((n + s) / 2 * Math.PI / 180)))), H = top + mapH + 150;
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H); x.fillStyle = '#eef4f8'; x.fillRect(m, top, mapW, mapH);
      x.imageSmoothingEnabled = false; x.drawImage(img, m, top, mapW, mapH);
      const px = ([lon, lat]) => [m + (lon - w) / (e - w) * mapW, top + (n - lat) / (n - s) * mapH];
      const g = BASIN && BASIN.outline && BASIN.outline.geometry;
      if (g) { const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : (g.geometries || []).flatMap(q => (q.type === 'Polygon' ? [q.coordinates] : q.coordinates)); x.strokeStyle = '#12263a'; x.lineWidth = 2; polys.forEach(p => { x.beginPath(); p[0].forEach((pt, i) => { const [a, b] = px(pt); if (i) x.lineTo(a, b); else x.moveTo(a, b); }); x.closePath(); x.stroke(); }); }
      x.fillStyle = '#12263a'; x.font = '600 34px Georgia, serif'; x.fillText(`${v.display_name}: trend 2001–2025`, m, 52);
      x.font = '20px Segoe UI, sans-serif'; x.fillStyle = '#40546a'; x.fillText(`Indus Basin · ${v.season} · Sen's slope per pixel (${v.trend_unit}) · ${v.dataset}`, m, 86);
      const ly = top + mapH + 34, lw = 420, grad = x.createLinearGradient(m, 0, m + lw, 0), ramp = lay.ramp === 'heat' ? ['#2166ac', '#92c5de', '#f5f5f0', '#ef8a62', '#b2182b'] : ['#8c510a', '#d8b365', '#f5f5f0', '#5ab4ac', '#01665e'];
      ramp.forEach((col, i) => grad.addColorStop(i / (ramp.length - 1), col)); x.fillStyle = grad; x.fillRect(m, ly, lw, 20); x.strokeStyle = '#a9b6c2'; x.lineWidth = 1; x.strokeRect(m, ly, lw, 20);
      x.fillStyle = '#12263a'; x.font = '18px Segoe UI, sans-serif'; x.fillText(`−${fmt(lay.scale)}`, m, ly + 44); x.textAlign = 'center'; x.fillText('0', m + lw / 2, ly + 44); x.textAlign = 'right'; x.fillText(`+${fmt(lay.scale)} ${v.trend_unit}`, m + lw, ly + 44); x.textAlign = 'left';
      x.fillStyle = '#40546a'; x.fillText(lay.ramp === 'heat' ? 'blue = cooling, red = warming' : 'brown = decreasing, green = increasing', m + lw + 30, ly + 16);
      x.font = '16px Segoe UI, sans-serif'; x.fillText('Colours show the rate of change, not statistical significance. ' + v.caution, m, ly + 78);
      x.fillText('Indus Trend Detective · NASA Space Apps 2026 · basin boundary: HydroBASINS (WWF/HydroSHEDS)', m, ly + 102);
      c.toBlob(b => { const a = el('a', { href: URL.createObjectURL(b), download: `indus_trend_map_${S.variable}_2001_2025.png` }); document.body.appendChild(a); a.click(); a.remove(); }, 'image/png');
    }; img.src = lay.png;
  }

  function init(basin) { BASIN = basin; const dl = $('#dlMap'); if (dl) dl.onclick = downloadMap; S.search = ''; S.place = null; const s = $('#varSearch'); if (s) s.oninput = () => { S.search = s.value; renderBoard(); }; landing(basin); }
  function render() { renderWizard(); renderPanel(); }
  const reveal = (region, variable) => { const k = `${variable}|${region}`; revealed[k] = revealed[k] || { pts: 0 }; };
  return { init, render, renderWizard, searchIds, needsGuess, renderGuess, guessBanner, tour, renderPanel, reveal };
})();
