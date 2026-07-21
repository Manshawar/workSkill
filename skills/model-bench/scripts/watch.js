'use strict';

const fs = require('fs');
const path = require('path');

const {
  readEnv,
  normalizeApiRoot,
  fetchModels,
  benchModels,
  configDir,
} = require('./lib');

const MAX_PROBES = 144;
const STATE_FILE = () => path.join(configDir(), 'watch-state.json');

function ensureDir() {
  fs.mkdirSync(configDir(), { recursive: true });
}

/** @type {{
 *  enabled: boolean,
 *  intervalMin: number,
 *  models: string[]|null,
 *  prompt: string,
 *  rounds: number,
 *  concurrency: number,
 *  staggerMs: number,
 *  sortBy: string,
 *  probes: Array<{at:string,points:Array<{model:string,totalSec:number,ttftSec:number|null}>}>,
 *  lastRunAt: string|null,
 *  lastError: string|null,
 *  running: boolean,
 * }} */
let state = {
  enabled: false,
  intervalMin: 10,
  models: null,
  prompt: '你好',
  rounds: 1,
  concurrency: 6,
  staggerMs: 1000,
  sortBy: 'total',
  probes: [],
  lastRunAt: null,
  lastError: null,
  running: false,
};

let timer = null;
let bootstrapped = false;

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE(), 'utf8');
    const data = JSON.parse(raw);
    state = {
      ...state,
      ...data,
      probes: Array.isArray(data.probes) ? data.probes : [],
      running: false,
    };
  } catch {
    /* fresh */
  }
}

function persist() {
  ensureDir();
  const out = {
    enabled: state.enabled,
    intervalMin: state.intervalMin,
    models: state.models,
    prompt: state.prompt,
    rounds: state.rounds,
    concurrency: state.concurrency,
    staggerMs: state.staggerMs,
    sortBy: state.sortBy,
    probes: state.probes,
    lastRunAt: state.lastRunAt,
    lastError: state.lastError,
  };
  fs.writeFileSync(STATE_FILE(), JSON.stringify(out, null, 2), 'utf8');
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) * (x - m), 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function stabilityStats(probes) {
  const byModel = new Map();
  for (const probe of probes) {
    for (const p of probe.points || []) {
      if (!byModel.has(p.model)) byModel.set(p.model, []);
      byModel.get(p.model).push(p.totalSec);
    }
  }
  const rows = [];
  for (const [model, vals] of byModel) {
    rows.push({
      model,
      avg: mean(vals),
      sd: stddev(vals),
      n: vals.length,
    });
  }
  rows.sort((a, b) => {
    // Rank by avg Total (primary); stddev as tie-breaker for stability
    if (a.avg !== b.avg) return a.avg - b.avg;
    if (a.sd !== b.sd) return a.sd - b.sd;
    return b.n - a.n;
  });
  return rows;
}

function getStatus() {
  return {
    enabled: state.enabled,
    intervalMin: state.intervalMin,
    models: state.models,
    prompt: state.prompt,
    rounds: state.rounds,
    concurrency: state.concurrency,
    staggerMs: state.staggerMs,
    sortBy: state.sortBy,
    running: state.running,
    lastRunAt: state.lastRunAt,
    lastError: state.lastError,
    probeCount: state.probes.length,
    probes: state.probes,
    stability: stabilityStats(state.probes),
    stateFile: STATE_FILE(),
  };
}

function clearHistory() {
  state.probes = [];
  state.lastError = null;
  persist();
  return getStatus();
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function stopWatch() {
  state.enabled = false;
  stopTimer();
  persist();
  console.log('[watch] stopped');
  return getStatus();
}

async function runProbe(reason = 'manual') {
  if (state.running) {
    return { skipped: true, reason: 'already running', status: getStatus() };
  }
  const env = readEnv();
  if (env.missing.length) {
    state.lastError = `Missing env: ${env.missing.join(', ')}`;
    persist();
    return { ok: false, error: state.lastError, status: getStatus() };
  }

  state.running = true;
  state.lastError = null;
  console.log(`[watch] probe start (${reason})`);

  try {
    const apiRoot = normalizeApiRoot(env.baseUrl);
    let models = Array.isArray(state.models) && state.models.length
      ? [...state.models]
      : null;
    if (!models) {
      models = await fetchModels(apiRoot, env.apiKey);
    }
    const bench = await benchModels(apiRoot, env.apiKey, models, {
      prompt: state.prompt, // base hint only; each probe uses buildProbePrompt
      rounds: state.rounds,
      concurrency: state.concurrency,
      staggerMs: state.staggerMs,
      sortBy: 'total',
      randomizePrompt: true,
    });
    const points = (bench.ranked || [])
      .filter((r) => r.model && r.totalSec != null)
      .map((r) => ({
        model: r.model,
        totalSec: Number(r.totalSec),
        ttftSec: r.ttftSec != null ? Number(r.ttftSec) : null,
      }));
    state.probes.push({ at: bench.at || new Date().toISOString(), points });
    if (state.probes.length > MAX_PROBES) {
      state.probes = state.probes.slice(-MAX_PROBES);
    }
    state.lastRunAt = bench.at || new Date().toISOString();
    persist();
    console.log(`[watch] probe done · models=${points.length} · total probes=${state.probes.length}`);
    return { ok: true, at: state.lastRunAt, status: getStatus() };
  } catch (e) {
    state.lastError = e && e.message ? e.message : String(e);
    persist();
    console.error(`[watch] probe failed: ${state.lastError}`);
    return { ok: false, error: state.lastError, status: getStatus() };
  } finally {
    state.running = false;
  }
}

function schedule() {
  stopTimer();
  if (!state.enabled) return;
  const ms = Math.max(1, state.intervalMin) * 60 * 1000;
  timer = setInterval(() => {
    runProbe('interval').catch(() => {});
  }, ms);
  console.log(`[watch] scheduled every ${state.intervalMin} min`);
}

function applyConfig(opts = {}) {
  if (opts.intervalMin != null) {
    state.intervalMin = Math.max(1, Math.min(120, parseInt(opts.intervalMin, 10) || 10));
  }
  if (Array.isArray(opts.models)) {
    state.models = opts.models.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim());
    if (!state.models.length) state.models = null;
  }
  if (typeof opts.prompt === 'string' && opts.prompt.trim()) state.prompt = opts.prompt.trim();
  if (opts.rounds != null) state.rounds = Math.max(1, Math.min(5, parseInt(opts.rounds, 10) || 1));
  if (opts.concurrency != null) {
    const n = parseInt(opts.concurrency, 10);
    state.concurrency = Number.isFinite(n) && n > 0 ? n : 6;
  }
  if (opts.staggerMs != null) {
    const n = parseInt(opts.staggerMs, 10);
    state.staggerMs = Number.isFinite(n) && n >= 0 ? n : 1000;
  }
  if (opts.sortBy === 'ttft' || opts.sortBy === 'total') state.sortBy = opts.sortBy;
}

function startWatch(opts = {}) {
  applyConfig(opts);
  state.enabled = true;
  persist();
  schedule();
  console.log('[watch] enabled');

  const runNow = opts.runNow !== false;
  if (runNow) {
    runProbe('start').catch(() => {});
  }
  return getStatus();
}

/** Call once when HTTP server boots — resume timer if previously enabled. */
function bootstrap() {
  if (bootstrapped) return;
  bootstrapped = true;
  loadState();
  if (state.enabled) {
    console.log('[watch] resuming from disk (enabled=true)');
    schedule();
  }
}

module.exports = {
  bootstrap,
  getStatus,
  startWatch,
  stopWatch,
  runProbe,
  clearHistory,
  applyConfig,
  loadState,
};
