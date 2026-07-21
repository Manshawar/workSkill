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

/**
 * Stream chat completion; measure ms until first non-empty delta.content.
 * Aborts shortly after first token to save tokens/time.
 */
async function measureFirstToken(apiRoot, apiKey, model, prompt, { timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = performance.now();
  let firstTokenMs = null;
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
        if (!data || data === '[DONE]') continue;
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
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          ctrl.abort();
          break;
        }
      }
      if (firstTokenMs != null) break;
    }

    if (firstTokenMs == null) {
      error = 'stream ended without content token';
    }
  } catch (e) {
    if (e && e.name === 'AbortError' && firstTokenMs != null) {
      /* expected after first token */
    } else {
      error = e && e.message ? e.message : String(e);
    }
  } finally {
    clearTimeout(t);
  }

  return {
    model,
    firstTokenMs,
    totalMs: Math.round(performance.now() - started),
    ok: firstTokenMs != null && !error,
    error,
    bytes,
  };
}

/**
 * Bench multiple models. onProgress({ type, ... }) optional.
 */
async function benchModels(apiRoot, apiKey, models, {
  prompt = '你好',
  rounds = 1,
  timeoutMs = 60000,
  onProgress,
} = {}) {
  const results = [];
  const list = [...models];

  for (const model of list) {
    if (onProgress) onProgress({ type: 'model_start', model });
    const samples = [];
    for (let r = 0; r < rounds; r++) {
      if (onProgress) onProgress({ type: 'round_start', model, round: r + 1, rounds });
      const sample = await measureFirstToken(apiRoot, apiKey, model, prompt, { timeoutMs });
      samples.push(sample);
      if (onProgress) onProgress({ type: 'round_done', model, round: r + 1, sample });
    }
    const okSamples = samples.filter((s) => s.ok && typeof s.firstTokenMs === 'number');
    const firsts = okSamples.map((s) => s.firstTokenMs);
    const avg = firsts.length
      ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length)
      : null;
    const best = firsts.length ? Math.min(...firsts) : null;
    const entry = {
      model,
      ok: firsts.length > 0,
      rounds: samples.length,
      okRounds: firsts.length,
      firstTokenMsAvg: avg,
      firstTokenMsBest: best,
      samples,
      error: firsts.length ? null : (samples.map((s) => s.error).filter(Boolean)[0] || 'all rounds failed'),
    };
    results.push(entry);
    if (onProgress) onProgress({ type: 'model_done', result: entry });
  }

  const ranked = [...results]
    .filter((r) => r.ok)
    .sort((a, b) => a.firstTokenMsAvg - b.firstTokenMsAvg);
  const failed = results.filter((r) => !r.ok);

  return { results, ranked, failed, prompt, rounds, at: new Date().toISOString() };
}

function formatRankTable(bench) {
  const lines = [];
  lines.push(`# Model bench (stream first-token) @ ${bench.at}`);
  lines.push(`prompt: ${JSON.stringify(bench.prompt)}  rounds: ${bench.rounds}`);
  lines.push('');
  lines.push('| Rank | Model | Avg first-token (ms) | Best (ms) | OK rounds |');
  lines.push('| ---: | --- | ---: | ---: | ---: |');
  bench.ranked.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.model} | ${r.firstTokenMsAvg} | ${r.firstTokenMsBest} | ${r.okRounds}/${r.rounds} |`);
  });
  if (bench.failed.length) {
    lines.push('');
    lines.push('## Failed');
    for (const f of bench.failed) {
      lines.push(`- ${f.model}: ${f.error}`);
    }
  }
  if (bench.ranked.length) {
    lines.push('');
    lines.push(`**Recommendation:** prefer \`${bench.ranked[0].model}\` now (lowest avg first-token).`);
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
    prompt: bench.prompt,
    rounds: bench.rounds,
    ranked: bench.ranked.map((r) => ({
      model: r.model,
      firstTokenMsAvg: r.firstTokenMsAvg,
      firstTokenMsBest: r.firstTokenMsBest,
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
  measureFirstToken,
  benchModels,
  formatRankTable,
  saveHistory,
  configDir,
};
