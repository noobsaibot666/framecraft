---
title: Design System
description: Framecraft's visual language and enforced UI conventions.
---

# Design System

Framecraft's interface is deliberately Nothing OS–inspired: monochrome, hardware-like, technical. It's meant to read as instrumentation for a production process, not as a themed skin over a generic AI-app template.

## Core Rules

- **Monochrome base.** The interface is built from a grayscale palette.
- **Red is signal only.** `#D71921` is reserved strictly for active/alert/signal states — never used decoratively.
- **`font-mono` for data and labels.** Numeric data, badges, and technical labels use the monospace stack; a dot-matrix accent font is used for select display elements, and a grotesk sans for body copy.
- **`system-label` for uppercase headers.** Section headers follow a consistent uppercase, tracked treatment.
- **Tailwind canonical classes only.** Arbitrary-value utilities are avoided in favor of the design system's own scale — `rounded-pill` instead of `rounded-[999px]`, `bg-white/4` instead of `bg-white/[0.04]`. This keeps spacing, radii, and opacity values from drifting into one-off values across the app.

## Typography

- **Ndot55/57** — local OTF, used as the dot-matrix accent typeface for select display moments
- **Space Grotesk** — body text
- **IBM Plex Mono** — monospace/data display

## Implementation

Styling runs on Tailwind CSS v4's CSS-first configuration (`@theme` directive, `@tailwindcss/vite` plugin) rather than a JS-based `tailwind.config`. Design tokens and `@font-face` declarations for the Ndot typeface live in `src/styles/globals.css`.

## Why It's Enforced This Strictly

A tool for judging AI-generated creative output loses credibility if its own interface reads as generically AI-generated. The monochrome/signal-red constraint is a deliberate differentiator, and it's treated as a real constraint during review — not a starting aesthetic that drifts as features are added.
