---
title: Comparison Lab
description: Judging candidate outputs side by side and recording the decision.
---

# Comparison Lab (`/compare`, `/compare/:projectId`)

A side-by-side judging room for deciding which output wins — pick a comparison type, drop in 2–4 candidates, score them, and write the decision back onto the actual result records.

## Comparison Types

Pick what you're actually judging — each type changes the slot labels and what the AI Decision weighs:

- **Result vs Result** — pick the strongest generated output
- **Reference vs Result** — did the result follow the intended visual direction?
- **Provider vs Provider** — how differently do providers interpret the same brief?
- **Prompt Version vs Version** — which revision produces the stronger output?
- **Direction vs Result** — does the result deliver the project's chosen creative direction?
- **SREF vs SREF** — how do different style references shape the same idea?
- **AI-Look Risk** — rank by how synthetic a result reads, and keep the most authentic

## What You Can Do

- Start a new comparison session (named, typed) or reopen a saved one — sessions persist, and can optionally be scoped to a project
- Fill 2 or 4 slots (2-up / 4-up layout toggle) from the project's existing results, or by dropping/uploading a new image or video directly — this auto-creates a prompt and result so it stays trackable like everything else
- Each slot shows the full review scorecard (realism, brand fit, composition, lighting), flagged AI artifacts, best/weakest dimension, and an AI-risk badge
- Mark a slot **Winner** or **Reject**, with freeform notes per slot
- **Dimension Breakdown** table — once 2+ slots are filled, compares every scored dimension side by side and highlights the top score per row
- **AI Decision** — sends the filled slots to the model for a judged verdict: stronger option, why, what failed, what to reuse, what to avoid, plus direction-aware intelligence when comparing against a project's creative direction
- **Apply** — writes your Winner/Reject picks back onto the underlying result records, so a comparison decision actually changes what shows up as a winner elsewhere in the app
- Save the outcome as a short text summary on the session (editable anytime), independent of applying decisions
- Delete a session (two-step confirm)

## What Happens After You Apply

Applying a decision does more than flip a flag on the result you picked. It recomputes the summary for every prompt touched by the applied slots, and — if you save the AI Decision as the session outcome — turns its "what to avoid" list into learned avoidance-pattern entries that resurface later in Prompt Craft's AI-Look Avoidance panel. See [Application Intelligence](/framecraft/technical/application-intelligence/) for the full wiring.
