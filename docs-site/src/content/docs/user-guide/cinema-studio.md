---
title: Cinema Studio
description: Script-to-shot-list video pre-production workspace.
---

# Cinema Studio (`/cinema-studio`)

A video-production pre-production workspace: take a script through folder-organized, `@tag`-named assets to scene-by-scene shot direction with an AI-generated director's-brief prompt for each shot. Cinema Studio is its own independent subsystem, separate from Projects/Direction Studio/Storytelling, which serve the image-ad workflow.

## What You Can Do

- Create a project, naming its script model and image/video generation models up front
- Draft a script from an idea with AI, refine it with targeted questions (runtime, setting, plot twist, tone) or freeform instructions, save named version snapshots, and approve it to unlock Assets
- Organize characters, locations, and props into a nested folder tree, with AI folder suggestions read straight from the approved script
- Draft an AI image-generation prompt per asset (with character-sheet/location/prop guidance baked in), save it, and optionally promote it into a full Prompt Library entry for versioning and rating
- Import a generated image into an asset with an auto-suggested, collision-checked `@tag`
- Browse every asset on a pannable, zoomable moodboard canvas — drag to reposition, click to enlarge
- Merge 2–3 separate asset images into one side-by-side character sheet without touching the originals
- Split the approved script into scenes with AI, or add/reorder/delete scenes manually, each with a mood tag
- Build a shot list per scene, including B-roll, with description, director/DOP/camera/lighting/sound notes, and which assets each shot needs
- Get mood-aware creative hints (camera, director, lighting, physics) while writing each shot
- Generate the full director's-brief prompt for a shot with one click, plus transition-in/out suggestions
- Copy a shot's prompt to the clipboard, mark shot status, and export all assets as individually downloaded files named by their `@tag`

## Project Library (`/cinema-studio`)

A grid of projects — thumbnail, status, script/image/video model badges, a "sees image reference" badge when the chosen video model supports it, and folder/asset/scene/shot counts.

## Script Studio (`/cinema-studio/:id/script`)

1. Idea/logline and Script Questions (runtime, setting, plot twist, tone) feed the AI draft and refine calls
2. Model picker, falling back to your Settings default
3. Generate Draft — AI writes a full script from the idea and answered questions
4. A hand-editable script editor
5. Refine with AI — freeform instruction against the current script
6. Save Script / Save Version (a named snapshot, click to restore) / Approve Script — approving unlocks the Assets stage

## Assets (`/cinema-studio/:id/assets`)

A Composer/Moodboard toggle sits alongside the Script/Assets/Scenes stage tabs.

**Composer view** — three columns: Folders (nested tree, "Suggest from Script" reads the approved script and proposes folders), Folder detail + assets grid (selecting one opens the Asset Prompt Composer — editable `@tag`, title, describe-and-generate prompt, image import, mark Primary, Save, Promote to Prompt Library), and Pro tips scoped to the project's image model.

**Moodboard view** — folder filter chips, an Export button (downloads every filtered asset with an image, named by `@tag`), and the pannable/zoomable canvas itself.

**Merge Assets modal** — pick 2–3 images from the open folder, preview the composite, confirm to create a new Primary asset recording which assets it was merged from. Originals are never modified or deleted.

## Scenes (`/cinema-studio/:id/scenes`)

Split Script into Scenes (AI) or manually add scenes. A Project Timeline shows one colored block per scene (subdivided once it has shots) with a mood tag and shot count. Reorder, edit mood inline, or delete scenes from the Manage Scenes list.

## Shot Editor (`/cinema-studio/:id/scenes/:sceneId`)

Shot list (add Shot/B-Roll, reorder, delete) on the left; shot detail in the center — label, type, status, Description/Director/DOP/Camera/Lighting/Sound notes, which project assets the shot needs, a Generate Prompt button built on the project's video-model prompt formula, and AI-suggested transitions with one-click apply. Creative Hints and provider Pro Tips sit on the right, keyed to the scene's mood tag.
