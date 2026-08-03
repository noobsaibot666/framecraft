---
title: Product Vision
description: Framecraft product purpose, audience, and core loop.
---

# Product Vision

Creatives working with AI image and video generators lose their winning prompts, don't systematically learn from what fails, and — without a deliberate process — tend to produce output that reads as generically AI-made. Framecraft exists to fix that by treating prompt engineering as a production discipline with memory, not a series of disconnected one-off attempts.

The core loop is: **Prompt → Reference → Result → Rating → Avoidance → Reuse.** Every prompt you write, every reference image you feed in, every result you generate, and every rating you give feeds back into a library that gets measurably better at suggesting what to try next and what to avoid.

## Audience

Framecraft is built for people producing advertising-grade AI imagery and video at volume, where consistency and repeatability matter more than one-off generation:

- Creative directors and art directors running AI-assisted campaigns
- Prompt engineers who need their proven combinations to be reusable, not rediscovered
- Production teams who need to compare candidate outputs and defend a decision
- Video-production teams doing AI-assisted pre-production (Cinema Studio)

## Design Principle

Framecraft's interface is deliberately Nothing OS–inspired: monochrome, hardware-like, technical. Red is reserved strictly as a signal color — active state, alerts — never decoration. The intent is a tool that reads as instrumentation, not a generic AI-app skin. See [Design System](/framecraft/technical/design-system/) for the concrete rules.

## What Framecraft Is Not

- Not a hosted generation service — Framecraft doesn't generate images or video itself. It manages prompts and orchestrates the hand-off to whichever provider (Midjourney, DALL·E, Stable Diffusion, GPT Image, Nano Banana, Seedance, Kling, and others) you're actually using.
- Not cloud-synced or multi-user by default — each library is a local, portable SQLite file. Sharing happens by pointing multiple machines at the same NAS-hosted library, not through a hosted backend.
- Not a general-purpose asset manager — References and Results exist specifically to support the prompt-authoring loop, not as a standalone DAM.
