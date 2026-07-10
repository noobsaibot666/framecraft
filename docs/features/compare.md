# Comparison Lab (`/compare`, `/compare/:projectId`)

Side-by-side judging room for deciding which output wins — pick a comparison type, drop in 2–4 candidates, score them, and write the decision back onto the actual result records.

## Comparison types
Pick what you're actually judging — each changes the slot labels and what the AI Decision weighs:

- **Result vs Result** — pick the strongest generated output
- **Reference vs Result** — did the result follow the intended visual direction?
- **Provider vs Provider** — how differently do providers interpret the same brief?
- **Prompt Version vs Version** — which revision produces the stronger output?
- **Direction vs Result** — does the result deliver the project's chosen creative direction (judged against the project's visual direction/creative goals text)?
- **SREF vs SREF** — how do different style references shape the same idea?
- **AI-Look Risk** — rank by how synthetic a result reads; keep the most authentic

## What you can do
- Start a new comparison session (named, typed) or reopen a saved one — sessions persist and can be revisited, optionally scoped to a project
- Fill 2 or 4 slots (2-up / 4-up layout toggle) by picking from the project's existing results, or by dropping/uploading a new image or video directly (auto-creates a prompt + result so it's trackable like everything else)
- Each slot shows the full review scorecard (realism, brand fit, composition, lighting), flagged AI artifacts, best/weakest dimension, and an AI-risk badge
- Mark a slot **Winner** or **Reject**, with freeform notes per slot
- **Dimension Breakdown** table — once 2+ slots are filled, compares every scored dimension side by side and highlights the top score per row
- **AI Decision** — sends the filled slots to the model for a judged verdict: stronger option, why, what failed, what to reuse, what to avoid, plus direction-aware intelligence when comparing against a project's creative direction
- **Apply** — writes your Winner/Reject picks back onto the underlying result records (`is_winner`/`is_failed`), so a comparison decision actually changes what shows up as a winner elsewhere in the app
- Save the outcome as a short text summary on the session (editable anytime), independent of applying decisions
- Delete a session (two-step confirm)
