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

    // Compatibility bridge for legacy direct fetch() calls. Same-origin API
    // requests always use the HttpOnly cookie and never emit browser bearer
    // credentials, even if an old page still constructs an Authorization header.
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
      headers.delete("Authorization");

      return originalFetch(input, {
        ...init,
        credentials: "include",
        headers,
      });
    };

    let cancelled = false;

    const initializeSession = async () => {
      const storedToken = localStorage.getItem("token");

      // Phase 10 removes the browser JWT migration path. Any pre-cookie JWT
      // left in storage is erased rather than sent back over the network.
      if (storedToken && storedToken !== SESSION_MARKER) {
        clearBrowserSessionState();
      }

      try {
        const response = await originalFetch(`${API_BASE_URL}/auth/session`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) clearBrowserSessionState();
          return;
        }

        const data = await response.json().catch(() => ({}));
        if (!cancelled && data.role) {
          markBrowserSession(data.role, data);
        }
      } catch {
        // Do not manufacture auth state during a network failure. A subsequent
        // protected request still verifies the server-side cookie.
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
