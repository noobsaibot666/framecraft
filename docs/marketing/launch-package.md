# Framecraft — Launch & Promotion Package

Copy is paste-ready. Asset rows give exact filename, pixel size, format. `☐` = to do — tick as you go. §7 is the one-page rollup.

| | |
|---|---|
| Product name (everywhere) | `Framecraft` |
| App Store listing name (30-char field) | `Framecraft: AI Prompt Studio` — plain "Framecraft" was taken |
| Bundle ID / category | `com.alan.framecraft` · Graphics & Design |
| Version | 0.1.2 (build 3) |
| Price | €29 (App Store tier still to set) |
| Storefront | `alan-design.com/#/store` — data in `web_three/src/data/storeProducts.json` |
| Docs / support | `https://docs.alan-design.com/framecraft/` |
| Providers (AI features, own key) | Anthropic · OpenAI · DeepSeek |
| Hand-off targets (not generated in-app) | Midjourney, DALL·E, Stable Diffusion, GPT Image, Nano Banana, Seedance, Kling |

**Brand rules for every asset:** monochrome, hardware/instrument aesthetic, black `#0A0A0A`. Red `#D71921` = signal only, never decoration. Monospace for data/labels, uppercase headers. Tight corners, no decorative gradients.

---

## Canonical copy — reuse everywhere

```
One-liner:      The prompt library that learns which of your AI images and video actually win.
Short:          Stop rediscovering your best AI prompts.
Pitch (2 sent): Framecraft is a local-first app for AI image and video prompt engineering.
                Every prompt, reference, result, and rating feeds a library that gets
                measurably better at telling you what to try next — and what to avoid.
```

**The loop:** Prompt → Reference → Result → Rating → Avoidance → Reuse.

**Proof points** (pick per channel): token library scored by your own results · Comparison Lab writes winners back onto records · recurring-mistake detection · Cinema Studio script→shot-list with AI director's brief · local-first portable SQLite (point a team at one NAS file) · bring your own API key.

**Audience:** creative/art directors, prompt engineers, production teams running AI-assisted campaigns at volume; AI video pre-production teams.

**Hashtags:** `#midjourney #aiart #promptengineering #aivideo #generativeai #creativedirection #adcreative #aitools #madewithai`

---

## 1. App icon

**You build it in Icon Composer. Deliver to `store-assets/icon-src/`:**

| ✓ | File | Size | Format | Notes |
|---|---|---|---|---|
| ☐ | `framecraft-icon-master.png` | 2048×2048 (1024 min) | PNG, **opaque, no alpha**, sRGB | Art **bleeds to all four edges** — no transparent margin/inset. Don't bake in glass/specular effects; it rasterizes flat. |
| ☐ | `Framecraft.icon` | — | Icon Composer doc | Optional, kept as editable source. Not used by the build. |

- ☐ **Pipeline** (run after master lands): verify `hasAlpha: no` + edge-to-edge → copy to `src/assets/icon/framecraft.png` → `npx tauri icon src/assets/icon/framecraft.png -o src-tauri/icons` → delete `ios/`, `android/`, `64x64.png` → flatten master on `#0A0A0A`, resize to exactly 1024×1024, strip alpha → `store-assets/framecraft-appstore-icon-1024.png` → `npm test` + `cargo check` → rebuild.
- ☐ **App Store marketing icon uploaded** — 1024×1024 PNG, flattened, no alpha, no added corners/shadow (Apple masks).

---

## 2. Mac App Store

### 2.1 Text fields — paste into App Store Connect

| ✓ | Field | Limit | Value |
|---|---|---|---|
| ☐ | **Name** | 30 | `Framecraft: AI Prompt Studio` |
| ☐ | **Subtitle** | 30 | `The prompt library that learns` |
| ☐ | **Promotional text** | 170 | `Build, queue, compare, and rate every AI image and video prompt in one place — a local-first library that learns which combinations win and which to avoid.` |
| ☐ | **Keywords** | 100, no space after commas | `midjourney,ad creative,image generation,video prompt,creative director,storyboard,shot list,recipe` |
| ☐ | **Description** | 4000 | block below |
| ☐ | **What's New** (first submit) | 4000 | `Initial release.` |
| ☐ | **Support URL** | — | `https://docs.alan-design.com/framecraft/legal/support/` |
| ☐ | **Marketing URL** | — | `https://docs.alan-design.com/framecraft/` |
| ☐ | **Privacy Policy URL** | — | `https://docs.alan-design.com/framecraft/legal/privacy-policy/` |
| ☐ | **Category** | — | Primary: Graphics & Design · Secondary: Productivity |
| ☐ | **Age rating** | — | 4+ |
| ☐ | **Copyright** | — | `© 2026 Alan` |

**Description** (4000 limit, ~1950 used):

```
Framecraft is a local-first Mac app for AI image and video prompt engineering — built for creatives who need their winning prompts to be reusable, not rediscovered every time.

THE CORE LOOP
Prompt → Reference → Result → Rating → Avoidance → Reuse. Every prompt you write, every reference you feed in, every result you generate, and every rating you give feeds a library that gets measurably better at suggesting what to try next — and what to avoid.

PROMPT CRAFT
Build a prompt field-by-field or in free text, with a formula bar that learns your successful structures per provider and a token library scored by your own results.

GENERATION QUEUE
Batch-send prompts to whichever provider you use, then pull results back in — auto-matched to their cards by filename.

COMPARISON LAB
Put 2–4 candidate outputs side by side and decide a winner with structured scoring, not gut feel. The decision writes back onto the real result records.

CINEMA STUDIO
Take a script through scene splitting, a folder-organized asset moodboard, and a shot-by-shot director's brief — AI-assisted pre-production for video work.

REFERENCE LIBRARY
Import and tag reference images, then see which ones actually correlate with winning results over time.

SELF-LEARNING LIBRARY
Token quality scoring, proven-combination hints, and recurring-mistake detection all improve automatically from your own ratings — scoped to your library, never uploaded.

LOCAL-FIRST, NAS-PORTABLE
Your library is a portable SQLite file on your own machine, drive, or NAS — not a hosted service. Point several machines at one NAS library to share it across a team.

BRING YOUR OWN KEY
Prompt drafting, critique, image analysis, and Cinema Studio briefs call an AI provider you configure yourself (Anthropic, OpenAI, or DeepSeek) with your own API key.

Framecraft doesn't generate images or video itself — it manages prompts and orchestrates the hand-off to whichever generator you already use (Midjourney, DALL·E, Stable Diffusion, GPT Image, Nano Banana, Seedance, Kling, and more).
```

**What's New — template for later updates:**

```
NEW
- <feature as a user outcome>
IMPROVED
- <change to something that existed>
FIXED
- <the symptom the user saw>
```

### 2.2 Screenshots

**Spec:** 2560×1600 px · 16:10 landscape · PNG or JPG, flattened, no alpha, sRGB · up to 10, upload all 10 · screenshot the app at its 1280×800 window on a Retina display. Captions optional overlays: ≤6 words, monospace, top/bottom third, never over key UI. Use a clean populated demo library, no personal keys/paths.

| ✓ | # | Filename | Page / state | Caption |
|---|---|---|---|---|
| ☐ | 01 | `fc-appstore-01-prompt-craft.png` | Prompt Craft, Builder mode, Token Library open, "proven" chips visible | Build from tokens that learn |
| ☐ | 02 | `fc-appstore-02-dashboard.png` | Dashboard populated — Win Rate, Provider Performance, Proven Tokens | See what's actually winning |
| ☐ | 03 | `fc-appstore-03-comparison-lab.png` | Comparison Lab 4-up, Dimension Breakdown, one Winner marked | Judge 2–4 outputs. Pick a winner. |
| ☐ | 04 | `fc-appstore-04-token-library.png` | Token Library cloud, quality scores / recurring chips | A token library scored by your results |
| ☐ | 05 | `fc-appstore-05-cinema-studio.png` | Cinema Studio — Shot Editor with generated director's brief | Script → scenes → shot list → brief |
| ☐ | 06 | `fc-appstore-06-references.png` | References library, impact score / win count on cards | Know which references drive winners |
| ☐ | 07 | `fc-appstore-07-queue.png` | Generation Queue, mixed Pending/Sent/Done, a result imported | Batch out, pull results back |
| ☐ | 08 | `fc-appstore-08-result-detail.png` | Result Detail, Advanced Scoring + AI Artifact Checklist open | Score every result. It trains the library. |
| ☐ | 09 | `fc-appstore-09-recipes.png` | Recipe Apply — slots left, live reconstructed prompt right | Save winning structures as templates |
| ☐ | 10 | `fc-appstore-10-settings.png` | Settings — provider/API-key config + portable library path | Local-first. Your key. Your file. |

### 2.3 App Preview video (optional, up to 3)

**Spec:** 1920×1080 (or 3840×2160) · 30 fps · **15–30 s** · `.mov`/`.mp4`, H.264 or ProRes 422 HQ · stereo AAC ≥192 kbps, no lyric-as-copy · **screen recording only** — no hands, no device frames, minimal motion graphics · first frame = poster · file `fc-appstore-preview-01.mov`. Capture at 2560×1600, export to 1080p.

- ☐ `fc-appstore-preview-01.mov` cut, exported, uploaded

| Time | On screen |
|---|---|
| 0–3s | Prompt Craft: type a subject, drag two proven tokens in |
| 3–8s | Copy → cut to Queue, prompt is now a card |
| 8–13s | Drag 3–4 result files onto queue cards, statuses flip to Done |
| 13–20s | Comparison Lab 4-up, mark Winner, click Apply |
| 20–26s | Dashboard: Winners count ticks up, Proven Tokens reorder |
| 26–30s | Wordmark → "On the Mac App Store" |

---

## 3. Storefront — `alan-design.com/#/store`

Single responsive React app (`web_three`). **No separate mobile/desktop files** — one set of assets, framed to survive both renders below.

**How it renders:**

| Surface | Desktop | Mobile (<960px) |
|---|---|---|
| Product **card** image | 16:10 box, `object-fit: cover`, ~453×283 CSS (@2x ≈ 906×566) | 1-col, up to ~768×480 CSS (@2x ≈ 1536×960) |
| Modal **gallery** item | 60% of a 1200px modal ≈ 720 CSS wide, height auto, stacked vertically | full-width horizontal scroll-snap, each item 100vw × 50vh |

→ Card art is center-cropped to 16:10; keep key UI centred with ~8% safe margin. Gallery stills are cropped to roughly 4:3 on mobile — keep the important content centred.

### 3.1 `storeProducts.json` entry

- ☐ Replace the current `framecraft` object in `web_three/src/data/storeProducts.json` with the block below

```json
{
  "id": "framecraft",
  "name": "Framecraft",
  "category": "Apps",
  "description": "Local-first Mac & Windows app for AI image and video prompt engineering — a prompt library that learns which generations win.",
  "longDescription": "Framecraft treats AI prompt engineering as a production discipline with memory. Build and version prompts in Prompt Craft; batch them through the Generation Queue to any provider and pull results back; judge 2–4 outputs side by side in the Comparison Lab; run full script-to-shot-list pre-production in Cinema Studio. Every rating and comparison feeds the library's own learned scoring — proven token combinations surface, recurring mistakes get flagged. Your library is a portable SQLite file on your machine, drive, or NAS; the AI features use your own Anthropic, OpenAI, or DeepSeek key.",
  "features": [
    "Prompt Craft — build, version, and save prompts with a token library scored by your own results",
    "Comparison Lab — score 2–4 candidate outputs and write the winner back onto the records",
    "Generation Queue — batch sends to any provider, results auto-matched back by filename",
    "Cinema Studio — script → scenes → shot list with an AI director's brief per shot",
    "Self-learning library — proven combinations surface, recurring mistakes get flagged",
    "Local-first and NAS-portable; bring your own API key for AI features",
    "Available for macOS and Windows"
  ],
  "price": "€29",
  "stripePriceId": "price_1U0Pj9CsCSs3k4X1b8i25dz6",
  "downloadUrl": "https://alan-design.com/#/download",
  "image": "/assets/images/store/framecraft/framecraft-hero.webp",
  "gallery": [
    { "type": "video", "url": "/assets/videos/framecraft-loop.mp4" },
    { "type": "image", "url": "/assets/images/store/framecraft/framecraft-01-prompt-craft.webp" },
    { "type": "image", "url": "/assets/images/store/framecraft/framecraft-02-comparison-lab.webp" },
    { "type": "image", "url": "/assets/images/store/framecraft/framecraft-03-dashboard.webp" },
    { "type": "image", "url": "/assets/images/store/framecraft/framecraft-04-cinema-studio.webp" },
    { "type": "image", "url": "/assets/images/store/framecraft/framecraft-05-queue.webp" },
    { "type": "image", "url": "/assets/images/store/framecraft/framecraft-06-token-library.webp" }
  ],
  "stripeLink": "#",
  "stripeMode": "payment",
  "badge": "NEW",
  "appStoreUrl": ""
}
```

- ☐ Set `appStoreUrl` to the real `https://apps.apple.com/.../id<APPID>?mt=12` once the MAS listing is live (switches on the card "Mac App Store" ribbon + modal badge).
- ☐ Drop `badge` to `""` once it's no longer new.
- **Caveat:** per `framecraft/CLAUDE.md`, a Store Manager **Publish** rewrites `web_three`'s registry files. Either put final copy in the Store Manager `manifest.json`, or edit `storeProducts.json` directly (per `web_three/documentation/STORE_CONTENT_GUIDE.md`) *after* the last publish so it isn't clobbered.

### 3.2 Storefront assets

All under `web_three/`. Reuse the §2.2 captures, exported **without** caption overlays. WebP q82.

| ✓ | Asset | Path | Size | Budget |
|---|---|---|---|---|
| ☐ | Card thumbnail | `public/assets/images/store/framecraft/framecraft-hero.webp` | 1600×1000 (16:10) | <250 KB |
| ☐ | Gallery still 01 | `.../store/framecraft/framecraft-01-prompt-craft.webp` | 1920×1200 (16:10) | <400 KB |
| ☐ | Gallery still 02 | `.../store/framecraft/framecraft-02-comparison-lab.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery still 03 | `.../store/framecraft/framecraft-03-dashboard.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery still 04 | `.../store/framecraft/framecraft-04-cinema-studio.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery still 05 | `.../store/framecraft/framecraft-05-queue.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery still 06 | `.../store/framecraft/framecraft-06-token-library.webp` | 1920×1200 | <400 KB |
| ☐ | Gallery loop video | `public/assets/videos/framecraft-loop.mp4` | 1600×1000, 12–20 s, MP4 H.264 muted loop | <8 MB |
| ☐ | App icon | `.../store/framecraft/framecraft-icon.png` | 1024×1024 PNG opaque | — |

---

## 4. Astro docs site (`docs-site/`)

Base path `/framecraft/`. Files → `docs-site/public/screenshots/` and `/media/`. In hand-authored markdown, prefix links: `![](/framecraft/screenshots/<file>)`.

**Screenshot spec:** capture 2560×1600, export **WebP** ≤1600 px wide, q≈82, <400 KB. Name `fc-docs-<page>-<nn>-<slug>.webp`. Same demo library as store/App Store.

- ☐ `fc-docs-index-01-hero.webp` — Prompt Craft, wide (`index.mdx`)
- ☐ `fc-docs-getting-started-01-first-run.webp` — empty-state 3-step guide
- ☐ `fc-docs-getting-started-02-settings.webp` — provider + key + library path
- ☐ `fc-docs-dashboard-01-overview.webp` — full populated Dashboard
- ☐ `fc-docs-dashboard-02-health.webp` — Production Health strip + sparkline
- ☐ `fc-docs-prompt-craft-01-builder.webp`
- ☐ `fc-docs-prompt-craft-02-tokens.webp` — proven combos / recurring chips
- ☐ `fc-docs-prompt-craft-03-avoidance.webp` — AI-Look risk + corrections
- ☐ `fc-docs-prompt-craft-04-output.webp` — assembled paste-ready prompt
- ☐ `fc-docs-library-01-cloud.webp` — Token Library cloud
- ☐ `fc-docs-library-02-token-detail.webp` — quality score, co-occurrences
- ☐ `fc-docs-references-01-grid.webp` — impact scores on cards
- ☐ `fc-docs-references-02-detail.webp` — Linked To roles, Impact
- ☐ `fc-docs-results-queue-01-queue.webp` — mixed statuses
- ☐ `fc-docs-results-queue-02-gallery.webp` — filters / Top Shots strip
- ☐ `fc-docs-results-queue-03-scoring.webp` — Advanced Scoring + Artifact Checklist
- ☐ `fc-docs-comparison-01-4up.webp` — 4-up + Dimension Breakdown
- ☐ `fc-docs-comparison-02-ai-decision.webp` — AI Decision verdict
- ☐ `fc-docs-projects-01-workspace.webp` — Project Workspace / board
- ☐ `fc-docs-cinema-01-library.webp` — Project Library grid + model badges
- ☐ `fc-docs-cinema-02-script.webp` — Script Studio + Refine with AI
- ☐ `fc-docs-cinema-03-assets.webp` — Composer (folders + Asset Prompt Composer)
- ☐ `fc-docs-cinema-04-moodboard.webp` — Moodboard canvas
- ☐ `fc-docs-cinema-05-scenes.webp` — Scenes timeline
- ☐ `fc-docs-cinema-06-shot-editor.webp` — director's brief + transitions

**Other docs art:**

- ☐ `docs-site/public/fc-docs-og.png` — OpenGraph card, 1200×630, PNG
- ☐ `docs-site/public/fc-docs-favicon-512.png` — 512×512, PNG opaque
- ☐ `docs-site/public/media/fc-docs-core-loop.svg` — core-loop diagram, 1600×900
- ☐ `docs-site/public/media/fc-docs-core-loop.{mp4,webm}` — 1600×1000, 8–20 s, muted, <6 MB
- ☐ `docs-site/public/media/fc-docs-comparison.{mp4,webm}` — same spec
- ☐ `docs-site/public/media/fc-docs-cinema-shot.{mp4,webm}` — same spec

---

## 5. Social

### 5.1 Copy bank

```
Hooks:
- Your best Midjourney prompt from three weeks ago. Find it. Right now.
- Every rating you give makes the next prompt better.
- AI images that don't read as AI-made — because the tool remembers what failed.
- I stopped losing my best AI prompts.

CTA:
- Framecraft: AI Prompt Studio — on the Mac App Store.
- Local-first. Bring your own key. Link in bio.

Don't: imply it generates images · promise quantified gains · show a competitor UI.
```

### 5.2 Instagram

**Feed carousel** — 1080×1350 (4:5), PNG, 8 slides, text ≥96 px from edges. Files `fc-ig-carousel-0N-<slug>.png`.

| ✓ | # | Headline | Sub |
|---|---|---|---|
| ☐ | 01 hook | Your best AI prompt from three weeks ago. | Find it. Right now. |
| ☐ | 02 problem | Prompt history is a graveyard. | Screenshots. Text files. A Notes doc you'll never reopen. |
| ☐ | 03 shift | Framecraft makes it a library that learns. | Local-first. Mac & Windows. |
| ☐ | 04 proof | Build from tokens scored by your own wins. | Proven combinations surface on their own. |
| ☐ | 05 proof | Judge 2–4 outputs. Pick a winner. | The decision writes back onto the real records. |
| ☐ | 06 proof | It tells you what to stop doing. | Recurring mistakes become a personal avoid list. |
| ☐ | 07 trust | Nothing leaves your machine. | Portable SQLite library. Your own API key. |
| ☐ | 08 CTA | Framecraft: AI Prompt Studio | On the Mac App Store. Link in bio. |

- ☐ Publish carousel post (caption below)

```
You nailed the perfect prompt once. Then you lost it.

Framecraft is a local-first app that treats AI prompt engineering as a production discipline with memory. Every prompt, reference, result, and rating feeds a token library that learns which combinations actually win — and a Comparison Lab where judging 2–4 outputs writes the winner back onto the real records.

It doesn't generate anything itself. It manages the prompts and hands off to whatever you already use — Midjourney, DALL·E, Stable Diffusion, Nano Banana, Seedance, Kling.

Local-first. Portable SQLite library. Bring your own API key.

Framecraft: AI Prompt Studio — on the Mac App Store. Link in bio.

#midjourney #aiart #promptengineering #aivideo #generativeai #creativedirection #adcreative #aitools #madewithai
```

**Reel / Story** — 1080×1920 (9:16), MP4 H.264+AAC 30 fps, 15–30 s. Content in centre 1080×1420 (top ~250 px / bottom ~420 px covered).

- ☐ `fc-ig-reel-core-loop.mp4`
- ☐ `fc-ig-story-core-loop.mp4`

| Time | Visual | Caption |
|---|---|---|
| 0–2s | typed line on black | I stopped losing my best AI prompts. |
| 2–6s | Prompt Craft, dragging proven tokens | Build from tokens scored by my wins |
| 6–10s | Copy → Queue → drop in results | Batch out. Pull results back. |
| 10–16s | Comparison Lab 4-up → Winner → Apply | Judge 4 outputs. Winner trains the library. |
| 16–21s | Dashboard: winners tick up, tokens reorder | Every rating makes the next prompt better |
| 21–25s | icon + wordmark | Framecraft: AI Prompt Studio — Mac App Store |

**IG Ads** — same assets. Extra crops + field values:

- ☐ `fc-ig-ad-feed-01.png` (1080×1350)
- ☐ `fc-ig-ad-square-01.png` (1080×1080)
- ☐ `fc-ig-ad-story-01.mp4` (1080×1920, first 15 s)

```
Primary text:  Stop rediscovering your best AI prompts. A local-first library that learns which combinations win.
Headline:      The prompt library that learns
Description:   Local-first. Bring your own key.
CTA button:    Download
```

### 5.3 X / Twitter

- ☐ `fc-x-single-01.png` — 1600×900 (16:9), PNG. Comparison Lab 4-up + headline overlay.
- ☐ `fc-x-video-01.mp4` — 1920×1080, ≤2:20, MP4 H.264+AAC, ≤512 MB.
- ☐ Publish thread (below)

```
1/ You wrote the perfect Midjourney prompt three weeks ago. Can you find it right now?
Framecraft is a local-first app that treats AI prompt engineering as a production discipline with memory. ↓

2/ Build a prompt field-by-field or free text. A token library scored by YOUR past results surfaces the combinations that actually won. Proven combos, recurring-mistake flags, a formula bar that learns your structure per provider.

3/ Generate, then judge. Comparison Lab: 2–4 outputs side by side, structured scoring, an AI verdict. Mark a winner and it writes back onto the real records — reordering your proven tokens and your personal "avoid" list.

4/ It never phones home. Your library is a portable SQLite file — your machine, a drive, or a NAS the whole team points at. AI features use your own Anthropic / OpenAI / DeepSeek key.

5/ It doesn't generate anything itself — it hands off to Midjourney, DALL·E, Stable Diffusion, Nano Banana, Seedance, Kling. Framecraft: AI Prompt Studio — on the Mac App Store: <link>
```

### 5.4 YouTube & TikTok

| ✓ | Asset | Size | Length | File |
|---|---|---|---|---|
| ☐ | YouTube walkthrough | 1920×1080 | 2–4 min | `fc-yt-walkthrough.mp4` |
| ☐ | YouTube thumbnail | 1280×720, <2 MB | — | `fc-yt-thumb-01.png` (Comparison Lab crop + `AI PROMPTS THAT LEARN`) |
| ☐ | Shorts / TikTok / Reels | 1080×1920 | 15–40 s | `fc-short-core-loop.mp4` (reuse §5.2 Reel, native captions; safe zone centre 1080×1420, avoid top 250 / bottom 480) |

**Walkthrough outline:** problem → the loop (diagram) → Prompt Craft demo → Queue → Comparison Lab + what changes downstream → Cinema Studio (fast) → Dashboard payoff → local-first + pricing → CTA.

**Shorts hook variants:** `POV: you never lose a good AI prompt again` · `The AI prompt tool that remembers what failed` · `I rate every AI image I generate. Here's why.`

**Audio:** organic Shorts/TikTok can use a trending sound; **paid** and the App Store preview must use owned/licensed audio.

---

## 6. Video capture — record once, reuse

Record each feature **once** at master quality, then cut per destination.

**Master:** 2560×1600 (app window 1280×800 on Retina) · 60 fps · smooth cursor, no click-ripple · clean demo library, no real keys/paths/client names · 60–120 s · music-free · `fc-cap-<feature>-master.mov`.

- ☐ `fc-cap-prompt-craft-master.mov`
- ☐ `fc-cap-queue-import-master.mov`
- ☐ `fc-cap-comparison-lab-master.mov`
- ☐ `fc-cap-cinema-shot-master.mov`
- ☐ `fc-cap-dashboard-payoff-master.mov`
- ☐ `fc-cap-references-impact-master.mov`
- ☐ `fc-cap-recipes-master.mov`

**Cut-down targets** (each master feeds several):

| Destination | Size | Length | Format | Captions |
|---|---|---|---|---|
| App Store App Preview | 1920×1080 / 3840×2160 | 15–30 s | `.mov` H.264 / ProRes 422 HQ, 30 fps | minimal, app-only, no slogans over UI |
| Storefront gallery loop | 1600×1000 | 12–20 s | MP4 H.264, muted, loop | none |
| Docs embed | 1600×1000 | 8–20 s | MP4 + WebM, muted, loop | none |
| IG Reel / Story · TikTok · Shorts | 1080×1920 | 15–40 s | MP4 H.264+AAC | burned-in |
| IG feed video | 1080×1350 | ≤60 s | MP4 H.264+AAC | burned-in |
| X video | 1920×1080 | ≤2:20 | MP4 H.264+AAC, ≤512 MB | optional |
| YouTube walkthrough | 1920×1080 | 2–4 min | MP4 H.264+AAC | auto + reviewed |

**Rules:** App Store cut = app screen only, no hands/devices/graphic intros, strong populated first frame. For 9:16, re-frame to the active panel — don't letterbox. Scrub any frame showing a real key/path before export.

---

## 7. Rollup

**Icon**
- ☐ `framecraft-icon-master.png` delivered to `store-assets/icon-src/`
- ☐ Icon pipeline run (bundle icons + 1024 marketing icon, no alpha, `npm test` + `cargo check`)

**Mac App Store**
- ☐ All §2.1 text fields entered
- ☐ 10 screenshots (`fc-appstore-01…10`)
- ☐ App Preview video (`fc-appstore-preview-01.mov`)
- ☐ Price tier set · age rating · privacy questionnaire · build attached · submitted for review

**Storefront (`web_three`)**
- ☐ `storeProducts.json` `framecraft` entry updated
- ☐ `framecraft-hero.webp` + 6 gallery stills + `framecraft-loop.mp4` + `framecraft-icon.png` in place
- ☐ `appStoreUrl` set once MAS is live

**Docs (`docs-site`)**
- ☐ ~24 screenshots in `public/screenshots/`
- ☐ OG image · favicon · core-loop diagram
- ☐ 3 feature loop videos in `public/media/`
- ☐ Image links wired into the `.md` pages with `/framecraft/` prefix
- ☐ Rebuilt + deployed

**Social**
- ☐ IG carousel (8 slides) + post
- ☐ IG Reel + Story
- ☐ IG ad crops (feed / square / story)
- ☐ X single image + video + thread
- ☐ YouTube walkthrough + thumbnail
- ☐ Shorts / TikTok vertical

**Video masters**
- ☐ 7 `fc-cap-*-master.mov` recorded

---

## 8. Open decisions

- ☐ **App Store price tier** — pick to match €29 in App Store Connect.
- ☐ **Listing name** — record was created as "Framecraft — AI Studio"; this package uses **"Framecraft: AI Prompt Studio"**. Update the field to match, or tell me to revert the doc.
- ☐ **Localizations** — en-US only here; add locales later if wanted.
- ☐ **Music** — choose one licensed track for the App Store preview + paid social.
- ☐ **Demo library** — build one clean, populated, name-safe library; reuse it for every screenshot and recording across App Store, storefront, docs, social.
- ☐ **Icon handoff** — drop Icon Composer output in `store-assets/icon-src/`, then ping me to run the pipeline.
- ☐ **`docs/app-store-metadata.md`** — older copy still there; reconcile it to §2 or fold it in and delete.
- ☐ **Store Manager vs direct JSON edit** — decide which owns the Framecraft storefront copy so a publish doesn't clobber hand edits (see §3.1 caveat).
