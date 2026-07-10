# Generation Queue (`/queue`)

Staging area for prompts you're about to send to a provider — batch, track status, and pull results back in.

## What you can do
- Add one or more library prompts to the queue via a checklist modal
- Reorder by drag handle, or jump a card straight to the top
- Pin items to keep them at the top regardless of manual order
- Copy a single prompt, or copy all pending prompts joined for batch pasting
- Open a card's provider directly (Midjourney/DALL·E/Firefly/Ideogram/Flux/etc.) — auto-marks it "sent"
- Import a result onto a specific card (file picker or drag-and-drop the image/video onto the card)
- Bulk-import multiple result files at once, auto-matched to queue cards by filename
- Mark all "sent" items done in one action
- Retry a failed item (resets to pending) or skip it
- Clear all completed (done/skipped) items
- Filter by status tab, filter by name search, or toggle-hide completed items
- Scope the whole queue to one project via `?project=` param

## Header actions
Bulk Import · Copy Pending · Mark Sent Done (count) · Clear Completed · Add Prompts

## Card actions — left to right
1. **Position + drag handle** — queue order number, drag to reorder.
2. **Title, provider badge, status badge** — pinned items show a pin icon.
3. **Prompt text preview.**
4. **Move to top** (hidden until first item) · **Pin/Unpin** · **Copy** · **Open in provider** (marks sent) · **Import result** · **Mark done** · **Retry** (if failed) or **Skip**.

## Statuses
Pending → Sent → Done, with Failed (retryable) and Skipped as side states. Status tabs above the list show live counts for each.
