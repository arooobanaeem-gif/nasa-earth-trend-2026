// Indus Trend Detective - tiny Node server: static files + the AI Detective agent.
// SI-assisted code (Claude). No framework needed:  node server.js
// The LLM key stays server-side. Without a key the app still works (offline detective in the browser).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const TD = require('./public/shared.js');
const localAI = require('./local_ai.js');

try { if (fs.existsSync(path.join(__dirname, '.env'))) process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* optional */ }

const PUBLIC = path.join(__dirname, 'public');
TD.init(JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'app_data.json'), 'utf8')), JSON.parse(fs.readFileSync(path.join(PUBLIC, 'data', 'grids.json'), 'utf8')));

const MODEL = process.env.DETECTIVE_MODEL || 'claude-opus-5-5';
const HAS_KEY = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
let client = null, Anthropic = null;
if (HAS_KEY) { const sdk = require('@anthropic-ai/sdk'); Anthropic = sdk.Anthropic || sdk.default || sdk; client = new Anthropic(); }

const SYSTEM = `You are the Trend Detective, a science guide inside a web app about the Indus River Basin flood season (2001-2025), built for NASA Space Apps 2026. You help students and the public act like data detectives: pick a variable, check whether it shows a trend, and check whether that trend is statistically significant.

How to work
- Investigate with the tools before answering. Turn a vague question into a region, a season and one to three candidate indicators (recommend_variables helps), then fetch the evidence (get_trend, compare_regions, get_year_anomaly, test_period, investigate_place).
- Finish every answer by calling show_in_app once so the dashboard shows the chart and map you are talking about.
- Every number you state must come from a tool result in this conversation. Never estimate, recall or invent a number. If a tool cannot provide it, say what is missing.
- Answer in this order: what is changing, where, how fast (with units, per year or per decade), and whether it is statistically significant (p-value, and the q-value for regional differences).

Scientific rules (the science team's display rules)
- A non-significant trend is still a finding. Never describe it as "no change"; say the trend is not yet detectable and, when the tool provides it, how many more years of data may be needed.
- One extreme year (2010, 2022) is not a trend. Mention when a result depends on a single year (see the robustness check).
- FLDAS runoff, soil moisture and snow water equivalent are model estimates, not measurements; runoff is not river discharge. MODIS land surface temperature is not air temperature. The snow-cover index is not percent snow cover. Rx1day is not a direct flood measure.
- A regional difference is only significant if the difference trend itself passes the FDR-adjusted test, not because one region is significant and the other is not.
- "Upper vs Lower Indus" is an operational split at Chashma Barrage.
- Pixel values from investigate_place are local rates of change only. They carry no significance test.
- You explain background trends. You do not predict individual floods or attribute a specific disaster to a cause.

Style
- Match the reader level given in the app state: "student" (simple words, explain p-value in one short phrase), "public" (plain language), or "scientist" (full statistics and method names).
- Keep answers under 140 words unless asked for more. Plain sentences, at most a short list. Name the data source (for example NASA GPM IMERG) once.
- If the question is outside the Indus Basin or outside these 12 indicators, say so briefly and offer the closest thing you can test.`;

// ---- number-grounding guardrail: every number in the answer must be traceable to a tool result ----
function collectNumbers(o, bag) { if (typeof o === 'number' && Number.isFinite(o)) bag.push(o); else if (Array.isArray(o)) o.forEach(x => collectNumbers(x, bag)); else if (o && typeof o === 'object') Object.values(o).forEach(x => collectNumbers(x, bag)); return bag; }
function groundingCheck(text, steps) {
  const bag = []; steps.forEach(s => { collectNumbers(s.output, bag); collectNumbers(s.input, bag); });
  const derived = []; bag.forEach(v => derived.push(v, v * 10, v * 100, Math.abs(v), Math.abs(v) * 10, Math.abs(v) * 100, 25 - v, v * 25));
  const found = text.replace(/\b(19|20)\d\d\s*[-–]\s*(19|20)?\d\d\b/g, ' ').match(/-?\d+(?:\.\d+)?/g) || [];
  const unverified = []; let checked = 0;
  for (const tok of found) {
    const x = Math.abs(parseFloat(tok)); if (!Number.isFinite(x)) continue;
    if ((Number.isInteger(x) && (x <= 12 || (x >= 1990 && x <= 2035))) || [0.05, 95, 90, 100, 0.01, 0.001].includes(x)) continue; // counts, years, conventions
    checked++;
    const dec = (tok.split('.')[1] || '').length, tol = Math.max(0.5 * Math.pow(10, -dec) * 1.2, x * 0.006);
    if (!derived.some(v => Math.abs(Math.abs(v) - x) <= tol)) unverified.push(tok);
  }
  return { checked, unverified };
}

async function createMessage(params) {
  try { return await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }); }
  catch (e) { if (Anthropic.BadRequestError && e instanceof Anthropic.BadRequestError) return client.messages.create(params); throw e; }
}

async function runAgent(body, send) {
  const history = (body.messages || []).filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-12).map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!history.length || history[history.length - 1].role !== 'user') throw new Error('No question.');
  const st = body.state || {};
  const system = `${SYSTEM}\n\nApp state: reader level = ${['student', 'public', 'scientist'].includes(st.level) ? st.level : 'public'}; currently viewing ${TD.matchVariable(st.variable) || 'nothing'} in ${TD.matchRegion(st.region) || 'Indus Basin'}.`;
  const messages = [...history], steps = [], actions = []; let text = '';
  for (let turn = 0; turn < 8; turn++) {
    const res = await createMessage({ model: MODEL, max_tokens: 4000, system, tools: TD.TOOLS, messages, output_config: { effort: 'low' } });
    if (res.stop_reason === 'refusal') { text = 'I cannot help with that request. Try asking about a trend in the Indus Basin.'; break; }
    messages.push({ role: 'assistant', content: res.content });
    text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || text;
    const calls = res.content.filter(b => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !calls.length) break;
    const results = [];
    for (const c of calls) {
      const output = TD.runTool(c.name, c.input || {});
      if (c.name === 'show_in_app') actions.push(c.input || {});
      steps.push({ name: c.name, input: c.input, output });
      send({ type: 'step', name: c.name, input: c.input, summary: output && output.error ? `error: ${output.error}` : 'ok' });
      results.push({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(output), is_error: !!(output && output.error) });
    }
    messages.push({ role: 'user', content: results });
  }
  send({ type: 'final', text, actions, steps, grounding: groundingCheck(text, steps), mode: 'ai', model: MODEL });
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/status') { const local = !HAS_KEY && await localAI.available(); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ai: HAS_KEY || local, provider: HAS_KEY ? 'claude' : local ? 'ollama' : null, model: HAS_KEY ? MODEL : local ? localAI.MODEL : null })); }
  if (url.pathname === '/api/agent' && req.method === 'POST') {
    let raw = ''; req.on('data', c => { raw += c; if (raw.length > 200000) req.destroy(); });
    req.on('end', async () => {
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
      const send = o => res.write(JSON.stringify(o) + '\n');
      try {
        const body = JSON.parse(raw || '{}');
        if (HAS_KEY) await runAgent(body, send);                                   // cloud LLM agent (needs a key)
        else if (await localAI.available()) await localAI.run(TD, body, send, groundingCheck); // free local LLM (Ollama)
        else throw new Error('NO_KEY');
      }
      catch (e) { console.error('agent error:', e && e.message); send({ type: 'error', message: e && e.message === 'NO_KEY' ? 'NO_KEY' : 'The AI detective is unavailable right now.' }); }
      res.end();
    });
    return;
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, ''); if (!p || p === '.') p = 'index.html';
  const file = path.join(PUBLIC, p);
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => { if (err) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(buf); });
});
const PORT = process.env.PORT || 5173;
server.listen(PORT, () => console.log(`Indus Trend Detective running at http://localhost:${PORT}  (AI: ${HAS_KEY ? MODEL : 'local Ollama model if running, otherwise offline mode'})`));
