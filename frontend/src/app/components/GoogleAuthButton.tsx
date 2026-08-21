"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { persistAuthSession } from "@/lib/auth-session";
import { SESSION_MARKER } from "@/app/utils/auth";
import styles from "./GoogleAuthButton.module.css";

type GoogleResponse = { credential: string };
type GoogleStartResponse = {
  action: "authenticated" | "link_required" | "onboarding_required" | "verification_required";
  access_token?: string;
  role?: string;
  message?: string;
  onboarding_token?: string;
  profile?: { email: string; first_name?: string; last_name?: string };
};
type Props = {
  onAuthenticated: (role: string, token: string) => void;
  onOnboarding?: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
        };
      };
    };
  }
}

export default function GoogleAuthButton({ onAuthenticated, onOnboarding }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkCredential, setLinkCredential] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const finishAuthentication = useCallback(async (data: GoogleStartResponse) => {
    if (!data.access_token || !data.role) throw new Error("Invalid authentication response");
    await persistAuthSession({ access_token: data.access_token, role: data.role });
    onAuthenticated(data.role, SESSION_MARKER);
  }, [onAuthenticated]);

  const handleCredential = useCallback(async ({ credential }: GoogleResponse) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/start`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = (await response.json().catch(() => ({}))) as GoogleStartResponse & { detail?: string };
      if (!response.ok) throw new Error(data.detail || "Google authentication failed");

      if (data.action === "authenticated") {
        await finishAuthentication(data);
      } else if (data.action === "link_required") {
        setLinkCredential(credential);
      } else if (data.action === "onboarding_required") {
        sessionStorage.setItem("googleOnboarding", JSON.stringify({ token: data.onboarding_token, profile: data.profile }));
        onOnboarding?.();
      } else {
        setError(data.message || "Please complete account verification before logging in.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Google authentication failed");
    } finally {
      setBusy(false);
    }
  }, [finishAuthentication, onOnboarding]);

  const linkAccount = async () => {
    if (!linkPassword) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/auth/google/link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: linkCredential, password: linkPassword }),
      });
      const data = (await response.json().catch(() => ({}))) as GoogleStartResponse & { detail?: string };
      if (!response.ok) throw new Error(data.detail || "Unable to link Google account");
      if (data.action === "authenticated") await finishAuthentication(data);
      else setError(data.message || "Verify your OurSkin email before logging in.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to link Google account");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!scriptReady || !clientId || !window.google || !containerRef.current) return;
    containerRef.current.replaceChildren();
    window.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential, ux_mode: "popup" });
    window.google.accounts.id.renderButton(containerRef.current, {
      type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "pill", width: 360,
    });
    return () => window.google?.accounts.id.cancel();
  }, [scriptReady, clientId, handleCredential]);

  if (!clientId) return null;

  return (
    <div className={styles.wrapper} aria-busy={busy}>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setScriptReady(true)} onError={() => setError("Google sign-in could not be loaded.")} />
      <div className={styles.divider}><span>or</span></div>
      <div ref={containerRef} className={styles.googleButton} />
      {busy && <p className={styles.status}>Authenticating securely…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      {linkCredential && (
        <div className={styles.linkPanel}>
          <p>This email already has an OurSkin account. Enter its password to link Google without changing your role or profile.</p>
          <input type="password" value={linkPassword} onChange={(event) => setLinkPassword(event.target.value)} placeholder="Existing OurSkin password" aria-label="Existing OurSkin password" disabled={busy} />
          <div className={styles.linkActions}>
            <button type="button" onClick={() => { setLinkCredential(""); setLinkPassword(""); }} disabled={busy}>Cancel</button>
            <button type="button" onClick={linkAccount} disabled={busy || !linkPassword}>Link and continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
