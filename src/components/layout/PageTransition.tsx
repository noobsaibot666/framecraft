import { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet, type Location } from "react-router-dom";

type TransitionLocation = Pick<Location, "pathname" | "search" | "hash">;

export function getPageTransitionKey(location: TransitionLocation) {
  // Include search so /library/a → /library/b triggers distinct transitions.
  return location.pathname + location.search;
}

export function getPageTransitionProps(reduceMotion: boolean) {
  if (reduceMotion) {
    return {
      initial: false as const,
      animate: { opacity: 1 },
      exit: { opacity: 1 },
      transition: { duration: 0 },
    };
  }

  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    // 100ms crossfade — fast enough to feel instant, long enough to feel polished.
    transition: { duration: 0.1, ease: "easeOut" as const },
  };
}

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();
  const key = getPageTransitionKey(location);

  // Freeze each route's outlet so AnimatePresence renders the correct (old) content
  // during exit rather than the new route's content. Without this, both the exiting
  // and entering elements would show the new page during the crossfade.
  const outletCache = useRef<Map<string, React.ReactNode>>(new Map());
  if (outlet) {
    outletCache.current.set(key, outlet);
  }

  return (
    // mode="sync" = old and new pages crossfade simultaneously, zero black gap.
    // mode="wait" caused a visible gap between exit and enter.
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={key}
        className="min-h-full w-full"
        // will-change hints the GPU to composite this layer, avoiding paint during fade.
        style={{ willChange: "opacity" }}
        {...getPageTransitionProps(Boolean(reduceMotion))}
      >
        {outletCache.current.get(key)}
      </motion.div>
    </AnimatePresence>
  );
}
