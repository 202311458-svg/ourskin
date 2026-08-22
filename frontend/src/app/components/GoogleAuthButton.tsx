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
  theme?: "light" | "dark";
  dividerPosition?: "before" | "after";
  dividerText?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export default function GoogleAuthButton({
  onAuthenticated,
  onOnboarding,
  theme,
  dividerPosition = "before",
  dividerText = "or continue with",
}: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [buttonWidth, setButtonWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [linkCredential, setLinkCredential] = useState("");
  const [linkPassword, setLinkPassword] = useState("");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  const resolvedTheme =
    theme ??
    (typeof document !== "undefined" && document.body.classList.contains("darkMode")
      ? "dark"
      : "light");

  const finishAuthentication = useCallback(
    async (data: GoogleStartResponse) => {
      if (!data.access_token || !data.role) {
        throw new Error("Invalid authentication response");
      }

      await persistAuthSession({ access_token: data.access_token, role: data.role });
      onAuthenticated(data.role, SESSION_MARKER);
    },
    [onAuthenticated]
  );

  const handleCredential = useCallback(
    async ({ credential }: GoogleResponse) => {
      setBusy(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/auth/google/start`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        const data = (await response.json().catch(() => ({}))) as GoogleStartResponse & {
          detail?: string;
        };

        if (!response.ok) {
          throw new Error(data.detail || "Google authentication failed");
        }

        if (data.action === "authenticated") {
          await finishAuthentication(data);
        } else if (data.action === "link_required") {
          setLinkCredential(credential);
        } else if (data.action === "onboarding_required") {
          sessionStorage.setItem(
            "googleOnboarding",
            JSON.stringify({ token: data.onboarding_token, profile: data.profile })
          );
          onOnboarding?.();
        } else {
          setError(data.message || "Please complete account verification before logging in.");
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Google authentication failed");
      } finally {
        setBusy(false);
      }
    },
    [finishAuthentication, onOnboarding]
  );

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
      const data = (await response.json().catch(() => ({}))) as GoogleStartResponse & {
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || "Unable to link Google account");
      }

      if (data.action === "authenticated") {
        await finishAuthentication(data);
      } else {
        setError(data.message || "Verify your OurSkin email before logging in.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to link Google account");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (window.google?.accounts?.id) setScriptReady(true);
  }, []);

  useEffect(() => {
    const node = buttonRef.current;
    if (!node) return;

    const updateWidth = () => {
      const width = Math.floor(node.getBoundingClientRect().width);
      if (width > 0) setButtonWidth(Math.max(200, Math.min(width, 400)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !scriptReady ||
      !clientId ||
      !window.google?.accounts?.id ||
      !buttonRef.current ||
      buttonWidth === 0
    ) {
      return;
    }

    buttonRef.current.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      ux_mode: "popup",
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: resolvedTheme === "dark" ? "outline_dark" : "outline",
      size: "medium",
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
      width: buttonWidth,
    });
  }, [scriptReady, clientId, handleCredential, resolvedTheme, buttonWidth]);

  if (!clientId) return null;

  const divider = (
    <div
      className={`${styles.divider} ${dividerPosition === "after" ? styles.dividerAfter : ""}`}
      aria-hidden="true"
    >
      <span>{dividerText}</span>
    </div>
  );

  return (
    <div className={styles.wrapper} aria-busy={busy}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
        onError={() => setError("Google sign-in could not be loaded.")}
      />

      {dividerPosition === "before" && divider}

      <div ref={buttonRef} className={styles.buttonHost} />

      {busy && <p className={styles.status}>Connecting to Google…</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {linkCredential && (
        <div className={styles.linkPanel}>
          <p>
            This email already has an OurSkin account. Enter the existing account
            password once to link Google securely.
          </p>
          <label htmlFor="google-link-password">OurSkin password</label>
          <input
            id="google-link-password"
            type="password"
            value={linkPassword}
            onChange={(event) => setLinkPassword(event.target.value)}
            autoComplete="current-password"
            disabled={busy}
          />
          <div className={styles.linkActions}>
            <button
              type="button"
              onClick={() => {
                setLinkCredential("");
                setLinkPassword("");
                setError("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="button" onClick={linkAccount} disabled={busy || !linkPassword}>
              {busy ? "Linking…" : "Link and continue"}
            </button>
          </div>
        </div>
      )}

      {dividerPosition === "after" && divider}
    </div>
  );
}
