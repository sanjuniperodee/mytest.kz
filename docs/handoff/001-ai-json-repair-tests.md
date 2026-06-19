# 001 — Unit tests for DeepSeek JSON repair

**Owner:** Codex / Antigravity · **Status:** open

## Goal
Add Jest unit tests that lock in the behaviour of the DeepSeek JSON-repair logic
(the code that lets LaTeX-heavy lesson responses parse). No behaviour changes — only
make the helpers testable and cover them.

## Context — read first
- `apps/api/src/modules/ai/infrastructure/deepseek.client.ts`
  - bottom of the file: functions `repairJsonString(text)` and `tryParse(text)`.
  - `repairJsonString` escapes non-structural backslashes (`\sqrt` → `\\sqrt`) and
    strips trailing commas; it is only applied after a clean `JSON.parse` fails.
- Test style to match: `apps/api/test/mistakes-service.http.spec.ts` (plain Jest,
  `describe`/`it`, no Nest bootstrapping). Test config: `apps/api/test/jest-e2e.json`.

## Spec
1. In `deepseek.client.ts`, add `export` to `repairJsonString` (keep it a plain
   module function — do NOT move it into the class). Leave everything else unchanged.
2. Create `apps/api/test/deepseek-json-repair.spec.ts` covering:
   - **Valid JSON is untouched:** `repairJsonString('{"a":1}')` still parses to `{a:1}`,
     and a string with an intentional `\\n` newline escape is preserved.
   - **LaTeX with single backslashes** becomes parseable and keeps the LaTeX intact:
     input `{"latex":"\frac{1}{2}+\sqrt{x}=\alpha"}` (use `String.raw`) → after repair,
     `JSON.parse(...).latex === '\\frac{1}{2}+\\sqrt{x}=\\alpha'` (i.e. literal
     `\frac{1}{2}+\sqrt{x}=\alpha`).
   - **Inline math delimiters** `\( ... \)` survive: input
     `{"note":"при \( x>0 \)"}` parses after repair.
   - **Trailing comma** before `}` and `]` is removed:
     `{"a":1,}` and `{"xs":[1,2,]}` parse after repair.
   - **Structural escapes preserved:** `\"` and `\/` are not double-escaped
     (`{"q":"\"hi\""}` after repair still parses, value `"hi"`).
3. Do not change `parseJson`, the class, prompts, or any other file.

## Acceptance
- `apps/api/test/deepseek-json-repair.spec.ts` exists with the cases above.
- Only change in `deepseek.client.ts` is the added `export` keyword.
- All assertions pass.

## Verify
```bash
cd apps/api
npx tsc --noEmit
npm run test:api -- deepseek-json-repair
```

## Out of scope
- Do NOT touch `ai-coach.service.ts`, `ai-quota.service.ts`, prompts, or the
  frontend — Claude has in-flight work there.
- No new dependencies.
