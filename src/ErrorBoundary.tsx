import React from "react";

type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Full technical detail goes to the console for developers; the end user
    // only ever sees the friendly fallback below, never a raw stack trace.
    // eslint-disable-next-line no-console
    console.error("Uncaught error in component tree:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "grid", minHeight: "100vh", placeItems: "center", padding: 24, fontFamily: "Inter, system-ui, sans-serif", background: "#f8fafc" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>Something went wrong</h1>
            <p style={{ marginTop: 8, color: "#475569" }}>
              This page hit an unexpected error. Your data is safe — nothing was lost. Try reloading, or go back to the home page.
            </p>
            <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => window.location.reload()}
                style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#0ea5e9", color: "#fff", fontWeight: 600, cursor: "pointer" }}
              >
                Reload page
              </button>
              <a
                href="/"
                style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 600, textDecoration: "none" }}
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}
