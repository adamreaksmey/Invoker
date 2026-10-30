# Dogfood: Expand Cursor worker model allowlist

## Goal

Update Invoker's Cursor execution agent so it can run the named cheap Cursor models, not only `grok-4.5`.

## File

`packages/execution-engine/src/agents/cursor-execution-agent.ts`

## Required model IDs

`CURSOR_SUPPORTED_MODELS` must list these exact IDs (labels may be human-readable):

- `grok-4.5`
- `kimi-k2.7-code`
- `kimi-k3-high`
- `deepseek-v41-flash-1017-high`
- `glm-5.2-high`

## Acceptance rule for `supportsModel`

- Accept exactly those IDs, after `trim()` and lowercasing.
- Reject every other ID (including family lookalikes such as `kimi-foo`, `deepseek-chat`, `glm-4`).
- Do not switch to substring / prefix matching.

## Tests and docs

Update `packages/execution-engine/src/__tests__/cursor-execution-agent.test.ts` so the supported/rejected cases match the rule above. Update any doc in this repo that names the Cursor execution model list if one exists.

## Safety invariant

Only `CursorExecutionAgent`'s model allowlist changes. Unknown model IDs are still rejected, `grok-4.5` keeps working, and the cursor command args are unchanged, so no existing routing or command shape changes.

## Verification (agent-visible)

Run:

```bash
pnpm install --frozen-lockfile && cd packages/execution-engine && pnpm test
```

Both install and the package tests must pass. Commit your changes with git.

Do it locally: do not use Invoker, invoker-cli, or any other delegation.
