import { useCallback, useEffect, useRef, useState } from "react";
import { imageDisplaySrc, isStoredImagePath, readImageAsDataUrl } from "./fileStore";
import { createLatestRequestGuard } from "./latestRequest";

export function useImageDisplaySrc(source: string | undefined): {
  src: string | undefined;
  onError: () => void;
} {
  const [fallbackSrc, setFallbackSrc] = useState<string | undefined>();
  const attemptedFallback = useRef(false);
  const requestGuard = useRef(createLatestRequestGuard());

  const loadFallback = useCallback(() => {
    if (!isStoredImagePath(source) || attemptedFallback.current) return;
    const filePath = source;
    if (!filePath) return;
    attemptedFallback.current = true;
    const token = requestGuard.current.begin();
    readImageAsDataUrl(filePath)
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
