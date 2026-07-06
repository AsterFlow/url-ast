# Changelog

## [4.1.2] - 2026-07-06

### Fixed

- Default values declared with `=` are now applied at runtime in instance mode. When a query parameter or path variable is omitted from the concrete URL, its `=default` is cast and returned instead of the key being dropped (e.g. template `?page.number=1` against `/users` yields `{ page: 1 }`, and `/users/:id.number=42` against `/users` yields `{ id: 42 }`). This aligns the runtime with the documented behavior and the inferred TypeScript types, which already treat a defaulted key as present.

## [4.1.1] - 2026-07-06

### Fixed

- Bundlers (webpack / Turbopack) failed to build `url-ast/browser` with `Module not found: Can't resolve 'wasm_bg.wasm'`. The wasm-bindgen glue's default `new URL('wasm_bg.wasm', import.meta.url)` was resolved statically relative to `dist/browser/browser.js`, where the binary does not live. The build now retargets that default to the shared `dist/wasm/wasm_bg.wasm` — without copying the 67 KB binary next to the bundle, so the browser bundle stays lightweight (single WASM artifact).

## [4.1.0] - 2026-07-06

### Added

- **Browser & edge support.** A new `url-ast/browser` entry runs the Rust/WASM engine without any Node components, via an async `initWasm(input?)` that loads the binary from a URL, `Response`, bytes or a compiled module.
- The raw WASM binary is now reachable at `url-ast/wasm/wasm_bg.wasm` for `?url`-style asset imports.
- `initWasm` and `isWasmAvailable` are exported from the root as well.

### Changed

- Serialization moved off the Node-only `Buffer` API onto web-standard `Uint8Array` / `DataView` / `TextEncoder` / `TextDecoder`, so the engine runs anywhere. `getBuffer()` now returns `Uint8Array` (a `Buffer` is one, so most callers are unaffected); `writeToBuffer` / `fromBuffer` widen their parameter from `Buffer` to `Uint8Array`.
- `package.json` conditional exports keep Node's zero-config synchronous init while bundlers resolve the browser build.

### Compatibility

- Fully backward compatible with v4.0.0 on Node. The only behavioral change is `getBuffer()` returning `Uint8Array` instead of `Buffer`.

## [4.0.0] - 2026-07-06

### Changed

- **Parsing engine rewritten in Rust and compiled to WebAssembly.** The scanner and AST builder now run in a Rust/WASM core; the TypeScript layer became a thin bridge that decodes the shared-memory buffer the engine returns.
- The published bundle is **Node-targeted**: the WASM module (`dist/wasm/wasm_bg.wasm`) is loaded synchronously at import via `node:fs`. Node **≥ 20** is required.
- Benchmark suite replaced — it now measures the raw WASM engine instead of the old TypeScript parser.

### Added

- `dist/wasm/` component in the distribution, produced by `cargo build` → `wasm-bindgen --target web` → `wasm-opt` (see `scripts/build-wasm.sh`).
- CI compiles the WASM engine before running type-check, lint and tests.

### Removed

- Stale `PUBLISHING` guide and the obsolete `wasm` dev dependency.

### Compatibility

- **No source changes required.** Template syntax and the public API (`Analyze`, `AST`, `parse`, `parseAndAnalyze`, `ErrorLog`) are unchanged from v3.

## [3.0.1] - 2026-03-30

### Changed

- Updated the README and added a sourcemap to the published npm package.

## [3.0.0] - 2026-03-25

### Added

- Type annotation syntax using the `.` operator in path segments and query parameters (e.g., `/users/:id.number` and `?page.number`).
- `=` operator as a default value initializer for variables and query parameters (in conjunction with `.type`, when applicable).
- `~` operator to mark parameters or segments as optional (possibly `undefined`), e.g., `/posts/[~slug]`.
- Enumerated type support in inference (`enum[...]` / `enum`).
- `src/types/ast.ts` types module with AST structure and JSON formats (`NodeJSON`, `ASTJSON`, etc.) aligned with more standard AST conventions.
- Build process migrated to **esbuild** (CJS/ESM), targeting **ES2024**, with an auxiliary bundle for `decodeURL` (since `decodeURL` previously contained thousands of `\n` characters).

### Changed

- The AST has been **redesigned**: the tree now uses stronger abstractions (node types and internal expressions), rather than mirroring each operator/token in an overly granular way.
- Grammar delimiters and symbols reorganized: `Delimiters` and `EncodingSymbols` were replaced by `ParameterDelimiters`, `DynamicVariableDelimiters`, `GeneralDelimiters`, `Operators`, and `CatchAllExpression`.
- Internal expressions renamed/restructured (e.g., `Null` → `None`, `Value` → `Type`, new states for dynamic and *catch-all* segments); `ContentTypes.Array` numerically adjusted.
- TypeScript inference for `ParseParams` / `ParseSearch` / `TypeMap` updated to support the new syntax (`.type`, `=default`, `~`, and `enum`).
- Renamed the `displayErrors()` method to `formatErrors()` in the `Analyze` class and types.
- Renamed the `display()` method to `toString()` in the `AST` and `ErrorLog` classes, adopting a more language-native standard for string conversion.

### Removed

- The old syntax that **only** used `=` for type annotations in path parameters (e.g., `:id=number`); the typing role has migrated to `.`.