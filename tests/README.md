# Testing Guide

This guide is for contributors adding tests to the tripletex-mcp fork. Keep tests small, focused, and colocated with the structure of the source tree.

## Conventions

- **One test file per exported function**, grouped by source file into a subdirectory. Current pattern: `tests/tripletex-transform/<function-kebab-name>.test.ts`.
- **Explicit imports**: `import { describe, it, expect } from 'vitest'`. Globals are disabled in `vitest.config.ts`, so imports are required.
- **`.js` extensions on module imports**, even for TS sources (NodeNext resolution):

  ```ts
  import { buildOrderBody } from '../../src/tripletex-transform.js';
  ```

- **Typed inputs**: use the public type exports from the source file (`CreateOrderInput`, `OrderLineInput`, etc.). No `any`, no `!` non-null assertions.

## What to test

Three layers, in priority order:

1. **Pure transforms (`src/tripletex-transform.ts`)** — covered. Any new transform must ship with a sibling test file.
2. **Client layer (`src/tripletex-client.ts`)** — not yet tested. Future PRs will add mocked-fetch tests here (session refresh, 401 retry, future 429 backoff, error envelope parsing).
3. **Tool handlers (`src/tripletex-tools.ts`)** — each tool invokes client methods; most coverage will come from mocked-client integration tests rather than per-tool unit tests.

## How to add a test file

1. Read the source function; note all inputs, outputs, optional paths, and invariants.
2. Create `tests/<source-area>/<kebab-function-name>.test.ts`.
3. Use `describe()` blocks for happy path, optional-field matrix, edge cases, and invariants.
4. Prefer deep-equality on whole output (`expect(result).toEqual(expected)`) over asserting individual fields — makes the intended shape obvious.
5. Use `it.each` for parametric tests (varying a single dimension like sign of amount, number of lines, etc.).
6. Don't mock unless the function under test actually depends on I/O. Pure functions deserve pure tests.

## Running locally

```bash
npm test                # full run
npm run test:watch      # dev loop
npm run test:coverage   # with coverage HTML in coverage/index.html
```

## CI

Every pull request and push to `main` runs typecheck + tests + build on Node 22 (Ubuntu). Fail-fast behavior; no retries.

## Philosophy

Favor many small focused tests over a few large ones. The transform layer in particular is the closest point to Tripletex v2's request shapes — if a test here fails, the fix is either in the transform (code bug) or the Tripletex API contract has drifted (rare).
