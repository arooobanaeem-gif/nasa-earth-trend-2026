# Indus Trend Detective (web app)

Interactive app for the NASA Space Apps 2026 challenge "Be an Earth System Trend Detective!".
It turns the science outputs in this repository (`data/`, `results/`) into a guided investigation of the
Indus Basin flood season, 2001-2025.

## Run it

```bash
cd app
npm install
node server.js
```

Open http://localhost:5173.

## The AI Detective: three ways to run it

| Mode | Cost | How |
|---|---|---|
| Local AI (Ollama) | Free | Install Ollama, run `ollama pull llama3.2`, keep Ollama running, start the app. Detected automatically. |
| Cloud AI (Claude) | Paid API key | Copy `.env.example` to `.env`, paste an Anthropic API key, restart. |
| Offline detective | Free | Nothing to set up. A rule-based assistant that uses the same trend tools. Used automatically when no AI is available. |

The local AI is not a general chatbot. `local_ai.js` runs a four-step pipeline built for this app:
1. Router: the model turns the question into a plan (intent, indicators, region, year, place) as JSON.
2. Tools: the app's own trend tools produce every number.
3. Writer: the model writes the answer from those tool facts only, at the reader's level.
4. Guard: every number in the draft is checked against the tool results. A draft that fails is replaced by the verified summary.

## What is inside

| Part | File | What it does |
|---|---|---|
| Trend engine | `public/shared.js` | OLS + t-test + 95% CI, Mann-Kendall (lag-1 adjusted), Sen's slope, years-to-detect, drop-one-year robustness. Shared by browser and server. |
| AI Detective (local, free) | `local_ai.js` | Ollama pipeline: router, trend tools, grounded writer, number guard. |
| Reader modes and guided questions | `public/modes.js`, `public/theme.css` | Student (guessing game, quiz), Curious citizen (plain-words summary, local check), Scientist (full statistics table, CSV downloads); three-question wizard; variable search; tool tour. |
| AI Detective agent (cloud) | `server.js` | LLM with tool calling. Tools: `list_variables`, `recommend_variables`, `get_trend`, `test_period`, `compare_regions`, `get_year_anomaly`, `investigate_place`, `show_in_app`. A number-grounding guardrail checks every number in the answer against tool results. The API key stays on the server. |
| Variable recommender | `public/shared.js` (`recommend`) | Ranks indicators by topic, region traits (glacierised, monsoon, arid plains...) and an automatic trend scan. |
| Spatial trend maps | `scripts/build_data.mjs` | Converts the per-pixel Sen's-slope GeoTIFFs to map overlays and to grids that can be sampled at any point ("what is changing where I live?"). |
| Front end | `public/index.html`, `public/app.js` | Guided questions, evidence board, map, charts, verdict card, record-length slider, regional comparison, extreme-year story, auto-play case files, glossary. |

## Rebuild the data

```bash
npm run build:data -- "path/to/folder/with/trend/GeoTIFFs/and/basin/GeoJSON"
```

Reads `../data` and `../results` plus the raster folder and writes `public/data/`.

## Headline numbers

Verdicts for the full 2001-2025 record always come from `results/master_scientific_results.csv`.
The record-length slider and the t-test are recalculated in the browser and are labelled exploratory.
Sen's slopes recomputed by the app match the master table for all 78 regional trends.

## Deploy

Any Node host works (for example Render: root directory `app`, build `npm install`, start `node server.js`,
environment variable `ANTHROPIC_API_KEY`). The `public/` folder also works on a static host such as
GitHub Pages; there the app runs in offline-detective mode.

## AI (SI) disclosure

The AI Detective is a product feature. AI assistants were also used to accelerate coding
(files marked "SI-assisted code"). The science question, study design and analysis are the team's own.
No AI-generated imagery is used.
