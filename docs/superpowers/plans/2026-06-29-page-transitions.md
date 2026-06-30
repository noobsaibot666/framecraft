# Page Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fade routed page content on every pathname change without animating the persistent application shell.

**Architecture:** Replace the `AppShell` outlet with a focused `PageTransition` component that captures the current outlet element. It keys Framer Motion presence by `location.pathname`, uses a 160ms opacity-only wait transition, and disables motion when `useReducedMotion` is true.

**Tech Stack:** React 19, React Router 7, Framer Motion 12, TypeScript, Vitest

---

### Task 1: Page transition behavior

**Files:**
- Create: `src/components/layout/PageTransition.tsx`
- Create: `src/components/layout/PageTransition.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getPageTransitionKey, getPageTransitionProps } from "./PageTransition";

describe("PageTransition", () => {
  it("keys transitions by pathname only", () => {
    expect(getPageTransitionKey({ pathname: "/results/view/1", search: "?tab=a", hash: "" }))
      .toBe("/results/view/1");
    expect(getPageTransitionKey({ pathname: "/results/view/2", search: "?tab=a", hash: "" }))
      .toBe("/results/view/2");
  });

  it("uses a subtle opacity-only transition", () => {
    expect(getPageTransitionProps(false)).toEqual({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.16, ease: "easeOut" },
    });
  });

  it("disables animation when reduced motion is requested", () => {
    expect(getPageTransitionProps(true)).toEqual({
      initial: false,
      animate: { opacity: 1 },
      exit: { opacity: 1 },
      transition: { duration: 0 },
    });
  });
});
```

- [x] **Step 2: Run the test and verify RED**

Run: `npm test -- src/components/layout/PageTransition.test.ts`

Expected: FAIL because `./PageTransition` does not exist.

- [x] **Step 3: Implement the component and tested configuration**

```tsx
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet, type Location } from "react-router-dom";

type TransitionLocation = Pick<Location, "pathname" | "search" | "hash">;

export function getPageTransitionKey(location: TransitionLocation) {
  return location.pathname;
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
    transition: { duration: 0.16, ease: "easeOut" as const },
  };
}

export function PageTransition() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={getPageTransitionKey(location)}
        className="min-h-full w-full"
        {...getPageTransitionProps(Boolean(reduceMotion))}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [x] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/components/layout/PageTransition.test.ts`

Expected: 3 tests pass.

### Task 2: Integrate the transition at the outlet boundary

**Files:**
- Modify: `src/components/layout/AppShell.tsx`

- [x] **Step 1: Replace the outlet rendering with `PageTransition`**

```tsx
import { PageTransition } from "./PageTransition";

<main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
  <PageTransition />
</main>
```

- [x] **Step 2: Run focused tests and TypeScript validation**

Run: `npm test -- src/components/layout/PageTransition.test.ts && npx tsc --noEmit`

Expected: 3 tests pass and TypeScript exits 0.

### Task 3: Full verification

**Files:**
- Verify only

- [x] **Step 1: Run all automated checks**

Run: `npm test && npx tsc --noEmit && npm run build`

Expected: all tests pass, TypeScript exits 0, and Vite creates the production bundle.

- [x] **Step 2: Inspect the scoped diff**

Run: `git diff --check && git diff -- src/components/layout/PageTransition.tsx src/components/layout/PageTransition.test.ts src/components/layout/AppShell.tsx`

Expected: no whitespace errors; the diff contains only the transition component, tests, and outlet integration.
