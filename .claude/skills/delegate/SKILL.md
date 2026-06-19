---
name: delegate
description: Offload a well-scoped sub-task to save tokens — route code investigation, edits, or review to Codex, and cheap drafting / second opinions / summaries to DeepSeek, via the agent-bridge MCP. Use when a subtask is mechanical, self-contained, or parallelizable.
---

# Delegating to Codex & DeepSeek

This repo ships an MCP server (`agent-bridge`, see `tools/agent-bridge-mcp/`) that
lets you hand sub-tasks to two external agents instead of doing everything yourself.
Use it to conserve the main session's tokens on mechanical or parallelizable work.

## Tools (available as `mcp__agent-bridge__*`)

- **`codex_delegate`** — `{ task, mode?, cwd?, effort? }` — runs the Codex CLI agent
  inside this repo. `mode:"analyze"` (default) is read-only and safe; `mode:"edit"`
  lets Codex modify files in the working tree. Returns Codex's final message.
- **`codex_review`** — `{ focus?, cwd? }` — Codex reviews the current `git diff`
  (read-only) for bugs/security/correctness.
- **`deepseek_ask`** — `{ prompt, system?, model?, maxTokens? }` — one-shot DeepSeek
  chat. `model:"deepseek-reasoner"` for hard reasoning, else `deepseek-chat`.

## When to delegate (vs. do it yourself)

Route to **Codex** (`codex_delegate`/`codex_review`):
- Repo-aware investigation: "find where X is wired", "trace this flow"
- Mechanical edits with an exact spec: rename, extract util, add a test file
- A second-opinion code review of your own diff before committing

Route to **DeepSeek** (`deepseek_ask`):
- Drafting copy, error messages, docs, commit text
- Generating boilerplate / sample data from a clear spec
- Summarizing or sanity-checking an approach (cheap second opinion)

**Keep it yourself** (do NOT delegate): architecture & data-model decisions, auth /
guards / billing / cost-control, prod deploys & migrations, anything touching secrets,
or changes whose blast radius spans modules. Delegation is for leaf work, not judgement.

## How to write a good delegation prompt

Make the `task` self-contained — the sub-agent has none of your context:
- name exact file paths to read first,
- state the precise change/question,
- define what "done" looks like,
- list what NOT to touch (so it doesn't fight your in-flight edits).

Always **read the returned diff/answer critically** — you own the result. After an
`mode:"edit"` run, inspect `git diff` and typecheck/build before trusting it.

## Cost & safety

- The product's own DeepSeek endpoints are budget-capped server-side; this MCP's
  `deepseek_ask` is a dev tool — still keep prompts tight.
- `codex_delegate` defaults to read-only; only pass `mode:"edit"` when you intend
  file changes.

## Prerequisites / activation

- MCP loads at Claude Code **startup** — if the tools aren't present, restart Claude
  Code and approve the `agent-bridge` project server.
- Codex: `codex` CLI installed and logged in (`codex login status`).
- DeepSeek: `DEEPSEEK_API_KEY` in `apps/api/.env` (gitignored) or the environment.

### Fallback without the MCP
If the MCP isn't connected yet, the same delegation works from the shell:
```bash
codex exec --sandbox read-only -C "$(pwd)" "your self-contained task"   # Codex
# DeepSeek: POST https://api.deepseek.com/chat/completions with the key from apps/api/.env
```
