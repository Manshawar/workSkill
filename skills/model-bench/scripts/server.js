#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  ENV_BASE,
  ENV_KEY,
  readEnv,
  normalizeApiRoot,
  fetchModels,
  benchModels,
  saveHistory,
} = require('./lib');

const UI_PATH = path.join(__dirname, '..', 'assets', 'ui.html');

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, text, type) {
  res.writeHead(status, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function requireGateway() {
  const env = readEnv();
  if (env.missing.length) {
    const err = new Error(`Missing env: ${env.missing.join(', ')}`);
    err.code = 'ENV_MISSING';
    err.missing = env.missing;
    throw err;
  }
  return {
    apiRoot: normalizeApiRoot(env.baseUrl),
    apiKey: env.apiKey,
    baseUrl: env.baseUrl,
  };
}

function createServer() {
  return http.createServer(async (req, res) => {
    const u = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
    const { pathname } = u;

    try {
      if (req.method === 'GET' && (pathname === '/' || pathname === '/ui' || pathname === '/index.html')) {
        const html = fs.readFileSync(UI_PATH, 'utf8');
        return sendText(res, 200, html, 'text/html');
      }

      if (req.method === 'GET' && pathname === '/api/health') {
        const env = readEnv();
        let apiRoot = null;
        try {
          if (env.baseUrl) apiRoot = normalizeApiRoot(env.baseUrl);
        } catch (e) {
          return sendJson(res, 200, {
            ok: false,
            missing: env.missing,
            envBase: ENV_BASE,
            envKey: ENV_KEY,
            error: e.message,
          });
        }
        return sendJson(res, 200, {
          ok: env.missing.length === 0,
          missing: env.missing,
          envBase: ENV_BASE,
          envKey: ENV_KEY,
          hasBase: Boolean(env.baseUrl),
          hasKey: Boolean(env.apiKey),
          apiRoot,
        });
      }

      if (req.method === 'GET' && pathname === '/api/models') {
        const gw = requireGateway();
        const models = await fetchModels(gw.apiRoot, gw.apiKey);
        return sendJson(res, 200, { models, count: models.length });
      }

      if (req.method === 'POST' && pathname === '/api/bench') {
        const gw = requireGateway();
        const body = await readBody(req);
        let models = Array.isArray(body.models) ? body.models.filter((m) => typeof m === 'string') : null;
        if (!models || !models.length) {
          models = await fetchModels(gw.apiRoot, gw.apiKey);
        }
        const rounds = Math.max(1, Math.min(5, parseInt(body.rounds, 10) || 1));
        const prompt = typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : '你好';
        const timeoutMs = Math.max(5000, parseInt(body.timeoutMs, 10) || 120000);
        const sortBy = body.sortBy === 'total' ? 'total' : 'ttft';
        const staggerMs = Math.max(0, parseInt(body.staggerMs, 10) || 1000);
        let concurrency = 6;
        if (body.concurrency === 'all' || body.concurrency === 0) {
          concurrency = Infinity;
        } else if (body.concurrency != null && body.concurrency !== '') {
          const n = parseInt(body.concurrency, 10);
          if (Number.isFinite(n) && n > 0) concurrency = n;
        }

        // SSE progress
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store',
          Connection: 'keep-alive',
        });
        const send = (event, data) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        send('start', { count: models.length, rounds, prompt, sortBy, concurrency, staggerMs });
        const bench = await benchModels(gw.apiRoot, gw.apiKey, models, {
          prompt,
          rounds,
          timeoutMs,
          sortBy,
          concurrency,
          staggerMs,
          onProgress: (ev) => send('progress', ev),
        });
        let historyFile = null;
        try {
          historyFile = saveHistory(bench);
        } catch {
          /* ignore */
        }
        send('done', {
          ranked: bench.ranked,
          failed: bench.failed,
          at: bench.at,
          prompt: bench.prompt,
          rounds: bench.rounds,
          sortBy: bench.sortBy,
          concurrency: bench.concurrency,
          staggerMs: bench.staggerMs,
          historyFile,
        });
        res.end();
        return;
      }

      sendJson(res, 404, { error: 'not found' });
    } catch (e) {
      if (e && e.code === 'ENV_MISSING') {
        return sendJson(res, 503, {
          error: e.message,
          missing: e.missing,
          envBase: ENV_BASE,
          envKey: ENV_KEY,
        });
      }
      const status = e && e.message === 'Invalid JSON body' ? 400 : 500;
      if (!res.headersSent) sendJson(res, status, { error: e.message || String(e) });
      else {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ error: e.message || String(e) })}\n\n`);
          res.end();
        } catch {
          /* ignore */
        }
      }
    }
  });
}

function start({ port = 8787 } = {}) {
  const env = readEnv();
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`model-bench UI → ${url}`);
    if (env.missing.length) {
      console.log(`WARN: missing ${env.missing.join(', ')} — open UI for setup hints, or set env and restart.`);
    } else {
      try {
        console.log(`API root: ${normalizeApiRoot(env.baseUrl)}`);
      } catch (e) {
        console.log(`WARN: ${e.message}`);
      }
    }
    console.log('Ctrl+C to stop.');
  });
  return server;
}

if (require.main === module) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg >= 0 ? parseInt(process.argv[portArg + 1], 10) || 8787 : 8787;
  start({ port });
}

module.exports = { start, createServer };
