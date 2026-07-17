# Cinema Studio (`/cinema-studio`)

Video-production pre-production workspace: take a script through folder-organized, `@tag`-named
assets to scene-by-scene shot direction with an AI-generated director's-brief prompt for each shot —
built as its own independent subsystem, separate from Project/Direction Studio/Storytelling (which
serve the image-ad workflow).

## What you can do
- Create a project, naming its script model and image/video generation models up front
- Draft a script from an idea with AI, refine it with targeted questions (runtime, setting, plot
  twist, tone) or freeform instructions, save named version snapshots, and approve it to unlock Assets
- Organize characters/locations/props into a nested folder tree, with AI folder suggestions read
  straight from the approved script
- Draft an AI image-generation prompt per asset (character-sheet/location/prop guidance baked in),
  save it, and optionally promote it into a full Prompt Library entry for versioning and rating
- Import a generated image into an asset with an auto-suggested, collision-checked `@tag`
- Browse every asset on a pannable/zoomable moodboard canvas, drag to reposition, click to enlarge
- Merge 2-3 separate asset images into one side-by-side character sheet without touching the originals
- Split the approved script into scenes with AI, or add/reorder/delete scenes manually, each with a
  mood tag
- Build a shot list per scene (including B-roll) with description, director/DOP/camera/lighting/sound
  notes, and which assets each shot needs
- Get mood-aware creative hints (camera/director/lighting/physics) while writing each shot
- Generate the full director's-brief prompt for a shot with one click, plus transition-in/out
  suggestions
- Copy a shot's prompt to the clipboard, mark shot status, and export all assets as individually
  downloaded files named by their `@tag`

## Project Library (`/cinema-studio`)
Grid of projects — thumbnail, status, script/image/video model badges, a "sees image reference"
badge when the chosen video model supports it, and folder/asset/scene/shot counts. "+ New Project"
opens a modal for title + model selection.

## Script Studio (`/cinema-studio/:id/script`)
1. **Idea/logline** + **Script Questions** (runtime, setting, plot twist, tone) — quick-fill inputs
   that feed the AI draft and refine calls.
2. **Model** picker (falls back to your Settings default).
3. **Generate Draft** — AI writes a full script from the idea + answered questions.
4. **Script** editor — the full text, hand-editable.
5. **Refine with AI** — freeform instruction against the current script ("make the ending more
   dramatic").
6. **Save Script** / **Save Version** (named snapshot, click to restore into the editor) /
   **Approve Script** — approving unlocks the Assets stage.

## Assets (`/cinema-studio/:id/assets`)
Composer/Moodboard toggle in the header, alongside the Script/Assets/Scenes stage tabs.

**Composer view** — three columns:
1. **Folders** (left) — nested tree, create/rename/delete, kind + accent color; "Suggest from
   Script" reads the approved script and proposes character/location/prop folders to accept.
2. **Folder detail + assets** (center) — rename/describe/color the selected folder; grid of its
   assets ("Merge Assets" appears once 2+ have images); selecting one opens the **Asset Prompt
   Composer**: editable `@tag`, title, "describe what you want" → Generate Prompt (script- and
   folder-kind-aware), editable prompt text, image import (auto-thumbnail), mark Primary, Save
   Asset, Promote to Prompt Library.
3. **Pro tips + folder count** (right) — provider-aware tips for the project's image model.

**Moodboard view** — folder filter chips, an Export button (downloads every filtered asset that has
an image, named by its `@tag`), and the pannable/zoomable canvas itself: drag a card to reposition
(persisted), click to open a full-size lightbox.

**Merge Assets modal** — pick 2-3 images from the open folder, preview the side-by-side composite,
confirm to create a new asset (marked Primary) that records which assets it was merged from —
originals are never modified or deleted.

## Scenes (`/cinema-studio/:id/scenes`)
1. **Split Script into Scenes** (AI) or manually **Add Scene**.
2. **Project Timeline** — one colored block per scene (subdivided once it has shots), a decorative
   waveform strip underneath, mood tag and shot count; click a scene to open its Shot Editor.
3. **Manage Scenes** — reorder (up/down), edit mood inline, delete.

## Shot Editor (`/cinema-studio/:id/scenes/:sceneId`)
1. **Shot list** (left) — add a Shot or B-Roll, reorder, delete.
2. **Shot detail** (center) — label, shot type, status (draft/ready/exported); Description,
   Director, DOP, Camera, Lighting, Sound/Dialogue notes; toggle which project assets this shot
   needs (by `@tag`); **Generated Prompt** — Generate Prompt (AI, built on the project's video-model
   prompt formula) with a Copy button; **Transitions** — in/out fields plus AI Suggest, with one-click
   apply per suggestion.
3. **Creative Hints + Pro Tips** (right) — camera/director/lighting/physics hints keyed to the
   scene's mood tag, plus the video model's provider tips.
