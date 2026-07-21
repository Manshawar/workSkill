#!/usr/bin/env node
'use strict';

const {
  ENV_BASE,
  ENV_KEY,
  readEnv,
  normalizeApiRoot,
  fetchModels,
  benchModels,
  formatRankTable,
  saveHistory,
} = require('./lib');

function printEnvHelp() {
  const isWin = process.platform === 'win32';
  console.error(`Missing env. Set both, then reopen this terminal / IDE session.`);
  console.error(`  ${ENV_BASE}   e.g. https://ai-gateway.example.com`);
  console.error(`  ${ENV_KEY}    your API token (never paste into chat)`);
  console.error('');
  if (isWin) {
    console.error('PowerShell (persistent User env):');
    console.error(`  [System.Environment]::SetEnvironmentVariable("${ENV_BASE}", "https://ai-gateway.example.com", "User")`);
    console.error(`  [System.Environment]::SetEnvironmentVariable("${ENV_KEY}", "YOUR_KEY", "User")`);
    console.error('Then close and reopen the terminal.');
  } else {
    console.error('macOS / Linux (zsh → ~/.zshrc ; bash → ~/.bashrc):');
    console.error(`  echo 'export ${ENV_BASE}="https://ai-gateway.example.com"' >> ~/.zshrc`);
    console.error(`  echo 'export ${ENV_KEY}="YOUR_KEY"' >> ~/.zshrc`);
    console.error('  source ~/.zshrc');
    console.error('Verify length only:  echo ${#' + ENV_KEY + '}');
  }
}

function parseArgs(argv) {
  const out = {
    ui: false,
    json: false,
    save: true,
    rounds: 1,
    prompt: '你好',
    models: null,
    exclude: [],
    port: 8787,
    timeoutMs: 120000,
    sortBy: 'ttft',
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === 'ui' || a === '--ui') out.ui = true;
    else if (a === '--json') out.json = true;
    else if (a === '--no-save') out.save = false;
    else if (a === '--rounds') out.rounds = Math.max(1, parseInt(args[++i], 10) || 1);
    else if (a === '--prompt') out.prompt = args[++i] || out.prompt;
    else if (a === '--models') out.models = (args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--exclude') out.exclude = (args[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--port') out.port = parseInt(args[++i], 10) || out.port;
    else if (a === '--timeout') out.timeoutMs = parseInt(args[++i], 10) || out.timeoutMs;
    else if (a === '--sort') {
      const v = (args[++i] || 'ttft').toLowerCase();
      out.sortBy = v === 'total' ? 'total' : 'ttft';
    }
    else if (a === '-h' || a === '--help') out.help = true;
  }
  return out;
}

function usage() {
  console.log(`Usage:
  node bench.js                 # CLI: TTFT + total → rank (default sort: TTFT)
  node bench.js ui              # local UI (same as --ui)
  node bench.js --ui [--port 8787]

Options:
  --rounds N          default 1
  --prompt TEXT       default 你好
  --models a,b,c      only these ids
  --exclude a,b       skip these ids
  --sort ttft|total   default ttft (Claude Code); total = full stream
  --timeout MS        per-request timeout (default 120000)
  --json              print JSON instead of markdown table
  --no-save           do not write ~/.config/model-bench/history/
  --port N            UI port (default 8787)

Env (required):
  ${ENV_BASE}   gateway origin, e.g. https://ai-gateway.example.com
  ${ENV_KEY}    Bearer token
`);
}

async function runCli(opts) {
  const env = readEnv();
  if (env.missing.length) {
    printEnvHelp();
    process.exitCode = 2;
    return;
  }
  const apiRoot = normalizeApiRoot(env.baseUrl);
  let models = opts.models;
  if (!models || !models.length) {
    process.stderr.write('Fetching /v1/models ...\n');
    models = await fetchModels(apiRoot, env.apiKey, { timeoutMs: opts.timeoutMs });
  }
  if (opts.exclude.length) {
    const ex = new Set(opts.exclude);
    models = models.filter((m) => !ex.has(m));
  }
  if (!models.length) {
    console.error('No models to bench.');
    process.exitCode = 1;
    return;
  }
  process.stderr.write(`Benching ${models.length} model(s), rounds=${opts.rounds} ...\n`);
  const bench = await benchModels(apiRoot, env.apiKey, models, {
    prompt: opts.prompt,
    rounds: opts.rounds,
    timeoutMs: opts.timeoutMs,
    sortBy: opts.sortBy,
    onProgress: (ev) => {
      if (ev.type === 'model_start') process.stderr.write(`  → ${ev.model}\n`);
      if (ev.type === 'model_done') {
        const r = ev.result;
        if (r.ok) {
          process.stderr.write(
            `    ok TTFT=${r.ttftSec.toFixed(2)}s total=${r.totalSec.toFixed(2)}s\n`,
          );
        } else process.stderr.write(`    FAIL ${r.error}\n`);
      }
    },
  });
  let historyFile = null;
  if (opts.save) {
    try {
      historyFile = saveHistory(bench);
    } catch (e) {
      process.stderr.write(`history save skipped: ${e.message}\n`);
    }
  }
  if (opts.json) {
    console.log(JSON.stringify({ ...bench, historyFile }, null, 2));
  } else {
    console.log(formatRankTable(bench));
    if (historyFile) console.log(`\n(history: ${historyFile})`);
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    usage();
    return;
  }
  if (opts.ui) {
    require('./server').start({ port: opts.port });
    return;
  }
  await runCli(opts);
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exitCode = 1;
});
