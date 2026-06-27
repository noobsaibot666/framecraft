# Project Direction Studio Design

## Decision

Creative Director Mode begins as a Project Direction Studio embedded in Project Workspace. It will not be a standalone global page.

## First Slice

The Studio creates and manages up to three distinct creative-direction alternatives for a project. Each direction contains:

- title
- campaign idea
- rationale
- visual aesthetic
- brand connection
- product message
- tone
- prompt direction

Directions can be generated from the current project context or created manually. Every field remains editable. One direction can be selected and explicitly applied to the project.

## Project Integration

Applying a direction writes a concise assembled direction to `projects.visual_direction` and strategy detail to `projects.creative_goals`. Existing Project Craft then receives the selected direction through its current project-context flow. Applying does not overwrite the brief, constraints, providers, ratios, or assets.

## Persistence

An additive `creative_directions` table stores project-scoped alternatives and the selected state. Deleting a project cascades to its directions. Existing projects require no data conversion.

## AI Generation

The generator uses the configured Anthropic or OpenAI models already supported by Brief Analyzer. The request includes project brief, client/campaign context, production goal, visual direction, goals, constraints, providers, ratios, and recent comparison outcomes. The model must return exactly three materially different JSON direction objects.

Generation errors remain visible and copyable. No existing directions are deleted when generation fails. Successfully generated directions are appended, with the visible list capped to the most recent alternatives in the UI.

## UI

The Studio appears between Project Setup/brief data and Craft. A compact header contains model selection, Generate 3, and New Direction actions. Direction items use a responsive three-column layout, clear field hierarchy, Select/Apply actions, and restrained accent treatment consistent with the native-app cleanup.

## Deferred

Full campaign plans, concept boards, autonomous research, story nodes, and asset generation remain outside this slice.

## Testing

Tests cover direction CRUD, AI JSON parsing, project-field assembly, selected-direction exclusivity, invalid responses, and regression verification across frontend, TypeScript, Rust, and production builds.

