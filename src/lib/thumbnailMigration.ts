/**
 * Background thumbnail migration.
 *
 * Retroactively fetches and compresses thumbnails for any prompt that has a
 * source_url but no thumbnail_data. Runs lazily after DB connection is ready,
 * processes one row at a time with a small delay so it never blocks the UI.
 */

import { fetchImageAsDataUrl, looksLikeThumbnailUrl } from "@/lib/fetchImageUrl";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** How long to wait between fetches so we don't hammer the network. */
const BETWEEN_MS = 300;

let migrationStarted = false;

/**
 * Custom DOM event fired on `window` whenever a thumbnail is saved.
 * Payload: CustomEvent<{ id: string; thumbnail_data: string }>
 */
export const THUMBNAIL_UPDATED_EVENT = "framecraft:thumbnail-updated";

/**
 * Start the background thumbnail migration.  Safe to call multiple times —
 * it only ever runs once per app session.
 *
 * @param db  The live framecraft DB handle (result of getFramecraftDb()).
 */
export function startThumbnailMigration(db: unknown): void {
  if (!isTauri || migrationStarted) return;
  migrationStarted = true;

  // Run completely detached — we never await this.
  void runMigration(db as DbHandle);
}

/** Reset for testing purposes. */
export function resetThumbnailMigrationForTests(): void {
  migrationStarted = false;
}

// ─── Internal ──────────────────────────────────────────────────────────────

interface DbHandle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

async function runMigration(db: DbHandle): Promise<void> {
  try {
    // Fetch all prompts that have a URL but no thumbnail yet.
    const rows = await db.select(
      `SELECT id, source_url FROM prompts
         WHERE thumbnail_data IS NULL
           AND source_url IS NOT NULL
           AND source_url != ''
         ORDER BY created_at DESC
         LIMIT 50`
    );

    if (rows.length === 0) return;

    console.info(`[thumbnail-migration] ${rows.length} prompts need thumbnails — fetching in background…`);

    for (const row of rows) {
      const id = row.id as string;
      const url = row.source_url as string;

      // Skip obvious non-image URLs (uses the same logic as ManualImport)
      if (!looksLikeThumbnailUrl(url)) continue;

      try {
        // fetchImageAsDataUrl uses JS fetch first to bypass Cloudflare bot protection, 
        // then falls back to Rust reqwest. Both eventually use Rust for resizing/compression.
        const thumb = await fetchImageAsDataUrl(url);
        if (thumb && thumb.startsWith("data:")) {
          await db.execute(
            `UPDATE prompts SET thumbnail_data = $1, updated_at = $2 WHERE id = $3`,
            [thumb, new Date().toISOString(), id]
          );
          console.info(`[thumbnail-migration] ✓ ${id}`);

          // Notify the UI so it can patch in-memory state without a full reload.
          window.dispatchEvent(
            new CustomEvent<{ id: string; thumbnail_data: string }>(THUMBNAIL_UPDATED_EVENT, {
              detail: { id, thumbnail_data: thumb },
            })
          );
        }
      } catch {
        // Silently skip — URL may be expired/unreachable
        console.info(`[thumbnail-migration] ✗ ${id} (skipped)`);
      }

      // Small pause between requests
      await sleep(BETWEEN_MS);
    }

    console.info("[thumbnail-migration] Done.");
  } catch (err) {
    // Never crash the app
    console.warn("[thumbnail-migration] Failed:", err);
  }
}

// looksLikeThumbnailUrl is imported from fetchImageUrl.ts — single source of truth.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
