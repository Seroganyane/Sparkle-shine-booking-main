import React from "react";
import { supabase } from "@/integrations/supabase/client";

type State = { hasError: boolean; error?: Error };

// Only one alert per page load, even if the fallback's "Reload" button
// re-triggers the same crash — this file has no React state that survives
// a crash-and-retry loop, so a module-level flag is what keeps this from
// turning into a flood of identical emails.
let hasReportedThisLoad = false;

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

    if (hasReportedThisLoad) return;
    hasReportedThisLoad = true;
    void supabase.functions.invoke("send-admin-alert", {
      body: {
        subject: "Uncaught crash in the app",
        message: `A page crashed for a visitor.\n\nError: ${error.message}\n\nURL: ${window.location.href}\n\nStack: ${error.stack ?? "(no stack trace)"}`,
        severity: "critical",
      },
      // Best-effort — if email isn't configured yet, this silently no-ops
      // rather than compounding the crash with a second failure.
    }).catch(() => {});
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
