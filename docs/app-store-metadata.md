# App Store Connect Metadata

Ready-to-paste copy for the Mac App Store listing, sized to Apple's actual limits. Adjust before submitting.

## App name (30 char limit)

```
Framecraft — AI Studio
```

("Framecraft" alone was already taken by another developer on the App Store — this is the App Store *listing* name only; bundle ID, product name, and branding everywhere else stay "Framecraft".)

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

- **Attach the build in App Store Connect** — uploaded successfully (Delivery UUID `924f280c-bbdc-4fe8-a0de-dcdf52e1285c`, 2026-08-03), but still needs to be selected on the version page once it finishes processing, then submitted for review.
- **App Privacy questionnaire, age rating, pricing tier** — confirm these are filled in before submitting.

Not blocking, already resolved:

- Bundle ID `com.alan.framecraft` registered, App Store Connect record created (listing name "Framecraft — AI Studio" — "Framecraft" alone was already taken).
- Provisioning profile downloaded and embedded; signing certs (3rd Party Mac Developer Application/Installer, Team RD7UU4Z3D2) reused from the Darkwave/CD Suite submissions.
- `scripts/mac_sign_and_package_mas.sh` run successfully — `builds/Framecraft_SUBMISSION.pkg` built, signed, and uploaded via `altool`.
- Sandboxed + direct-sale dual-build config (`tauri.mas.conf.json` / `tauri.direct.conf.json`), entitlements, and `Info.plist` export-compliance key all in place.
- Direct-sale licensing (Ed25519 + HWID + 14-day trial, `src-tauri/src/license.rs`) and security-scoped bookmarks for sandboxed "portable" libraries (`src-tauri/src/library_bookmark.rs`) implemented and unit-tested.
- Licensing server knows about Framecraft (`web_three/licensing-server/products.js`), a real Stripe product + €29 price exist, the storefront listing is live, and all endpoints verified working in production.
- Docs site (Privacy/EULA/Support/Licensing pages) deployed and live at docs.alan-design.com/framecraft/.
