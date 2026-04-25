"use client";

import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

// ── Service worker ────────────────────────────────────────────────────────────

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

// ── Backend keep-alive (prevents Vercel cold starts) ─────────────────────────

function BackendKeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${BACKEND_URL}/health`, { mode: "no-cors" }).catch(() => {});
    ping();
    const id = setInterval(ping, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

// ── PWA install banner ────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden, reveal after checks

  useEffect(() => {
    // Already installed (running in standalone / TWA)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    // Previously dismissed this session
    if (sessionStorage.getItem("pwa-banner-dismissed")) return;

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent); // not Chrome/Firefox on iOS

    if (isIos) {
      // iOS Safari doesn't fire beforeinstallprompt — show manual instructions
      setShowIos(true);
      setDismissed(false);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 80,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9990,
        width: "min(360px, calc(100vw - 32px))",
        background: "#fff",
        border: "1px solid #e5e5e5",
        borderRadius: 16,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
        fontFamily: "inherit",
        animation: "pwa-slide-up 0.25s ease forwards",
      }}
    >
      {/* App icon */}
      <img
        src="/icon-192.png"
        alt="KEC Archives"
        style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, objectFit: "contain" }}
      />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111" }}>
          Install KEC Archives
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#737373", lineHeight: 1.4 }}>
          {showIos
            ? 'Tap the share icon then "Add to Home Screen"'
            : "Add to home screen for the best experience"}
        </p>
      </div>

      {/* Action */}
      {!showIos && (
        <button
          onClick={install}
          style={{
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 20,
            padding: "6px 13px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          Install
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={dismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#bbb",
          padding: 2,
          flexShrink: 0,
          fontSize: 14,
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Root providers ────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerRegistrar />
      <BackendKeepAlive />
      <PwaInstallBanner />
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
