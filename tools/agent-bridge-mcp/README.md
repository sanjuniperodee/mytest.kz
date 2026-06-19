# agent-bridge MCP

A zero-dependency stdio MCP server that lets Claude Code delegate sub-tasks to
two external agents **during** a task, to save Claude tokens on mechanical work:

| Tool | Backend | Use for |
|------|---------|---------|
| `codex_delegate` | `codex exec` CLI (sandboxed) | code investigation (`mode:"analyze"`, read-only) or edits (`mode:"edit"`, workspace-write) |
| `codex_review` | `codex exec` (read-only) | review the current `git diff` for bugs/security |
| `deepseek_ask` | DeepSeek chat API | cheap second opinions, drafting, boilerplate, summaries |

> **Antigravity is intentionally not wrapped** — it is a GUI agent with no headless
> interface, so it can't be driven from code. DeepSeek replaces it as the second
> programmatic delegate.

## Requirements
- **Codex tools:** the `codex` CLI installed and logged in (`codex login status` →
  "Logged in"). No API key needed (uses Codex's own auth).
- **DeepSeek tool:** `DEEPSEEK_API_KEY` in the environment **or** in `apps/api/.env`
  (the server reads that file automatically — no secret is stored in MCP config).
  Optional: `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com`).

## Activation
Registered in the repo's `.mcp.json`. Claude Code loads MCP servers **at startup**,
so after adding/changing it you must **restart Claude Code** (and approve the
project server when prompted). Tools then appear as `mcp__agent-bridge__*`.

## Manual smoke test
```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node tools/agent-bridge-mcp/server.mjs
```

## Notes
- `codex_delegate` defaults to **read-only**; pass `mode:"edit"` only when Codex
  should change files. Edits land in your working tree — review the diff.
- All logging goes to stderr; stdout is pure JSON-RPC.
- Long Codex runs are capped at 8 minutes; DeepSeek calls at 2 minutes.
