# Results

Gallery, review, and scoring for every generated output — the feedback loop that trains the library's quality signals.

## Result Gallery (`/results`)
Grid of every result across all prompts.

### What you can do
- **Top Shots** strip — highest-scored (≥4) results, shown when no filter/score is active
- Search by prompt title/notes; filter by All / Winners / Failed / Unreviewed; filter by provider; filter by min score (Any/3+/4+/5★)
- Sort by newest, oldest, highest score, or winners-first
- Group results by parent prompt instead of a flat grid
- Toggle winner status directly from a card (star icon), or see the auto Failed badge
- Batch-select mode: bulk score, bulk mark winner/failed, bulk delete, export selection (or full filtered view) to CSV
- Click any card to open its detail view

## Result Detail (`/results/view/:id`)
Full review/edit view for one existing result.

### What you can do
- View the stored image or video full-size
- Toggle Winner / Failed status
- Rate Overall (stars) plus Advanced Scoring: Realism, Brand Fit, Composition, Lighting, AI-Look Risk (inverted — lower is better), Reuse potential
- Run the AI Artifact Checklist (16 common AI-look failure patterns) — flags roll up into a count badge
- Write freeform notes (what worked / what failed / what to try next)
- See Context: source prompt + version, provider, owning project(s)/campaign(s), with links
- Set this result as the parent prompt's thumbnail
- Delete the result (two-step confirm)
- Jump back to the prompt, or "Use Prompt Again" to fork it into Prompt Craft

## Add Result (`/results/:promptId`)
Upload flow for attaching a new result to a specific prompt.

### What you can do
- Drag-and-drop or browse an image/video (JPEG/PNG/WEBP ≤25 MiB, MP4/MOV/WEBM ≤300 MiB)
- Score and checklist the result before saving (same Quick Rating + Advanced Scoring + AI Artifact Checklist as Result Detail)
- Save — auto-links the result into every project that owns the prompt, updates token quality/co-occurrence scores from the rating, and recomputes the prompt's result summary
- Save the uploaded image as a standalone Reference instead of/alongside the result
- "Use Prompt Again" to fork the prompt, or cancel back to the prompt detail page
