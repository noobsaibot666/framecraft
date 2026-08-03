---
title: Privacy Policy
description: What data Framecraft collects, and what it doesn't.
---

# Privacy Policy for Framecraft

Effective Date: 2026-08-03

Framecraft is built with a strict focus on user privacy and local-first data handling.

## Local-First Design

Framecraft stores your prompt library, tokens, references, results, ratings, projects, and Cinema Studio productions entirely in a local SQLite database on your own machine, or on a NAS/external drive you point it at. This data is never uploaded to, or stored on, any server operated by Framecraft's developer.

## AI Provider Calls

Framecraft's AI-assisted features — prompt drafting and critique, image analysis, script and creative-direction generation — work by calling third-party AI provider APIs (currently Anthropic, OpenAI, and DeepSeek) directly from the app, using API credentials you supply yourself. When you use one of these features, the relevant prompt text or image is sent directly to that provider for processing, under that provider's own privacy policy and terms — not Framecraft's. Framecraft does not proxy, log, or retain a copy of these calls on any server of its own; it has no server to do so.

Which providers a given build can reach is scoped explicitly in the app's network policy — currently limited to `api.anthropic.com`, `api.openai.com`, and `api.deepseek.com`.

## Permissions

On macOS, Framecraft requests file system access so it can read and write your library database, import reference images and videos, and export files to locations you choose.

## Third-Party Services

Framecraft does not include third-party tracking, advertising SDKs, or analytics SDKs. Beyond the AI provider calls described above (which only occur when you actively use an AI-assisted feature), the app makes no other network requests.

## Data Security

Because your library stays on your own machine or storage, your system security settings and disk encryption protect it. Keep your operating system updated and use disk encryption where possible, particularly for NAS-hosted portable libraries.

## Contact

- Developer: Alan Alves
- Website: [alan-design.com](https://alan-design.com/)
- Contact: exposeuberlin@gmail.com
