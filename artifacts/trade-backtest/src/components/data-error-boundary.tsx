import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  label?: string;
  compact?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class DataErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[DataErrorBoundary:${this.props.label ?? "unknown"}]`, error.message, info.componentStack);
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { label = "chart", compact = false } = this.props;

    if (compact) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "16px",
            borderRadius: "12px",
            border: "1px solid rgba(239,68,68,0.2)",
            background: "rgba(239,68,68,0.05)",
            fontSize: "12px",
            color: "#f87171",
          }}
        >
          <AlertTriangle style={{ height: "14px", width: "14px", flexShrink: 0 }} />
          <span>Failed to render {label}</span>
          <button
            onClick={this.reset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginLeft: "4px",
              padding: "3px 8px",
              borderRadius: "6px",
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.08)",
              color: "#f87171",
              fontSize: "11px",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ height: "10px", width: "10px" }} />
            Retry
          </button>
        </div>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "32px 24px",
          borderRadius: "16px",
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.04)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
          }}
        >
          <AlertTriangle style={{ height: "20px", width: "20px", color: "#ef4444" }} />
        </div>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: "4px" }}>
            {label.charAt(0).toUpperCase() + label.slice(1)} failed to render
          </p>
          <p style={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
            An error occurred while displaying this {label}. Your data is safe.
          </p>
          {this.state.error && (
            <details style={{ marginTop: "8px" }}>
              <summary style={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", cursor: "pointer" }}>
                Error details
              </summary>
              <pre
                style={{
                  marginTop: "6px",
                  fontSize: "10px",
                  color: "#f87171",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "6px",
                  padding: "8px",
                  textAlign: "left",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
        <button
          onClick={this.reset}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.08)",
            color: "#f87171",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <RefreshCw style={{ height: "13px", width: "13px" }} />
          Try again
        </button>
      </div>
    );
  }
}
