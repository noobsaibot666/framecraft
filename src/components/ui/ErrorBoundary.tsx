import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Copy } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null, copied: false });
  };

  handleCopy = async () => {
    if (!this.state.error) return;
    const text = [
      `Error: ${this.state.error.message}`,
      this.state.error.stack ?? "",
    ].join("\n\n");
    await navigator.clipboard.writeText(text).catch(() => {});
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 1500);
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-64 p-8 gap-6">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle size={24} className="text-red/60" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-red/70">
              Something went wrong
            </span>
          </div>

          <div
            className="w-full max-w-lg px-4 py-3 rounded-sm overflow-auto"
            style={{ background: "rgba(215,25,33,0.04)", border: "1px solid rgba(215,25,33,0.2)" }}
          >
            <pre className="font-mono text-[10px] text-red/70 whitespace-pre-wrap break-words select-text leading-relaxed">
              {this.state.error.message}
            </pre>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-readable hover:text-white transition-precise px-3 py-2 rounded-sm"
              style={{ border: "var(--border-dim)" }}
            >
              <RefreshCw size={10} /> Try Again
            </button>
            <button
              type="button"
              onClick={this.handleCopy}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-dim/60 hover:text-white transition-precise px-3 py-2 rounded-sm"
              style={{ border: "var(--border-dim)" }}
            >
              <Copy size={10} />
              {this.state.copied ? "Copied" : "Copy Error"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
