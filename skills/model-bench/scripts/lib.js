'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const ENV_BASE = 'AI_GATEWAY_BASE_URL';
const ENV_KEY = 'AI_GATEWAY_API_KEY';

function homedir() {
  return os.homedir();
}

function configDir() {
  return path.join(homedir(), '.config', 'model-bench');
}

function ensureConfigDir() {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** @returns {{ baseUrl: string|null, apiKey: string|null, missing: string[] }} */
function readEnv() {
  const baseUrl = (process.env[ENV_BASE] || '').trim() || null;
  const apiKey = (process.env[ENV_KEY] || '').trim() || null;
  const missing = [];
  if (!baseUrl) missing.push(ENV_BASE);
  if (!apiKey) missing.push(ENV_KEY);
  return { baseUrl, apiKey, missing };
}

/**
 * Normalize to API root ending with /v1 (no trailing slash beyond that).
 * Accepts: https://host | https://host/ | https://host/v1 | https://host/v1/
 */
function normalizeApiRoot(baseUrl) {
  let u = String(baseUrl).trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) {
    throw new Error(`Invalid ${ENV_BASE}: must start with http:// or https://`);
  }
  if (!/\/v1$/i.test(u)) u = `${u}/v1`;
  return u;
}

function modelsUrl(apiRoot) {
  return `${apiRoot}/models`;
}

function chatUrl(apiRoot) {
  return `${apiRoot}/chat/completions`;
}

function authHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

/** Extract model id list from OpenAI-compatible /v1/models JSON. */
function parseModelIds(payload) {
  const data = payload && payload.data;
  if (!Array.isArray(data)) return [];
  const ids = [];
  for (const item of data) {
    const id = item && (item.id || item.model);
    if (typeof id === 'string' && id.trim()) ids.push(id.trim());
  }
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

async function fetchModels(apiRoot, apiKey, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(modelsUrl(apiRoot), {
      method: 'GET',
      headers: authHeaders(apiKey),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`GET /models non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg = json.error?.message || json.message || text.slice(0, 200);
      throw new Error(`GET /models HTTP ${res.status}: ${msg}`);
    }
    return parseModelIds(json);
  } finally {
    clearTimeout(t);
  }
}

/** ms → seconds, 2 decimal places. */
function msToSec(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  return Math.round(Number(ms) / 10) / 100;
}

const PROBE_TOPICS = [
  '今天适合散步吗',
  '咖啡和茶哪个提神',
  '一句话解释什么是哈希',
  '推荐一个放松方式',
  '圆周率前五位是什么',
  '南北方冬天有何不同',
  '如何保持专注',
  '列举三种常见排序',
  '海水为什么是咸的',
  '用一个比喻说明缓存',
  '周一和周五心情差在哪',
  '什么是幂等',
];

/**
 * Build a unique probe prompt each call to avoid gateway/prompt cache.
 * Same string is reused for all models within one bench round (fair compare).
 */
function buildProbePrompt(base) {
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const topic = PROBE_TOPICS[Math.floor(Math.random() * PROBE_TOPICS.length)];
  const templates = [
    `请用不超过30字回答：${topic}？(probe:${nonce})`,
    `一句话回复即可：${topic}。[${nonce}]`,
    `简答（防缓存 ${nonce}）：${topic}`,
    `用中文短句说明：${topic} #${nonce}`,
  ];
  const picked = templates[Math.floor(Math.random() * templates.length)];
  const custom = typeof base === 'string' ? base.trim() : '';
  if (custom && custom !== '你好' && !/^auto$/i.test(custom)) {
    return `${custom}\n\n(probe:${nonce} · ${topic})`;
  }
  return picked;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Simple semaphore for max in-flight jobs. */
function createSemaphore(max) {
  let active = 0;
  const waiters = [];
  const acquire = () => new Promise((resolve) => {
    if (active < max) {
      active += 1;
      resolve();
    } else {
      waiters.push(resolve);
    }
  });
  const release = () => {
    active -= 1;
    const next = waiters.shift();
    if (next) {
      active += 1;
      next();
    }
  };
  return { acquire, release };
}

/**
 * Run jobs concurrently with staggered starts (default 1s) to avoid slamming the gateway.
 * Item i is eligible to start at T0 + i * staggerMs; concurrency caps in-flight work.
 */
async function mapStaggered(items, { concurrency = Infinity, staggerMs = 1000 }, fn) {
  if (!items.length) return [];
  const limit = Number.isFinite(concurrency)
    ? Math.max(1, Math.min(concurrency, items.length))
    : items.length;
  const sem = createSemaphore(limit);
  const t0 = Date.now();

  return Promise.all(items.map((item, i) => (async () => {
    const target = t0 + i * Math.max(0, staggerMs);
    const wait = target - Date.now();
    if (wait > 0) await sleep(wait);
    await sem.acquire();
    try {
      return await fn(item, i);
    } finally {
      sem.release();
    }
  })()));
}

/**
 * Stream chat to completion. Capture:
 * - TTFT: first non-empty delta.content
 * - total: request start → stream end / [DONE]
 * Does NOT use wall-clock "end time" for ranking (useless across models).
 */
async function measureStream(apiRoot, apiKey, model, prompt, { timeoutMs = 120000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = performance.now();
  let firstTokenMs = null;
  let sawDone = false;
  let error = null;
  let bytes = 0;

  try {
    const res = await fetch(chatUrl(apiRoot), {
      method: 'POST',
      headers: {
        ...authHeaders(apiKey),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: ctrl.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        msg = j.error?.message || j.message || msg;
      } catch {
        /* keep */
      }
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }

    if (!res.body) throw new Error('No response body (stream unsupported in this Node runtime)');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) bytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() || '';

      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') {
          sawDone = true;
          continue;
        }
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        const content = delta?.content;
        if (typeof content === 'string' && content.length > 0 && firstTokenMs == null) {
          firstTokenMs = Math.round(performance.now() - started);
        }
        const finish = json.choices?.[0]?.finish_reason;
        if (finish) sawDone = true;
      }
    }

    if (firstTokenMs == null) {
      error = 'stream ended without content token';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') {
      error = `timeout (${timeoutMs}ms)`;
    } else {
      error = e && e.message ? e.message : String(e);
    }
  } finally {
    clearTimeout(t);
  }

  const totalMs = Math.round(performance.now() - started);
  const ok = firstTokenMs != null && !error;
  return {
    model,
    firstTokenMs,
    firstTokenSec: msToSec(firstTokenMs),
    totalMs: ok ? totalMs : null,
    totalSec: ok ? msToSec(totalMs) : null,
    finishedAt: new Date().toISOString(),
    sawDone,
    ok,
    error: ok ? null : (error || 'unknown'),
    bytes,
  };
}

/** @deprecated alias */
const measureFirstToken = measureStream;

/**
 * Bench multiple models concurrently (staggered starts).
 * sortBy: 'total' (default — agent waits for full turn) | 'ttft'
 * concurrency: max in-flight models (default 6)
 * staggerMs: delay between each model start (default 1000)
 * Rounds within one model stay sequential.
 */
async function benchModels(apiRoot, apiKey, models, {
  prompt = null,
  randomizePrompt = true,
  rounds = 1,
  timeoutMs = 120000,
  sortBy = 'total',
  concurrency = 6,
  staggerMs = 1000,
  onProgress,
} = {}) {
  const list = [...models];

  // Generate one fresh prompt per round (shared across models), never reuse fixed cacheable text.
  const resultsByModel = new Map(list.map((m) => [m, []]));

  for (let r = 0; r < rounds; r++) {
    const promptForRound = randomizePrompt
      ? buildProbePrompt(prompt)
      : (prompt && String(prompt).trim() ? String(prompt).trim() : buildProbePrompt(null));
    if (onProgress) onProgress({ type: 'round_prompt', round: r + 1, prompt: promptForRound });

    const roundEntries = await mapStaggered(
      list,
      { concurrency, staggerMs },
      async (model) => {
        if (onProgress) onProgress({ type: 'model_start', model, round: r + 1, rounds });
        const sample = await measureStream(apiRoot, apiKey, model, promptForRound, { timeoutMs });
        sample.prompt = promptForRound;
        if (onProgress) onProgress({ type: 'round_done', model, round: r + 1, sample });
        return { model, sample };
      },
    );
    for (const { model, sample } of roundEntries) {
      resultsByModel.get(model).push(sample);
    }
  }

  const results = list.map((model) => {
    const samples = resultsByModel.get(model) || [];
    const okSamples = samples.filter((s) => s.ok && typeof s.firstTokenMs === 'number');
    const firsts = okSamples.map((s) => s.firstTokenMs);
    const totals = okSamples.map((s) => s.totalMs).filter((n) => typeof n === 'number');
    const avgTtftMs = firsts.length
      ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length)
      : null;
    const avgTotalMs = totals.length
      ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
      : null;
    const entry = {
      model,
      ok: firsts.length > 0,
      rounds: samples.length,
      okRounds: firsts.length,
      ttftSec: msToSec(avgTtftMs),
      totalSec: msToSec(avgTotalMs),
      firstTokenMsAvg: avgTtftMs,
      totalMsAvg: avgTotalMs,
      samples,
      error: firsts.length ? null : (samples.map((s) => s.error).filter(Boolean)[0] || 'all rounds failed'),
    };
    if (onProgress) onProgress({ type: 'model_done', result: entry });
    return entry;
  });

  // Always rank primarily by total wall time (agent waits for full turn).
  const keyMs = sortBy === 'ttft' ? 'firstTokenMsAvg' : 'totalMsAvg';
  const ranked = [...results]
    .filter((r) => r.ok && r[keyMs] != null)
    .sort((a, b) => a[keyMs] - b[keyMs]);
  const failed = results.filter((r) => !r.ok);

  const lastPrompt = (() => {
    for (const r of results) {
      const s = (r.samples || [])[r.samples.length - 1];
      if (s && s.prompt) return s.prompt;
    }
    return prompt || null;
  })();

  return {
    results,
    ranked,
    failed,
    prompt: lastPrompt,
    rounds,
    concurrency: Number.isFinite(concurrency) ? concurrency : list.length,
    staggerMs,
    at: new Date().toISOString(),
    sortBy: sortBy === 'ttft' ? 'ttftSec' : 'totalSec',
    metric: sortBy === 'ttft' ? 'ttftSec' : 'totalSec',
  };
}

function formatRankTable(bench) {
  const lines = [];
  const sortLabel = bench.sortBy === 'totalSec' ? 'totalSec' : 'ttftSec';
  lines.push(`# Model bench · TTFT + total (seconds) @ ${bench.at}`);
  lines.push(`sort: ${sortLabel}  concurrency: ${bench.concurrency}  stagger: ${bench.staggerMs}ms  prompt: ${JSON.stringify(bench.prompt)}  rounds: ${bench.rounds}`);
  lines.push('');
  lines.push('| Rank | Model | Total (s) | TTFT (s) | OK |');
  lines.push('| ---: | --- | ---: | ---: | ---: |');
  bench.ranked.forEach((r, i) => {
    const ttft = r.ttftSec != null ? r.ttftSec.toFixed(2) : '-';
    const total = r.totalSec != null ? r.totalSec.toFixed(2) : '-';
    lines.push(`| ${i + 1} | ${r.model} | ${total} | ${ttft} | ${r.okRounds}/${r.rounds} |`);
  });
  if (bench.failed.length) {
    lines.push('');
    lines.push('## Failed');
    for (const f of bench.failed) {
      lines.push(`- ${f.model}: ${f.error}`);
    }
  }
  if (bench.ranked.length) {
    const top = bench.ranked[0];
    const why = sortLabel === 'ttftSec'
      ? `lowest TTFT ${top.ttftSec.toFixed(2)}s`
      : `lowest total ${top.totalSec.toFixed(2)}s`;
    lines.push('');
    lines.push(`**Recommendation:** prefer \`${top.model}\` now (${why}).`);
  }
  return lines.join('\n');
}

function saveHistory(bench) {
  const dir = path.join(ensureConfigDir(), 'history');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `${stamp}.json`);
  const slim = {
    at: bench.at,
    sortBy: bench.sortBy,
    concurrency: bench.concurrency,
    staggerMs: bench.staggerMs,
    prompt: bench.prompt,
    rounds: bench.rounds,
    ranked: bench.ranked.map((r) => ({
      model: r.model,
      ttftSec: r.ttftSec,
      totalSec: r.totalSec,
      okRounds: r.okRounds,
      rounds: r.rounds,
    })),
    failed: bench.failed.map((f) => ({ model: f.model, error: f.error })),
  };
  fs.writeFileSync(file, JSON.stringify(slim, null, 2), 'utf8');
  return file;
}

module.exports = {
  ENV_BASE,
  ENV_KEY,
  readEnv,
  normalizeApiRoot,
  fetchModels,
  measureStream,
  measureFirstToken,
  benchModels,
  formatRankTable,
  saveHistory,
  configDir,
  ensureConfigDir,
  msToSec,
  mapStaggered,
  buildProbePrompt,
};
