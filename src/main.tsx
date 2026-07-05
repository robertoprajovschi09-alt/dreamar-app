import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "./lib/theme";
import { ToastProvider } from "./lib/toast";
import { WorkspaceProvider } from "./lib/workspace";
import { DateRangeProvider } from "./lib/daterange";
import { AuthProvider } from "./lib/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <DateRangeProvider>
            <ToastProvider>
              <ErrorBoundary>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </ErrorBoundary>
            </ToastProvider>
          </DateRangeProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// Register the PWA service worker in production only (it would fight Vite's HMR
// in dev). Gives fast repeat loads; the SW keeps navigations network-first so
// Cloudflare deploys are never stuck behind a stale cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* non-fatal */ });
  });
}
