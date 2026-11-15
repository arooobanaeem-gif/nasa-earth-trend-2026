// Free local AI path for the Trend Detective, using Ollama (no API key, no cost).
// SI-assisted code (Claude).
// Pipeline, built for THIS app rather than a generic chatbot:
//   1. ROUTER  - the local LLM turns the question into a structured plan (intent, indicators, region, year, place).
//   2. TOOLS   - the plan is executed by the app's own trend tools (shared.js). The LLM never computes a number.
//   3. WRITER  - the LLM writes the answer from the tool FACTS only, in the reader's level.
//   4. GUARD   - every number in the draft is checked against the tool results; a draft that fails is replaced
//                by the verified rule-based summary.
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

async function available() {
  try { const r = await fetch(OLLAMA + '/api/tags', { signal: AbortSignal.timeout(1500) }); const j = await r.json(); return (j.models || []).some(m => String(m.name).startsWith(MODEL)); } catch { return false; }
}
async function chat(messages, { json = false, max = 320, timeout = 120000 } = {}) {
  const body = { model: MODEL, messages, stream: false, keep_alive: '30m', options: { temperature: json ? 0 : 0.2, num_predict: max, num_ctx: 4096 } };
  if (json) body.format = 'json';
  const r = await fetch(OLLAMA + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  if (!r.ok) throw new Error('ollama ' + r.status);
  return (await r.json()).message.content;
}

function routerPrompt(TD) {
  const D = TD.data;
  return `You are the question router of the "Indus Trend Detective" web app (NASA Space Apps 2026). The app studies the Indus River Basin flood season, 2001-2025. Read the user's question and reply with ONE JSON object and nothing else.

Indicators (use the id):
${D.variables.map(v => `- ${v.id}: ${v.display_name}. ${v.definition}`).join('\n')}

Regions: ${TD.regions().join(', ')}.
Comparisons: Upper vs Lower Indus, Punjab vs Sindh, High vs Low Elevation.
Known places: ${D.places.map(p => p.name).join(', ')}.

JSON fields:
- "intent": one of "trend" (is something changing), "broad_topic" (general worry such as floods, heat, snow, drought with no specific indicator), "compare" (two regions), "extreme_year" (how unusual one year was), "record_length" (what if we had fewer years), "place" (a town, dam or coordinates), "list_variables" (what can be studied), "off_topic" (not about Indus Basin climate or water data).
- "topic": "floods", "heat", "snow", "water" or "any".
- "variables": list of 0 to 3 indicator ids.
- "region": one region name, default "Indus Basin".
- "comparison": one comparison name or null.
- "year": a year 2001-2025 or null.
- "start_year": a year 2001-2020 or null.
- "place": a known place name or null.

Examples:
Q: Are Indus floods getting worse? -> {"intent":"broad_topic","topic":"floods","variables":[],"region":"Indus Basin","comparison":null,"year":null,"start_year":null,"place":null}
Q: Is it raining harder in Sindh than before? -> {"intent":"trend","topic":"floods","variables":["rx1day_mm","precipitation_mm"],"region":"Sindh","comparison":null,"year":null,"start_year":null,"place":null}
Q: Was 2010 unusual for runoff in Punjab? -> {"intent":"extreme_year","topic":"floods","variables":["total_runoff_mm"],"region":"Punjab","comparison":null,"year":2010,"start_year":null,"place":null}
Q: Do the mountains and the plains differ for snow? -> {"intent":"compare","topic":"snow","variables":["snow_index"],"region":"Upper Indus","comparison":"Upper vs Lower Indus","year":null,"start_year":null,"place":null}
Q: What is happening near Multan? -> {"intent":"place","topic":"any","variables":[],"region":"Indus Basin","comparison":null,"year":null,"start_year":null,"place":"Multan"}
Q: Who won the cricket world cup? -> {"intent":"off_topic","topic":"any","variables":[],"region":"Indus Basin","comparison":null,"year":null,"start_year":null,"place":null}`;
}

const WRITER = `You are the Indus Trend Detective, the assistant inside a NASA Space Apps 2026 web app about the Indus River Basin flood season (June to September), 2001-2025. The app tests whether Earth-system indicators show a trend and whether that trend is statistically significant.
You receive a QUESTION, a READER level and FACTS produced by the app's own trend tools. Write the answer.
Rules:
1. Use ONLY the numbers that appear in FACTS and copy them exactly. Never calculate, convert or add another number.
2. Say what is changing, where, how fast, and whether it is statistically significant.
3. If a trend is not statistically significant, never say nothing is changing. Say it is not proven yet.
4. One extreme year is not a trend.
5. FLDAS runoff, soil moisture and snow water equivalent are model estimates, and runoff is not river discharge. Land surface temperature is not air temperature. Mention the relevant caution once.
6. Never predict a flood and never blame one disaster on one cause. Never say that floods themselves are getting worse or better: the app measures indicators (rain, runoff, soil moisture, snow, temperature), so report what each indicator does.
7. Agree with FACTS. If FACTS say "statistically significant", say the trend is proven. If FACTS say "NOT statistically significant", say it is not proven yet. Report each indicator separately.
8. Never turn a p-value into a percentage or a "chance". Just say whether it is below or above 0.05, the usual bar for a proven trend.
9. FACTS contain no causes. Never explain why something is changing and never link one indicator to another.
10. At most 110 words. Plain text only: no markdown, no headings, no bullet symbols.
READER styles: "student" = simple friendly words and short sentences. "public" = plain language. "scientist" = include the test name, p-values and units.`;

// Turn tool results into plain FACT sentences so the small model never has to do arithmetic.
function facts(TD, steps) {
  const { fmt, fmtP } = TD, out = [];
  const dir = s => (s > 0 ? 'rising' : s < 0 ? 'falling' : 'flat'), dec = (s, u) => `${fmt(Math.abs(s * 10))} ${u.replace('/year', '')} per decade`;
  const sig = b => (b ? 'statistically significant' : 'NOT statistically significant (not proven yet)');
  for (const { name, input, output: o } of steps) {
    if (name === 'note') { out.push(input.text); continue; }
    if (!o || o.error) { if (o && o.error) out.push(`Tool note: ${o.error}`); continue; }
    if (name === 'get_trend') {
      const r = o.official_result, e = o.exploratory_recalculation, w = e.robustness.without_that_year;
      out.push(`${o.name} in ${o.region}, ${o.season}, 2001-2025: ${dir(r.sen_slope_per_year)} by ${dec(r.sen_slope_per_year, o.trend_unit)}; p-value ${fmtP(r.p_value)} (${r.method}); ${sig(r.significant_05)}. Source: ${o.source} (${o.type}). Robustness: most unusual year ${e.robustness.most_unusual_year}; without it p-value ${fmtP(w.p_mk)} (${w.still_significant ? 'significant' : 'not significant'}).${!r.significant_05 && e.more_years_needed ? ` About ${e.more_years_needed} more years of data may be needed to detect it.` : ''} Caution: ${o.caution}`);
    } else if (name === 'compare_regions') {
      const [a, b] = o.comparison.split(' vs ').length === 2 ? Object.keys(o).filter(k => o[k] && o[k].sen_slope_per_year !== undefined && k !== 'difference_trend') : [];
      if (a && b) out.push(`${o.name}, ${o.comparison}: ${a} is ${dir(o[a].sen_slope_per_year)} by ${dec(o[a].sen_slope_per_year, o.trend_unit)} (p-value ${fmtP(o[a].p_value)}, ${sig(o[a].significant_05)}); ${b} is ${dir(o[b].sen_slope_per_year)} by ${dec(o[b].sen_slope_per_year, o.trend_unit)} (p-value ${fmtP(o[b].p_value)}, ${sig(o[b].significant_05)}). ${o.opposite_directions ? 'They move in OPPOSITE directions.' : 'They move in the same direction at different speeds.'} The difference between the regions has FDR-adjusted q-value ${fmtP(o.difference_trend.fdr_q)}: the regional difference is ${sig(o.difference_trend.significant_after_fdr)}. Source: ${o.source} (${o.type}). Caution: ${o.caution}`);
    } else if (name === 'get_year_anomaly') {
      out.push(`In ${o.year}, ${o.name} in ${o.region} was ${fmt(Math.abs(o.percent_anomaly))}% ${o.anomaly > 0 ? 'above' : 'below'} its 2001-2025 average, rank ${o.rank_highest_first} of ${o.of_years} years (rank 1 = highest). An extreme year is not a trend.`);
    } else if (name === 'test_period') {
      out.push(`Using only ${o.start_year}-${o.end_year} (${o.n} years), ${o.name} in ${o.region}: ${dir(o.sen_slope_per_year)} by ${dec(o.sen_slope_per_year, o.trend_unit)}, p-value ${fmtP(o.p_mk_lag1_adjusted)}, ${sig(o.significant_05)}. This is an exploratory recalculation on a shorter record.`);
    } else if (name === 'investigate_place') {
      if (o.inside_basin) out.push(`Local trend maps at ${o.place || `${o.lat}, ${o.lon}`}: strongest local changes are ${o.trends.slice(0, 3).map(t => `${t.name} (${t.direction}, ${fmt(t.local_sen_slope_per_year)} ${t.unit})`).join('; ')}. These are local rates of change from map pixels, with no significance test.`);
      else out.push('That location is outside the Indus Basin maps.');
    } else if (name === 'recommend_variables') {
      out.push(`For ${o.region} (${(o.region_traits || []).join(', ')}), the indicators most likely to show a trend are: ${o.ranked.slice(0, 4).map(r => r.name).join(', ')}.`);
    } else if (name === 'list_variables') {
      out.push(`The app can investigate these indicators: ${o.map(v => v.name).join(', ')}.`);
    }
  }
  return out;
}

// Execute the router's plan with the app's deterministic tools.
function execute(TD, plan, state, call) {
  const D = TD.data, region0 = TD.matchRegion(plan.region) || 'Indus Basin';
  const vars = (Array.isArray(plan.variables) ? plan.variables : []).map(v => TD.matchVariable(v)).filter(Boolean).slice(0, 3);
  const topic = ['floods', 'heat', 'snow', 'water', 'any'].includes(plan.topic) ? plan.topic : 'any';
  const year = Number.isInteger(plan.year) && plan.year >= 2001 && plan.year <= 2025 ? plan.year : null;
  let action = {};
  const pickRegion = v => (TD.seriesOf(region0, v) ? region0 : 'Indus Basin');
  if (plan.intent === 'list_variables') { call('list_variables', {}); return { variable: state.variable || 'rx1day_mm' }; }
  if (plan.intent === 'place' && plan.place) { const o = call('investigate_place', { place: String(plan.place) }); return { variable: o && o.trends && o.trends[0] ? o.trends[0].variable : 'rx1day_mm', place: String(plan.place) }; }
  if (plan.intent === 'compare') {
    const cmp = D.comparisons.find(c => c.id === plan.comparison && c.regions.length === 2) || D.comparisons.find(c => c.regions.includes(region0) && c.regions.length === 2) || D.comparisons[1];
    const v = vars[0] || TD.recommend({ topic, region: cmp.regions[0] })[0].variable; call('compare_regions', { comparison: cmp.id, variable: v });
    return { variable: v, comparison: cmp.id };
  }
  let list = vars;
  if (!list.length) { const rec = call('recommend_variables', { topic, region: region0 }); list = rec.ranked.slice(0, plan.intent === 'broad_topic' ? 3 : 1).map(r => r.variable); }
  if (plan.intent === 'extreme_year' && !vars.length) list = ['precipitation_mm'];
  list.slice(0, 3).forEach((v, i) => {
    const region = pickRegion(v); if (region !== region0) call('note', { text: `${TD.varById(v).display_name} was not analysed for ${region0}, so the whole Indus Basin is used instead. Say this in the answer.` });
    call('get_trend', { region, variable: v });
    if (i === 0) { action = { variable: v, region }; if (year) call('get_year_anomaly', { region, variable: v, year }); if (plan.intent === 'record_length' || Number.isInteger(plan.start_year)) call('test_period', { region, variable: v, start_year: Number.isInteger(plan.start_year) ? plan.start_year : 2011, end_year: 2025 }); }
  });
  return action;
}

async function run(TD, body, send, groundingCheck) {
  const history = (body.messages || []).filter(m => m && typeof m.content === 'string');
  const q = String((history[history.length - 1] || {}).content || '').slice(0, 600); if (!q) throw new Error('No question.');
  const st = body.state || {}, level = ['student', 'public', 'scientist'].includes(st.level) ? st.level : 'public';
  const fallback = TD.offlineDetective(q, st); // verified rule-based plan + summary, always available
  const steps = [], call = (name, input) => { if (name === 'note') { steps.push({ name, input, output: { ok: true } }); return null; } const output = TD.runTool(name, input); steps.push({ name, input, output }); send({ type: 'step', name, input, summary: output && output.error ? 'error' : 'ok' }); return output; };
  let action, routed = true;
  try {
    const plan = JSON.parse(await chat([{ role: 'system', content: routerPrompt(TD) }, { role: 'user', content: 'Q: ' + q }], { json: true, max: 160, timeout: 60000 }));
    if (plan.intent === 'off_topic') { send({ type: 'final', text: 'I can only investigate Earth-system trends in the Indus River Basin for 2001-2025: rain, extreme rain, land temperature, snow, runoff and soil moisture. Try asking whether one of those is changing in a region or near a town.', actions: [], steps: [], mode: 'ai', model: MODEL }); return; }
    action = execute(TD, plan, st, call);
    if (!steps.some(s => s.output && !s.output.error)) throw new Error('no evidence');
  } catch (e) { routed = false; steps.length = 0; fallback.steps.filter(s => s.name !== 'show_in_app').forEach(s => { steps.push(s); send({ type: 'step', name: s.name, input: s.input, summary: 'ok' }); }); action = fallback.actions[0]; }
  const tested = steps.filter(s => s.name === 'get_trend' && s.output && s.output.official_result);
  if (tested.length >= 2) steps.unshift({ name: 'note', input: { text: `Begin the answer with exactly this sentence: "The app cannot measure floods or disasters directly, but it tested ${tested.length} related indicators, and ${tested.filter(s => s.output.official_result.significant_05).length} of them show a proven trend." Then describe each indicator.` }, output: { ok: true } });
  else if (tested.length === 1) { const o = tested[0].output, r = o.official_result; steps.unshift({ name: 'note', input: { text: `Begin the answer with exactly this sentence: "${o.name} in ${o.region} is ${r.sen_slope_per_year > 0 ? 'rising' : 'falling'}, ${r.significant_05 ? 'and the trend is proven' : 'but the trend is not proven yet'}." Then give the rate and the p-value.` }, output: { ok: true } }); }
  steps.push({ name: 'show_in_app', input: action, output: { ok: true } }); send({ type: 'step', name: 'show_in_app', input: action, summary: 'ok' });
  send({ type: 'step', name: 'write_answer', input: { model: MODEL, from: 'tool results only' }, summary: 'ok' });
  const F = facts(TD, steps); let text = '', grounding = null, verified = true;
  try {
    text = (await chat([{ role: 'system', content: WRITER }, { role: 'user', content: `QUESTION: ${q}\nREADER: ${level}\nFACTS:\n${F.map(f => '- ' + f).join('\n')}` }], { max: 260 })).trim().replace(/\*\*/g, '');
    grounding = groundingCheck(text, [...steps, { output: (F.join(' ').match(/\d+(?:\.\d+)?/g) || []).map(Number) }]);
    // science guard: reject overclaims the display rules forbid (floods "getting worse", predictions, p-values as percentages)
    const overclaim = /floods? (are|is|have been|will be) (not |also )?(getting |becoming )?(worse|better|more (frequent|severe|intense))|will (flood|cause)|\d+\s?% (chance|probability|likely)|(chance|probability)[^.]{0,40}\d+\s?%|no (change|trend) (at all|whatsoever)|(likely|probably|may be|might be|could be) (related|linked|due|caused|driven)|caused by|as a result of|(is|are) not (disappearing|changing|increasing|decreasing|rising|falling|getting|melting|warming|drying)/i.test(text);
    if (!text || grounding.unverified.length || overclaim) verified = false;
  } catch { verified = false; }
  if (!verified) { text = fallback.text; grounding = null; steps.length = 0; steps.push(...fallback.steps); action = fallback.actions[0]; }
  send({ type: 'final', text, actions: [action], steps: steps.filter(s => s.name !== 'note'), grounding, mode: verified ? 'ai' : 'verified-summary', model: MODEL, note: verified ? null : 'Fact-check: the AI draft contained a claim the data could not back up, so this answer is the checked summary from the trend tools.' });
}

module.exports = { available, run, MODEL };
