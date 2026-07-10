# References (`/references`)

Library of **visual input material** — images and videos you feed *into* prompts as inspiration or generation input. Distinct from the Prompt Library: Library holds the text prompts you write; References holds the pictures that inform or accompany them.

## Where references come from

- Uploaded/dropped directly on this page
- **Save as Reference** on a Result — turn one of your own generated outputs into reusable material
- Image Analyzer — save an analyzed image as a reference
- Video Frames — extract and save a frame from a video
- Attached to a Project's mood board (shown back to you as "Inspirations" when crafting prompts inside that project)

## Why use it

A reference isn't just stored — it gets **linked** to the prompts and results it influenced (with a role: style, composition, lighting, product, character, frame, or failure-example). That link is what makes references useful for more than just browsing:

- In Prompt Craft, a project's linked references surface as **Inspirations**, and the project's best-performing references surface as **Impact Refs** — suggestions for what to reuse
- **Impact score** answers "does this image actually correlate with winners?" — weighted 60% on results it was directly linked to that won (a causal signal: it was used in that exact generation) and 40% on projects it's attached to whose prompts won. A reference with a high score is worth reusing; one with none is just inventory.

## What you can do
- Browse references as cards: thumbnail, kind badge, title, tags, best-use note, risk-notes warning, star rating, win count, provider
- Search by title/tags/notes (debounced); filter by kind (Image/Frame/Result/Source/Mood/Product/Style) and by rating (any/rated/unrated/3+/4+)
- Drag-and-drop images or videos straight onto the library to import as new references
- Delete a reference from its card (two-click confirm)
- Open a reference to edit its full record or create a new one

## Reference Library — header action
Add Reference

## Reference Detail (`/references/:id`, `/references/new`)

- **Image/video** — drop zone, click to browse, replace on hover
- **Title, Kind, Description, Best Use, Risk Notes, Notes**
- **Rating** — 5-star; once saved, shows Impact (win rate % from linked prompts/results that became winners)
- **Metadata** — Provider, Category, Source URL, Tags
- **Linked To** — prompts and results that reference this image, each labeled by role (Style/Composition/Lighting/Product/Character/Frame/Failure Example)
- Save creates or updates; Delete removes it (two-click confirm)
