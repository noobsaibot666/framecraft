import { useCallback, useEffect, useRef, useState } from "react";
import { imageDisplaySrc, isStoredImagePath, readImageAsDataUrl } from "./fileStore";
import { createLatestRequestGuard } from "./latestRequest";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Shared across every hook instance so the same CDN URL (e.g. a result shown
// in both the card cover and the carousel) is only ever fetched once per
// session, and concurrent <img> failures for the same src share one request.
const urlFallbackCache = new Map<string, Promise<string>>();

function fetchUrlFallback(url: string): Promise<string> {
  let pending = urlFallbackCache.get(url);
  if (!pending) {
    pending = import("./fetchImageUrl").then(({ fetchImageAsDataUrl }) => fetchImageAsDataUrl(url));
    urlFallbackCache.set(url, pending);
    pending.catch(() => urlFallbackCache.delete(url));
  }
  return pending;
}

export function useImageDisplaySrc(source: string | undefined): {
  src: string | undefined;
  onError: () => void;
} {
  const [fallbackSrc, setFallbackSrc] = useState<string | undefined>();
  const attemptedFallback = useRef(false);
  const requestGuard = useRef(createLatestRequestGuard());

  const loadFallback = useCallback(() => {
    if (!source || attemptedFallback.current) return;
    attemptedFallback.current = true;
    const token = requestGuard.current.begin();

    if (isStoredImagePath(source)) {
      readImageAsDataUrl(source)
        .then((dataUrl) => {
          if (requestGuard.current.isCurrent(token) && dataUrl.startsWith("data:")) setFallbackSrc(dataUrl);
        })
        .catch(() => {});
      return;
    }

    // Direct http(s) URL whose <img> tag load failed — most likely a CDN with
    // bot protection (e.g. Cloudflare on cdn.midjourney.com) blocking the plain
    // WebView request. Retry through the native OS HTTP stack, which presents a
    // real browser TLS fingerprint and can get past it.
    if (!isTauri || !/^https?:\/\//.test(source)) return;
    fetchUrlFallback(source)
      .then((dataUrl) => {
        if (requestGuard.current.isCurrent(token) && dataUrl.startsWith("data:")) setFallbackSrc(dataUrl);
      })
      .catch(() => {});
  }, [source]);

  useEffect(() => {
    requestGuard.current.invalidate();
    attemptedFallback.current = false;
    setFallbackSrc(undefined);
    if (source && !imageDisplaySrc(source)) loadFallback();
    return () => requestGuard.current.invalidate();
  }, [loadFallback, source]);

  return {
    src: fallbackSrc ?? imageDisplaySrc(source),
    onError: loadFallback,
  };
}
