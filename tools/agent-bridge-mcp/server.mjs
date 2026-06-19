#!/usr/bin/env node
/**
 * agent-bridge — a tiny MCP server (stdio, JSON-RPC 2.0, zero deps) that lets
 * Claude Code delegate sub-tasks to two external agents during a task:
 *
 *   • Codex      → driven via the `codex exec` CLI (headless, sandboxed).
 *   • DeepSeek   → driven via the chat-completions HTTP API.
 *
 * Why these two: Codex has a real headless CLI and DeepSeek a real HTTP API, so
 * both can be invoked programmatically and return results. (Antigravity is a GUI
 * agent with no headless interface, so it is intentionally not wrapped here.)
 *
 * Secrets: DEEPSEEK_API_KEY is read from the environment, falling back to
 * apps/api/.env so the key never has to be duplicated into MCP config.
 *
 * stdout carries ONLY JSON-RPC messages (newline-delimited). All logging → stderr.
 */
import { spawn } from 'node:child_process';
import { readFileSync, mkdtempSync, readFile, rm } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const SERVER = { name: 'agent-bridge', version: '0.1.0' };
const DEFAULT_PROTOCOL = '2025-06-18';

const log = (...a) => process.stderr.write(`[agent-bridge] ${a.join(' ')}\n`);

// ─── secret loading ──────────────────────────────────────────────────────────
function deepseekKey() {
  if (process.env.DEEPSEEK_API_KEY?.trim()) return process.env.DEEPSEEK_API_KEY.trim();
  try {
    const txt = readFileSync(join(REPO_ROOT, 'apps/api/.env'), 'utf8');
    const m = txt.match(/^\s*DEEPSEEK_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    /* ignore */
  }
  return '';
}
function deepseekBase() {
  return (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
}

// ─── tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: 'codex_delegate',
    description:
      'Delegate a coding/analysis sub-task to the Codex CLI agent (runs in this repo). ' +
      'Use mode="analyze" (read-only, safe) for investigation/answers, or mode="edit" ' +
      '(workspace-write) to let Codex modify files. Returns Codex\'s final message.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        task: { type: 'string', description: 'Self-contained instructions for Codex.' },
        mode: {
          type: 'string',
          enum: ['analyze', 'edit'],
          description: 'analyze = read-only; edit = allowed to modify files. Default analyze.',
        },
        cwd: { type: 'string', description: 'Working directory (absolute). Default: repo root.' },
        effort: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'xhigh'],
          description: 'Reasoning effort. Default medium.',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'codex_review',
    description:
      'Ask Codex to review the current uncommitted changes (git diff) for bugs, security, ' +
      'and correctness. Read-only. Returns Codex\'s review.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        focus: { type: 'string', description: 'Optional area/concern to focus the review on.' },
        cwd: { type: 'string', description: 'Working directory (absolute). Default: repo root.' },
      },
    },
  },
  {
    name: 'deepseek_ask',
    description:
      'Send a prompt to DeepSeek (OpenAI-compatible chat). Good for cheap second opinions, ' +
      'boilerplate generation, drafting, summarization. Returns the model text.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        prompt: { type: 'string' },
        system: { type: 'string', description: 'Optional system instruction.' },
        model: {
          type: 'string',
          enum: ['deepseek-chat', 'deepseek-reasoner'],
          description: 'Default deepseek-chat. Use deepseek-reasoner for hard reasoning.',
        },
        maxTokens: { type: 'number', description: 'Default 2000.' },
      },
      required: ['prompt'],
    },
  },
];

// ─── tool implementations ──────────────────────────────────────────────────────
function runCodex(args, cwd, timeoutMs = 8 * 60 * 1000) {
  return new Promise((res) => {
    const tmp = mkdtempSync(join(tmpdir(), 'codex-'));
    const outFile = join(tmp, 'last.txt');
    const full = [...args, '-o', outFile];
    log(`codex ${full.join(' ')} (cwd=${cwd})`);
    const child = spawn('codex', full, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      res({ ok: false, text: `Codex timed out after ${Math.round(timeoutMs / 1000)}s.` });
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      clearTimeout(timer);
      res({ ok: false, text: `Failed to launch codex: ${err.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      readFile(outFile, 'utf8', (e, data) => {
        rm(tmp, { recursive: true, force: true }, () => {});
        const last = !e && data?.trim() ? data.trim() : '';
        const text =
          last ||
          stdout.trim().slice(-12000) ||
          stderr.trim().slice(-4000) ||
          '(no output)';
        res({ ok: code === 0, text: code === 0 ? text : `[exit ${code}]\n${text}` });
      });
    });
  });
}

async function toolCodexDelegate(a) {
  const task = String(a?.task || '').trim();
  if (!task) return errText('task is required');
  const cwd = a?.cwd && String(a.cwd).trim() ? String(a.cwd) : REPO_ROOT;
  const sandbox = a?.mode === 'edit' ? 'workspace-write' : 'read-only';
  const effort = ['low', 'medium', 'high', 'xhigh'].includes(a?.effort) ? a.effort : 'medium';
  const r = await runCodex(
    ['exec', '-C', cwd, '--sandbox', sandbox, '-c', `model_reasoning_effort="${effort}"`, '--skip-git-repo-check', task],
    cwd,
  );
  return { content: [{ type: 'text', text: r.text }], isError: !r.ok };
}

async function toolCodexReview(a) {
  const cwd = a?.cwd && String(a.cwd).trim() ? String(a.cwd) : REPO_ROOT;
  const focus = a?.focus ? `\nFocus especially on: ${a.focus}` : '';
  const task =
    'Review the current uncommitted changes (run `git diff` and `git status`). ' +
    'Report concrete bugs, security issues, and correctness problems with file:line. ' +
    'Be terse; skip praise.' +
    focus;
  const r = await runCodex(
    ['exec', '-C', cwd, '--sandbox', 'read-only', '-c', 'model_reasoning_effort="high"', '--skip-git-repo-check', task],
    cwd,
  );
  return { content: [{ type: 'text', text: r.text }], isError: !r.ok };
}

async function toolDeepseekAsk(a) {
  const prompt = String(a?.prompt || '').trim();
  if (!prompt) return errText('prompt is required');
  const key = deepseekKey();
  if (!key) return errText('DEEPSEEK_API_KEY not found (env or apps/api/.env)');
  const model = a?.model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
  const maxTokens = Number.isFinite(a?.maxTokens) ? Math.min(8000, Math.max(64, a.maxTokens)) : 2000;
  const messages = [];
  if (a?.system) messages.push({ role: 'system', content: String(a.system) });
  messages.push({ role: 'user', content: prompt });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 120000);
  try {
    const resp = await fetch(`${deepseekBase()}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return errText(`DeepSeek HTTP ${resp.status}: ${body.slice(0, 400)}`);
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content?.trim() || '(empty response)';
    const usage = data?.usage?.total_tokens ? ` [${data.usage.total_tokens} tokens]` : '';
    return { content: [{ type: 'text', text: `${text}${usage}` }] };
  } catch (err) {
    return errText(`DeepSeek error: ${err?.message || err}`);
  } finally {
    clearTimeout(t);
  }
}

function errText(msg) {
  return { content: [{ type: 'text', text: msg }], isError: true };
}

async function callTool(name, args) {
  switch (name) {
    case 'codex_delegate':
      return toolCodexDelegate(args);
    case 'codex_review':
      return toolCodexReview(args);
    case 'deepseek_ask':
      return toolDeepseekAsk(args);
    default:
      return errText(`unknown tool: ${name}`);
  }
}

// ─── JSON-RPC / MCP plumbing ────────────────────────────────────────────────────
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}
function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}
function replyError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  const text = line.trim();
  if (!text) return;
  let msg;
  try {
    msg = JSON.parse(text);
  } catch {
    return;
  }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      reply(id, {
        protocolVersion: params?.protocolVersion || DEFAULT_PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
      });
    } else if (method === 'notifications/initialized' || method === 'initialized') {
      /* notification: no reply */
    } else if (method === 'tools/list') {
      reply(id, { tools: TOOLS });
    } else if (method === 'tools/call') {
      const result = await callTool(params?.name, params?.arguments || {});
      reply(id, result);
    } else if (method === 'ping') {
      reply(id, {});
    } else if (id !== undefined) {
      replyError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    if (id !== undefined) replyError(id, -32603, `Internal error: ${err?.message || err}`);
  }
});

log(`ready (repo=${REPO_ROOT}, deepseek=${deepseekKey() ? 'configured' : 'MISSING'})`);
