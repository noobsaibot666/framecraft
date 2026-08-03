---
title: Projects and Campaigns
description: Running multi-prompt, multi-shot creative work in Framecraft Projects.
---

# Projects and Campaigns

A Project (`/projects/:id`) groups everything related to one piece of creative work — brief, prompts, references, results, creative direction, and (for video work) a shot sequence — above the level of a single prompt. Campaigns (`/campaigns`) sit one level above Projects, for grouping multiple projects under one initiative.

## Project Library (`/projects`)

Browse and open existing projects, or start a new one.

## Project Workspace (`/projects/:id`)

The project's home: brief, mood board (imported via drag-and-drop, individually or in batch), linked prompts, and linked results. Prompts launched from inside a project carry a context banner into Prompt Craft showing the brief, creative direction, and target provider/aspect ratio.

## Direction Studio

Generate and compare alternative **creative directions** for a project — up to three at a time. Each direction can hold its own visual references (tagged `visual-reference`, which then surface as Inspirations back in Prompt Craft), and can be individually improved with AI without discarding the others. A selected direction's Storytelling panel (below) and the Comparison Lab's Direction vs. Result comparison type both key off whichever direction is currently selected.

### Storytelling

Inside a selected direction, break it into a shot-by-shot storyboard. Approved shots become named prompt versions (`"Shot NN — label"`) linked back to the project, with a consistent accent color carried through into the project's linked-prompt list so a shot's origin stays visible at a glance.

### Creative Director Mode

A one-shot-generate-then-review panel (not a chatbot) that produces a structured creative strategy for the project — campaign idea, concepts, creative directions, visual aesthetics, brand connection, product message, audience, and execution direction. This strategy feeds into both Direction Studio's and Prompt Craft's generation context, and into the Project Assistant's system prompt.

## Project Board (`/projects/:id/board`)

A pipeline kanban view over the project's linked prompts/results, for tracking production status across a project rather than reviewing one item at a time.

## Project Assistant (`/projects/:id/assistant`)

A chat-style assistant scoped to the project's own context (brief, prompts, results, references, deliverables, comparisons). It deliberately does not read from the learned intelligence tables (token quality, reference impact) — see [Application Intelligence](/framecraft/technical/application-intelligence/) — and instead recomputes deterministic suggestions from the project's raw data on every call, plus prose context pulled from saved comparison outcomes.

## Project Sequence (`/projects/:id/sequence`)

A shot-sequence builder for projects producing an ordered set of images or video shots, distinct from Cinema Studio's independent script-to-shot pipeline (see [Cinema Studio](/framecraft/user-guide/cinema-studio/)).

## Project Export (`/projects/:id/export`)

Generates a delivery report summarizing the project's approved output.

## Campaigns (`/campaigns`, `/campaigns/:id`)

Campaign Library lists active and archived campaigns. Campaign Detail shows stats, the campaign brief, its list of projects, and an edit form — campaigns are a grouping layer, not a separate content type from projects.
