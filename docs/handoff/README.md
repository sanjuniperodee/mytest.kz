# Agent handoff briefs

Self-contained task specs that **Codex** / **Antigravity** can execute without the
originating Claude conversation. Claude (architecture + risky/integration work)
writes a brief here; you paste it into Codex/Antigravity (or point the agent at the
file) and it runs the task on its own quota. This keeps expensive context-heavy
reasoning on one agent and cheap mechanical work on another.

## What to route where

**Good for Codex / Antigravity** (mechanical, well-bounded, low cross-cutting context):
- Unit / e2e tests for already-written pure functions
- Mechanical refactors (rename, extract util, move file) with an exact target
- i18n / translation passes over fixed string sets
- Repetitive CRUD endpoints/components that mirror an existing example
- Docs, JSDoc, type annotations

**Keep on Claude** (judgement, blast radius, money/security):
- Architecture & data-model decisions
- Auth, guards, billing, cost-control, migrations on prod
- Anything touching prod deploy or secrets
- Cross-module changes where one wrong assumption breaks several places

## Brief format

Each brief is `NNN-slug.md` with:
1. **Goal** — one sentence.
2. **Context** — exact file paths to read first.
3. **Spec** — precise, unambiguous steps.
4. **Acceptance** — how "done" is defined.
5. **Verify** — exact commands to run.
6. **Out of scope** — what NOT to touch (avoids stepping on Claude's in-flight work).

## Status

- `001-ai-json-repair-tests.md` — open
