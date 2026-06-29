# Page Transitions Design

## Goal

Replace hard cuts between routed pages with a subtle opacity fade while keeping the application shell stable.

## Scope

- Animate routed page content on every pathname change, including changes to route parameters.
- Keep the top bar, sidebar, command search, shortcut modal, and toast container outside the transition.
- Do not animate search-parameter-only or hash-only URL changes.
- Respect the operating system's reduced-motion preference by disabling the transition.

## Architecture

Add a focused `PageTransition` component at the `AppShell` outlet boundary. The component reads the current location and renders the route outlet inside Framer Motion's `AnimatePresence` and `motion` primitives.

The motion container is keyed by `location.pathname`. This makes every pathname change create a new transition boundary, including navigation between two records handled by the same route pattern. `AnimatePresence` uses `mode="wait"` so the outgoing page finishes before the incoming page appears, preventing two full page layouts from overlapping.

## Motion

- Property: opacity only
- Enter: opacity 0 to 1
- Exit: opacity 1 to 0
- Duration: 160 milliseconds
- Easing: a restrained ease-out curve
- Reduced motion: render at full opacity with zero-duration transitions

The transition container must preserve the outlet's usable width and minimum height so it does not alter existing page layout or scrolling behavior.

## Testing

Add focused component tests that verify:

1. The rendered motion boundary is keyed by pathname, so route-parameter changes transition.
2. Search-parameter-only changes retain the same transition key.
3. The component applies the intended opacity transition configuration.
4. Reduced-motion preference disables animation.

Run the focused tests first, then the complete Vitest suite, TypeScript check, and production build.

## Non-goals

- Direction-aware navigation animations
- Slide, scale, blur, or spring effects
- Animating persistent shell chrome
- Transitioning on query-string or hash changes
- Per-page custom transition variants
