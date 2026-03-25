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

### Removed

- The old syntax that **only** used `=` for type annotations in path parameters (e.g., `:id=number`); the typing role has migrated to `.`.