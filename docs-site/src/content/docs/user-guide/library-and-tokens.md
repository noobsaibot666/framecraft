---
title: Library, Tokens, and Recipes
description: The Prompt Library, Token Library, and Recipes workflows.
---

# Library, Tokens, and Recipes

## Prompt Library

The Prompt Library is where every saved prompt lives, with search, filtering, and batch operations:

- Shift-click range selection, with a batch toolbar for rate/mark-winner/mark-failed/export/delete
- Result-thumbnail carousel and version-count badge per card
- Project/campaign badges pulled from batched queries so cards don't fire one lookup per row

## Token Detail

Every token used across your library has its own detail view (`/tokens/:id`): usage stats, quality score, its top partner combinations (co-occurrence pairs that tend to appear together in winning prompts), and the full list of prompts that use it. A library-wide **Top Patterns** card surfaces the strongest combinations across everything you've written.

Token quality scoring is one of Framecraft's most complete learning loops — see [Application Intelligence](/framecraft/technical/application-intelligence/) for exactly how it's wired.

## Recipes (`/recipes`)

Reusable prompt templates with fill-in slots — build once, apply many times into Prompt Craft.

### What You Can Do

- Browse all recipes as cards: title, provider, category, rating, prompt preview, tags, and apply count
- Search, filter by provider, and sort by recent, rating, or alphabetically
- Copy a recipe's raw prompt text, or open it straight into Prompt Craft as a fork
- Import or export recipe packs as JSON (`{ version, recipes: [...] }`)
- **Extract a recipe directly from any existing prompt** — auto-detects `[Slot]` placeholders and Midjourney flags, editable before saving
- Build or edit a recipe with typed slots — `[Subject]` (required), `[Mood?]` (optional), and auto-detected parameters like `--ar [Aspect Ratio]`
- Apply a recipe by filling in each slot, watching a live reconstructed preview, then sending the finished prompt into Prompt Craft as a new draft (this increments the recipe's use count)
- Delete a recipe from the library grid or the editor's danger zone

### Recipe Editor (`/recipes/new`, `/recipes/:id/edit`)

Identity (title, description, provider, category), a free-text Prompt Template with an Insert Slot button, a live Detected Slots panel (toggle required/optional, remove), and a slot-syntax reference panel.

### Recipe Apply (`/recipes/:id/apply`)

Two columns: fill in each detected slot on the left (required slots are validated on submit), with a live-reconstructed prompt preview on the right. Applying sends the filled prompt into Prompt Craft, pre-titled `"<Recipe> Draft"`.
