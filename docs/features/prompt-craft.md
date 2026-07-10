# Prompt Craft (`/craft`)

Build, assemble, and save one AI image/video prompt — the core prompt-authoring page.

## What you can do
- Create a new prompt or edit an existing one (editing forks a new version)
- Build field-by-field (Builder mode) or write/paste free text (Manual mode)
- Pull from the Token Library: proven combos, recipe matches, project tokens, full token cloud
- Auto-detect AI-look artifacts and get one-click corrections, with a live risk score
- Lock elements that must stay stable across variations (Consistency Factor)
- Set provider-specific parameters, with SREF/Profile suggestions based on your own usage
- Preview, hand-edit, auto-format, and copy the final paste-ready prompt
- Get AI critique, a one-click rewrite, and an image-to-prompt description assist
- Save to the library, save as a recipe, or fork a new version
- See duplicate and inconsistency warnings before you save

## Header actions
Back to library/project · Copy · Format · Save as Recipe · Save/Update · New Version · Reset

## Left column — operational order
1. **Project context banner** — shown only when launched from a project; brief, direction, provider/aspect targets, link back.
2. **Duplicate warning** — flags similar existing prompts.
3. **Identity** — title, description, provider, category, aspect ratio, use case, provider success-formula bar.
4. **Prompt** — Builder mode (structured fields) or Manual mode (free text); live inconsistency/provider-mismatch warnings.
5. **Token Library** — sequence builder, proven combinations, recipe suggestions, project token suggestions, full token cloud (39 categories, ordered to match the fields above, hold 3s to delete a token, "Recurring" chips from real usage).
6. **AI-Look Avoidance** — risk-scored artifact detector with one-click corrections; auto-fills Midjourney's `--no` flag.
7. **Consistency Factor** — pick or type elements that must hold stable across variations; rides along on copy, correctly ordered before provider flags.

## Right column — operational order
1. **Parameters** — provider-specific controls (Midjourney/DALL-E/Stable Diffusion/etc.); Midjourney's SREF Code and Profile fields suggest codes from similar/winning prompts on focus.
2. **Prompt Output** — the live assembled, editable, paste-ready prompt; char count, tall resizable preview.
3. **Thumbnail & Version** — set/replace the cover image; fork a new version once saved.
4. **Related** — similar prompts from the library, ranked by rating.
5. **Recipes** — matching saved recipes, one-click apply.
6. **Inspirations** — linked project reference images.
7. **Impact Refs** — references most associated with past winning results.
8. **Recommendations** — proven tokens, related prompts/recipes/SREFs/profiles/references, and things to avoid — scored from your library's real usage and ratings.
9. **Scoring** — rating, AI-look risk, winner/failed flags.
10. **Image Description AI** — describe an uploaded reference image and pull it back into the prompt.
11. **AI Prompt Advisor** — AI critique and one-click rewrite of the assembled prompt.
