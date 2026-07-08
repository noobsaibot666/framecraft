import { useRef, useState, type ReactNode } from "react";

/** Hover-and-hold tooltip — appears only after a deliberate pause (default 3s),
 * so short labels can stay uncluttered while full context is still one hover away. */
export function Tooltip({ text, children, delay = 3000, className }: {
  text: string;
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const clear = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  const show = () => {
    clear();
    timerRef.current = window.setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    clear();
    setVisible(false);
  };

  return (
    <div
      className={className ?? "relative inline-flex"}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2.5 rounded-sm font-mono text-[11px] leading-relaxed text-soft-white pointer-events-none"
          style={{ background: "var(--color-panel)", border: "var(--border-default)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
