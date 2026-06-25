import { useCallback, useEffect, useRef, useState } from "react";
import { imageDisplaySrc, isStoredImagePath, readImageAsDataUrl } from "./fileStore";

export function useImageDisplaySrc(source: string | undefined): {
  src: string | undefined;
  onError: () => void;
} {
  const [fallbackSrc, setFallbackSrc] = useState<string | undefined>();
  const attemptedFallback = useRef(false);

  const loadFallback = useCallback(() => {
    if (!isStoredImagePath(source) || attemptedFallback.current) return;
    const filePath = source;
    if (!filePath) return;
    attemptedFallback.current = true;
    readImageAsDataUrl(filePath)
      .then((dataUrl) => {
        if (dataUrl.startsWith("data:")) setFallbackSrc(dataUrl);
      })
      .catch(() => {});
  }, [source]);

  useEffect(() => {
    attemptedFallback.current = false;
    setFallbackSrc(undefined);
    if (source && !imageDisplaySrc(source)) loadFallback();
  }, [loadFallback, source]);

  return {
    src: fallbackSrc ?? imageDisplaySrc(source),
    onError: loadFallback,
  };
}
