---
title: Results and Generation Queue
description: Reviewing generated results and staging prompts for generation.
---

# Results and Generation Queue

## Generation Queue (`/queue`)

A staging area for prompts you're about to send to a provider — batch them, track status, and pull results back in.

### What You Can Do

- Add one or more library prompts to the queue via a checklist modal
- Reorder by drag handle, or jump a card straight to the top
- Pin items to keep them at the top regardless of manual order
- Copy a single prompt, or copy all pending prompts joined together for batch pasting
- Open a card's provider directly (Midjourney, DALL·E, Firefly, Ideogram, Flux, and others) — this auto-marks it "sent"
- Import a result onto a specific card, via file picker or by dragging the image/video onto the card
- Bulk-import multiple result files at once, auto-matched to queue cards by filename
- Mark all "sent" items done in one action
- Retry a failed item (resets to pending) or skip it
- Clear all completed (done/skipped) items
- Filter by status tab or name search, or toggle-hide completed items
- Scope the whole queue to one project via a `?project=` URL param

### Statuses

Pending → Sent → Done, with Failed (retryable) and Skipped as side states. Status tabs above the list show live counts for each.

## Results Gallery (`/results`)

A grid of every generated result across all prompts — the feedback loop that trains the library's quality signals.

### What You Can Do

- **Top Shots** strip — highest-scored (4★+) results, shown when no filter or score is active
- Search by prompt title or notes; filter by All / Winners / Failed / Unreviewed; filter by provider; filter by minimum score
- Sort by newest, oldest, highest score, or winners-first
- Group results by parent prompt instead of a flat grid
- Toggle winner status directly from a card, or see the auto Failed badge
- Batch-select mode: bulk score, bulk mark winner/failed, bulk delete, export the selection (or the full filtered view) to CSV

## Result Detail (`/results/view/:id`)

The full review/edit view for one existing result:

- View the stored image or video full-size
- Toggle Winner / Failed status
- Rate Overall (stars) plus Advanced Scoring — Realism, Brand Fit, Composition, Lighting, AI-Look Risk (inverted, lower is better), Reuse potential
- Run the AI Artifact Checklist — 16 common AI-look failure patterns, rolled up into a count badge
- Write freeform notes: what worked, what failed, what to try next
- See Context — source prompt and version, provider, owning project(s)/campaign(s), with links
- Set this result as the parent prompt's thumbnail
- Delete the result (two-step confirm)
- Jump back to the prompt, or "Use Prompt Again" to fork it into Prompt Craft

## Add Result (`/results/:promptId`)

The upload flow for attaching a new result to a specific prompt:

- Drag-and-drop or browse an image/video (JPEG/PNG/WEBP up to 25 MiB, MP4/MOV/WEBM up to 300 MiB)
- Score and checklist the result before saving — the same Quick Rating, Advanced Scoring, and AI Artifact Checklist as Result Detail
- Saving auto-links the result into every project that owns the prompt, updates token quality/co-occurrence scores from the rating, and recomputes the prompt's result summary
- Save the uploaded image as a standalone Reference instead of, or alongside, the result
- "Use Prompt Again" to fork the prompt, or cancel back to the prompt detail page
