"use client";

import { useLayoutEffect } from "react";
import {
  API_BASE_URL,
  SESSION_MARKER,
  clearBrowserSessionState,
  markBrowserSession,
} from "@/app/utils/auth";

const apiOrigin = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

export default function SessionInitializer() {
  useLayoutEffect(() => {
    const originalFetch = window.fetch.bind(window);

    // Central compatibility bridge for legacy pages that still call fetch()
    // directly. API requests always send the HttpOnly cookie, and the
    // non-secret session marker is never emitted as a bearer credential.
    window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      let isApiRequest = false;
      try {
        isApiRequest = new URL(rawUrl, window.location.href).origin === apiOrigin;
      } catch {
        isApiRequest = false;
      }

      if (!isApiRequest) {
        return originalFetch(input, init);
      }

      const headers = new Headers(
        init.headers || (input instanceof Request ? input.headers : undefined)
      );

      if (headers.get("Authorization") === `Bearer ${SESSION_MARKER}`) {
        headers.delete("Authorization");
      }

      return originalFetch(input, {
        ...init,
        credentials: "include",
        headers,
      });
    };

    let cancelled = false;

    const initializeSession = async () => {
      const storedToken = localStorage.getItem("token");

      // One-time migration for users who were already signed in before Phase 5:
      // exchange the old browser token for an HttpOnly cookie, then erase it.
      if (storedToken && storedToken !== SESSION_MARKER) {
        try {
          const exchange = await originalFetch(
            `${API_BASE_URL}/auth/session/exchange`,
            {
              method: "POST",
              credentials: "include",
              headers: { Authorization: `Bearer ${storedToken}` },
            }
          );

          if (exchange.ok) {
            const data = await exchange.json().catch(() => ({}));
            if (!cancelled && data.role) markBrowserSession(data.role);
          } else if (!cancelled) {
            clearBrowserSessionState();
          }
        } catch {
          if (!cancelled) clearBrowserSessionState();
        }
      }

      try {
        const response = await originalFetch(`${API_BASE_URL}/auth/session`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) clearBrowserSessionState();
          return;
        }

        const data = await response.json().catch(() => ({}));
        if (!cancelled && data.role) {
          markBrowserSession(data.role);
          localStorage.setItem(
            "user",
            JSON.stringify({
              id: data.id,
              name: data.name,
              email: data.email,
              role: data.role,
            })
          );
        }
      } catch {
        // Network failures should not manufacture an authenticated state. Keep
        // an existing cookie marker so a transient outage does not force a
        // destructive local logout; the next protected API call still verifies
        // the real server-side session.
      }
    };

    void initializeSession();

    return () => {
      cancelled = true;
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
