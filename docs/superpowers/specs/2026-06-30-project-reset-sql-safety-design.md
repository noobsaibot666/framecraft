# Project Reset SQL Safety Design

## Scope

Resolve the first open item in `codereview/REPORT.md`: document and test the hand-rolled SQL escaping used by `executeProjectResetTransaction` without changing project-reset behavior or touching the two React hook items.

## Context

Project resets use two database adapters. The native adapter exposes `executeBatch`, which executes the entire reset on one SQLite connection and therefore preserves transaction atomicity. Its batch API does not accept bind parameters. The plugin-backed adapter has no batch method and uses the existing parameterized `execute` fallback on its persistent connection.

Replacing the native batch path with repeated `execute` calls is unsafe because the native adapter opens a new SQLite connection for each invocation. `BEGIN`, the deletes, and `COMMIT` would not share a transaction.

## Design

Keep both execution paths. Extract the batch SQL construction into a focused helper that applies SQLite string-literal quoting to every interpolated value. Add a comment at the interpolation boundary explaining the risk, the lack of batch bind parameters, and the requirement that all future interpolated values pass through the quoting helper.

Export the helper as a focused production function so Vitest can inspect the same generated batch that `executeProjectResetTransaction` executes, without requiring a Tauri runtime. This avoids introducing a test-only production API.

## Error Handling and Compatibility

The native path remains one atomic `BEGIN`/`COMMIT` batch. The plugin path remains parameterized and retains its rollback attempt. No schema, migration, or public application API changes are introduced.

## Testing

Add focused tests that verify:

- apostrophes are doubled in SQLite string literals;
- SQL-shaped payloads remain inside a single quoted literal;
- every occurrence of the project ID in the batch uses the escaped literal;
- the generated SQL retains its explicit transaction boundaries.

Run the focused test, the full Vitest suite, TypeScript checking, and the production build.
