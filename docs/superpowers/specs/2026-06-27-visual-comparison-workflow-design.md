# Visual Comparison Workflow Design

## Decision

Framecraft Compare will initially support four visual production decisions:

1. Result vs Result
2. Reference vs Result
3. Provider vs Provider
4. Prompt Version vs Prompt Version

SREF comparison and abstract project-direction scoring are deferred until these four workflows are reliable.

## Goal

Compare must help the user choose a stronger generated output, explain the decision, and save the outcome as reusable project intelligence. It is not a generic image viewer.

## Workflow

The user selects a comparison type when creating a session. The active session keeps that type visible and labels each slot according to its role. Existing project results remain the primary source. In Reference vs Result mode, the first imported or selected visual is treated as the reference and the second as the generated result.

The user can mark one winner, reject weak options, add notes, and apply the decision once. Applying generates a concise outcome from the comparison type, winner, rejected items, scores, providers, prompt versions, and notes. The outcome is saved on the comparison session and result winner/failure flags continue to synchronize with the result library.

## Data Model

The existing comparison tables remain compatible through additive columns:

- `comparison_sessions.comparison_type` stores one of the four supported types.
- `comparison_sessions.outcome_summary` stores the durable decision summary.
- `comparison_items.source_role` stores the visual's role in the selected comparison.

Existing sessions default to Result vs Result, and existing items default to Result.

## UI

Session creation uses a compact segmented type selector with a short purpose statement. The active view displays the selected comparison type, role labels, source metadata, and saved outcome. “Apply Decisions” remains the single commit action.

## Error Handling

Applying requires at least one decision. Storage errors remain visible and do not clear local decisions. Unsupported or missing persisted values fall back to Result vs Result and Result roles.

## Testing

Unit tests cover comparison type metadata, role assignment, deterministic outcome generation, and session persistence in the development store. Existing comparison CRUD, full frontend tests, TypeScript compilation, Rust tests, and production build remain required.

