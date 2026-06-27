# Comparison Intelligence Integration Design

## Decision

Comparison outcomes must become project intelligence rather than remaining isolated session records.

## Scope

The project context pack will include comparison session totals, decided and pending counts, and a bounded list of recent saved outcomes. The Project Assistant context panel and AI system context will expose this information. Deterministic guidance will direct users to complete unresolved comparisons when appropriate.

Result review scores and prompt star ratings use five-point scales. Every Assistant label and message that describes either value will use `/5`.

## Data Flow

`comparison_sessions` → `getSessions(projectId)` → `buildContextPack(projectId)` → Project Assistant context, deterministic suggestions, AI context, and export consumers that already use the context pack.

Only saved outcomes are included as intelligence evidence. At most five recent outcomes are passed forward to keep context concise.

## Compatibility

No database migration is required. Projects without comparison sessions receive zero counts and an empty outcome list. Existing comparison and Assistant behavior remains valid.

## Testing

Tests will cover comparison context summarization, unresolved-comparison guidance, and the five-point result score wording. Full frontend, TypeScript, Rust, and production-build verification remains required.
