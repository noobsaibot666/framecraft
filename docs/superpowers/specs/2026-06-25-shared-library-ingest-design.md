# Shared Library Ingest Design

## Goal

Allow multiple machines to submit reference and result image imports into one shared `.framecraftlib` without allowing concurrent direct SQLite writes.

## Scope

V9 first slice supports shared ingestion for:

- Reference image imports.
- Result image imports linked to an existing prompt.

It does not move prompt editing, project editing, scoring updates, settings, or queue changes into shared jobs yet.

## Architecture

Framecraft keeps the portable `.framecraftlib` package and adds three shared directories:

- `inbox/`: append-only job files written atomically by any connected machine.
- `staging/`: media files written before the job is published.
- `sync/applied/` and `sync/failed/`: merge history and recoverable failures.

Any machine may write media into `staging/` and publish a job by writing a temporary file, then renaming it into `inbox/`. Only the merge processor applies jobs to `framecraft.db`. The existing library lock remains the guard for direct database ownership and for merge processing.

## Job Format

Every job contains:

- `schema_version`: `1`.
- `job_id`: unique file/job id.
- `kind`: `reference.import` or `result.import`.
- `idempotency_key`: stable duplicate-prevention key.
- `created_at`.
- `created_by`: machine and user.
- `payload`: metadata plus staged relative media paths.

Reference payload stores reference metadata, staged original path, and staged thumbnail path.
Result payload stores result metadata, required `prompt_id`, staged original path, and staged thumbnail path.

## Merge Rules

The merge processor reads inbox jobs in filename order. For each job it:

1. Validates schema, kind, idempotency key, and safe relative paths.
2. Checks if the idempotency key was already applied.
3. Verifies staged media exists.
4. For result jobs, verifies `prompt_id` exists.
5. Copies staged media into final `references/` or `results/` paths.
6. Inserts the SQLite row with final media paths.
7. Records the job as applied and removes it from inbox.

Failures are written to `sync/failed/` with the original job and a clear reason.

## Safety

Direct concurrent SQLite writes on NAS are not part of V9 because SQLite over shared folders is fragile across OS, SMB/NAS behavior, and lock semantics. The shared workload model is append-only file submission plus serialized merge.

Path safety is strict: no absolute paths, backslashes, `.` components, or `..` components inside job media paths. All staged paths are relative to `staging/`.

Idempotency prevents duplicate records when a job is retried, copied twice, or processed after a crash.

## Testing

Tests must cover:

- Shared path resolution.
- Job validation and unsafe path rejection.
- Atomic job publication shape.
- Two simulated machines publishing unique jobs.
- Reference merge success.
- Result merge success.
- Duplicate idempotency handling.
- Missing prompt failure.
- Missing staged media failure.

