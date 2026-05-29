---
name: api-client-react dist build
description: The api-client-react lib needs its dist/ emitted via tsc before the trade-backtest tsc --noEmit passes, even though the package exports source directly.
---

The `lib/api-client-react` package exports `./src/index.ts` directly (no runtime build step), but `artifacts/trade-backtest/tsconfig.json` uses `"references"` pointing at it as a composite project. TypeScript requires the `dist/` declaration files to exist for composite project references to work.

**Rule:** Before running `tsc --noEmit` in `artifacts/trade-backtest`, first run:
```
pnpm exec tsc -p lib/api-client-react/tsconfig.json
```
This emits only `.d.ts` files into `lib/api-client-react/dist/` and fixes all TS6305 cascade errors.

**Why:** The tsconfig has `"composite": true` and `"emitDeclarationOnly": true` — it only needs the declaration files, not a JS bundle.
