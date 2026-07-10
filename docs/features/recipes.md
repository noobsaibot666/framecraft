# Recipes (`/recipes`)

Reusable prompt templates with fill-in slots — build once, apply many times into Prompt Craft.

## What you can do
- Browse all recipes as cards: title, provider, category, rating, prompt preview, tags, apply count
- Search, filter by provider, and sort (recent/rating/alpha)
- Copy a recipe's raw prompt text, or open it straight into Prompt Craft as a fork
- Import/export recipe packs as JSON (`{ version, recipes: [...] }`)
- Extract a recipe directly from any existing prompt (via the Extract Recipe panel on a prompt's detail view) — auto-detects `[Slot]` placeholders and Midjourney flags, editable before saving
- Build or edit a recipe template with typed slots: `[Subject]` required, `[Mood?]` optional, `--ar [Aspect Ratio]` auto-detected parameters
- Apply a recipe — fill in each slot's value, watch a live reconstructed preview, then send the finished prompt into Prompt Craft as a new draft (increments the recipe's use count)
- Delete a recipe (from the library grid or the editor's danger zone)

## Recipe Library — page actions
Import · Export · New Recipe

## Recipe Editor (`/recipes/new`, `/recipes/:id/edit`)
- **Identity** — title, description, provider, category
- **Prompt Template** — free-text template; Insert Slot button inserts `[Label]`/`[Label?]` at cursor
- **Detected Slots** panel (right) — live list of slots found in the template; toggle required/optional, remove
- **Slot Syntax** reference panel
- Save creates or updates the recipe; Apply jumps to the apply flow; Danger zone deletes (edit mode only)

## Recipe Apply (`/recipes/:id/apply`)
Two-column: fill in each detected slot on the left (required slots validated on submit), live-reconstructed prompt preview on the right. Apply sends the filled prompt to Prompt Craft pre-titled `"<Recipe> Draft"`.
