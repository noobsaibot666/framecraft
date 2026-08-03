---
title: Prompt Craft
description: Build, assemble, and save AI image/video prompts.
---

# Prompt Craft

Prompt Craft (`/craft`) is the core prompt-authoring page — build, assemble, and save one AI image or video prompt at a time.

## What You Can Do

- Create a new prompt, or edit an existing one (editing forks a new version rather than overwriting)
- Build field-by-field in **Builder mode**, or write/paste free text in **Manual mode**
- Pull from the Token Library — proven combinations, recipe matches, project-scoped tokens, and the full token cloud
- Auto-detect AI-look artifacts and apply one-click corrections, with a live risk score
- Lock elements that must stay stable across variations with the **Consistency Factor**
- Set provider-specific parameters, with SREF/Profile suggestions drawn from your own usage history
- Preview, hand-edit, auto-format, and copy the final paste-ready prompt
- Get AI critique, a one-click rewrite, and an image-to-prompt description assist
- Save to the library, save as a recipe, or fork a new version
- See duplicate and inconsistency warnings before you save

## Header Actions

Back to library/project · Copy · Format · Save as Recipe · Save/Update · New Version · Reset

## Left Column, Top to Bottom

1. **Project context banner** — shown only when launched from a project; shows brief, direction, and provider/aspect targets with a link back
2. **Duplicate warning** — flags similar existing prompts
3. **Identity** — title, description, provider, category, aspect ratio, use case, and the provider's success-formula bar
4. **Prompt** — Builder mode (structured fields) or Manual mode (free text), with live inconsistency/provider-mismatch warnings
5. **Token Library** — sequence builder, proven combinations, recipe suggestions, project token suggestions, and the full token cloud (39 categories, ordered to match the fields above)
6. **AI-Look Avoidance** — a risk-scored artifact detector with one-click corrections; auto-fills Midjourney's `--no` flag
7. **Consistency Factor** — pick or type elements that must hold stable across variations; carried through on copy, ordered correctly ahead of provider flags

## Right Column, Top to Bottom

1. **Parameters** — provider-specific controls (Midjourney, DALL·E, Stable Diffusion, and others); Midjourney's SREF Code and Profile fields suggest codes from similar or winning prompts on focus
2. **Prompt Output** — the live, editable, paste-ready assembled prompt, with a character count
3. **Thumbnail & Version** — set or replace the cover image; fork a new version once saved
4. **Related** — similar prompts from the library, ranked by rating
5. **Recipes** — matching saved recipes, one-click apply
6. **Inspirations** — linked project reference images
7. **Impact Refs** — references most associated with past winning results
8. **Recommendations** — proven tokens, related prompts/recipes/SREFs/profiles/references, and things to avoid, all scored from your library's real usage
9. **Scoring** — rating, AI-look risk, winner/failed flags
10. **Image Description AI** — describe an uploaded reference image and pull the description back into the prompt
11. **AI Prompt Advisor** — AI critique and one-click rewrite of the assembled prompt

## Provider Success Formulas

Each provider has its own default prompt-structure formula (for example, a visual-hierarchy order for GPT Image, a director's-brief order for Seedance, compact scene direction for Kling). Framecraft also learns from what you paste in through Manual Import — if a pasted prompt demonstrates enough recognized structural steps, its step order is saved as that provider's formula going forward, until you customize it yourself.
