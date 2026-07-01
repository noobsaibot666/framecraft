export function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Loading view…</span>
    </div>
  );
}
