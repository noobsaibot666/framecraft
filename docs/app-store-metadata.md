# App Store Connect Metadata

Ready-to-paste copy for the Mac App Store listing, sized to Apple's actual limits. Adjust before submitting.

## App name (30 char limit)

```
Framecraft
```

## Subtitle (30 char limit)

```
AI Prompt Engineering Studio
```

## Promotional text (170 char limit, editable anytime without a new review)

```
Build, queue, compare, and learn from every AI image and video generation — a local-first prompt library that gets better the more you use it.
```

## Description (4000 char limit)

```
Framecraft is a local-first desktop app for AI image and video prompt engineering, built for creatives who need their winning prompts to be reusable — not rediscovered every time.

THE CORE LOOP
Prompt → Reference → Result → Rating → Avoidance → Reuse. Every prompt you write, every reference image you feed in, every result you generate, and every rating you give feeds back into a library that gets measurably better at suggesting what to try next and what to avoid.

PROMPT CRAFT
Build, version, and save a prompt with a formula bar that learns your successful structures per AI provider.

CINEMA STUDIO
Take a script through folder-organized shot direction, with an AI-generated director's brief for each shot — pre-production for AI-assisted video work.

GENERATION QUEUE
Batch-send prompts to your configured provider and pull results back automatically.

COMPARISON LAB
Put 2-4 candidate outputs side by side and decide a winner with structured scoring, not gut feel alone.

REFERENCE LIBRARY
Import and tag reference images, and see which ones actually influence winning results over time.

SELF-LEARNING LIBRARY
Token quality scoring, proven-combination recommendations, and recurring-mistake detection all improve automatically from your own ratings and comparisons — scoped to your own library, never shared or uploaded.

BUILT FOR VOLUME, NOT ONE-OFFS
For creative directors, art directors, and production teams running AI-assisted campaigns at a scale where consistency and repeatability matter more than a single lucky generation.

LOCAL-FIRST, NAS-PORTABLE
Your library is a portable SQLite file on your own machine, external drive, or NAS — not a hosted service. Point multiple machines at the same NAS-hosted library to share it across a team.

AI FEATURES USE YOUR OWN KEY
Prompt drafting and critique, image analysis, and Cinema Studio's director's brief call an AI provider you configure yourself (Anthropic, OpenAI, or DeepSeek) using your own API key.

Framecraft doesn't generate images or video itself — it manages prompts and orchestrates the hand-off to whichever provider you're already using (Midjourney, DALL·E, Stable Diffusion, GPT Image, Nano Banana, Seedance, Kling, and others).
```

## Keywords (100 char limit, comma-separated)

```
AI prompts,prompt engineering,midjourney,image generation,video prompts,creative direction
```

## Category

Primary: **Graphics & Design** (matches `bundle.category: "GraphicsAndDesign"` in `tauri.conf.json`). Productivity is a plausible secondary.

## Age rating

No objectionable content — expect 4+.

## Support URL / Marketing URL / Privacy Policy URL

Live at **<https://docs.alan-design.com/framecraft/>** once this build of the docs site is deployed:

- Support URL: `https://docs.alan-design.com/framecraft/legal/support/`
- Marketing URL: `https://docs.alan-design.com/framecraft/`
- Privacy Policy URL: `https://docs.alan-design.com/framecraft/legal/privacy-policy/`

Same deploy pattern as Darkwave/CD Suite's docs: rebuild locally (`npm run build` in `docs-site/`), swap `dist/` into the shared NAS mount, then restart the `docs-nginx` container.

## App Store icon (1024×1024, no alpha)

```
store-assets/framecraft-appstore-icon-1024.png
```

Generated from the real source art (`src/assets/icon/appicon.png`, 1254×1254), flattened onto an opaque `#0A0A0A` background (matches the app's own `--color-black`) and resized to exactly 1024×1024 — same squircle/padding proportions as the actual shipped bundle icon (`src-tauri/icons/icon.png`), just with the transparency required to be filled in since Apple's marketing icon can't carry an alpha channel. Give it a visual check before uploading.

## What's-New text (first submission)

```
Initial release.
```

## Submission status

Genuinely blocking, as of this writing:

- **Bundle ID registration** — `com.alan.framecraft` not yet registered with Apple.
- **App Store Connect record** — doesn't exist yet; needed before any build can be attached to a version.
- **Provisioning profile** — `src-tauri/embedded.provisionprofile` doesn't exist yet (needs the bundle ID registered first).
- **Screenshots** — one real screenshot exists (Dashboard, `public/assets/images/store/framecraft/framecraft-screenshot-dashboard.png` in `web_three`, used on the storefront). App Store Connect wants Mac screenshots at 1280×800 or 2880×1800 — resize/recapture before uploading there; more than one is recommended but not required.
- **Docs site deploy** — Privacy/EULA/Support/Licensing pages are written and build clean locally, but not yet pushed to the live NAS mount, so the URLs above 404 until that happens.
- **App Privacy questionnaire, age rating, pricing tier** — dashboard-only, not started.
- **Signing certificates** — no "3rd Party Mac Developer Application/Installer" certs confirmed present for this project yet (same Team RD7UU4Z3D2 as Darkwave/CD Suite — reuse if already issued for that team, otherwise request new ones).

Not blocking, already resolved:

- Sandboxed + direct-sale dual-build config (`tauri.mas.conf.json` / `tauri.direct.conf.json`), entitlements, and `Info.plist` export-compliance key all in place.
- Direct-sale licensing (Ed25519 + HWID + 14-day trial, `src-tauri/src/license.rs`) and security-scoped bookmarks for sandboxed "portable" libraries (`src-tauri/src/library_bookmark.rs`) implemented and unit-tested.
- Licensing server knows about Framecraft (`web_three/licensing-server/products.js`), a real Stripe product + €29 price exist, and the storefront listing is live.
- `scripts/mac_sign_and_package_mas.sh` / `scripts/deploy_direct_macos.sh` ready to run once certs + provisioning profile exist.
