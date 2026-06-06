---
name: Expo pnpm monorepo setup
description: Gotchas adding Expo SDK 56 to this pnpm workspace — package versions, flags, port conflicts, metro config.
---

## Rules

**typedRoutes causes crash.** `"experiments": { "typedRoutes": true }` in app.json triggers `Cannot find module 'expo-router/internal/routing'` when expo-router-server tries to do TypeScript type generation. Remove it entirely.

**`--non-interactive` not supported.** Use `CI=1` env var prefix instead: `CI=1 npx expo start --web --port 9000`.

**Port 8080 is used** by another process in this workspace. Use port 9000 for Expo web. Port 8081 is used by mockup-sandbox.

**expo-system-ui version.** SDK 56 uses `^56.0.5` (not `~4.1.7` which doesn't exist). New Expo versioning scheme matches SDK number.

**react-native-web required for web mode.** Must install `react-native-web@^0.21.2` and `@expo/metro-runtime@^56.0.14` (not `~4.0.1`). Expo SDK 56 requires metro-runtime `^56.0.x`.

**react-native-screens peer dep.** expo-router 5.x requires `react-native-screens@>=4.0.0`; install explicitly.

**metro.config.js required for pnpm workspace.** Add:
```js
const config = getDefaultConfig(__dirname);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
```

**package.json `main` field.** Must be `"expo-router/entry"` (not `"index.ts"`). Change via `node -e` script since skill says never edit package.json directly.

**`/api/klines` is single-symbol.** Use `useQueries()` to fetch multiple symbols in parallel from `/api/klines?symbol=X&interval=1d&limit=2`; there is no `/api/klines/multi` endpoint.

**Workflow command:** `cd artifacts/TradeLab && CI=1 npx expo start --web --port 9000`, outputType: "console", waitForPort: 9000.

**Why:** pnpm's strict package isolation + Expo's module resolution don't play well without explicit metro config. The typedRoutes feature relies on an internal expo-router path that pnpm doesn't hoist correctly.
