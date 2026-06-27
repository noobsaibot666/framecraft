# Shot Sequence Design — Phase 55

## Problem

Projects produce many individual images and prompts but have no way to arrange them into an ordered visual narrative. A creative working on a campaign can't see the story at a glance, can't plan which shots are missing, and can't define the intended sequence before generating.

## Solution

Add a **Shot Sequence** to projects: an ordered list of shots where each shot has a type, label, optional prompt reference, optional result image, and notes. Users drag-to-reorder shots and connect existing prompts and results to fill out the story.

## Shot Types

```text
establishing   Wide scene-setting frame
wide           Full environment, characters at distance
medium         Waist-up or mid-environment
close_up       Face, hand, or product fill
detail         Texture, material, or graphic element
cutaway        Secondary or transitional image
hero           Primary featured image for the concept
product        Isolated product or branded asset
```

## Data Model

New table `shot_sequence`:

```sql
id          TEXT PK
project_id  TEXT NOT NULL → projects(id) CASCADE DELETE
sort_order  INTEGER NOT NULL DEFAULT 0
shot_type   TEXT NOT NULL DEFAULT 'hero'
label       TEXT NOT NULL DEFAULT ''
prompt_id   TEXT → prompts(id) SET NULL
result_id   TEXT → results(id) SET NULL
notes       TEXT
created_at  TEXT NOT NULL
```

## Page Layout: ProjectSequence

Route: `/projects/:id/sequence`

- Header: project title + "Shot Sequence" subtitle + Back to Project
- Add Shot button (inline form: shot type, label, notes)
- Shot list with DnD vertical reorder via @dnd-kit
- Each shot card shows:
  - Drag handle, shot number, type badge
  - Label (editable inline)
  - Result thumbnail (if linked) or placeholder
  - Prompt title (if linked)
  - Notes (single line, expand on click)
  - Connect Prompt / Connect Result / Remove actions
- Connect Prompt picker: searchable list of project prompts
- Connect Result picker: scrollable grid of project result thumbnails
- Empty state guides users to add their first shot

## Workspace Integration

ProjectWorkspace adds a "Sequence" row in the Craft section:
- Shows shot count summary (e.g., "5 shots · 3 with results")
- Links to `/projects/:id/sequence`

## Checklist

```text
A user can add, edit, and delete shots in the sequence.
A user can reorder shots by dragging.
A user can connect any project prompt to a shot.
A user can connect any project result to a shot.
Shot count appears in Project Workspace.
Tests pass.
Build passes.
```
