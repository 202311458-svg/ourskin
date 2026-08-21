export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

// Non-secret compatibility marker only. It is intentionally never accepted as
// or emitted as a bearer credential. Legacy screens may still use its presence
// while the authoritative portal guard verifies /auth/session.
export const SESSION_MARKER = "cookie-session";

export type SessionUser = {
  id: number;
  name?: string | null;
  email?: string | null;
  role: string;
};

export function getAuth() {
  if (typeof window === "undefined") {
    return { token: null, role: null, user: null };
  }

  return {
    token: localStorage.getItem("token") === SESSION_MARKER ? SESSION_MARKER : null,
    role: localStorage.getItem("role"),
    user: localStorage.getItem("user"),
  };
}

// Phase 10: browser bearer tokens are no longer part of the application auth
// contract. Keep this compatibility export returning null so older callers do
// not accidentally manufacture an Authorization header.
export function getToken() {
  return null;
}

export function getAuthHeaders(extra?: HeadersInit): HeadersInit {
  return new Headers(extra || {});
}

export async function getSession(): Promise<SessionUser | null> {
  const response = await fetch(`${API_BASE_URL}/auth/session`, {
    credentials: "include",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to verify the current session");
  }

  const data = (await response.json()) as SessionUser;
  return data?.role ? data : null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  headers.delete("Authorization");

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE_URL}${cleanPath}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const data = await res.json();
      message = data.detail || data.message || message;
    } catch {
      const text = await res.text().catch(() => "");
      message = text || message;
    }
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return null as T;
}

export async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});
  headers.delete("Authorization");

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${API_BASE_URL}${cleanPath}`, {
    ...options,
    credentials: "include",
    headers,
  });
}

export function markBrowserSession(role: string, user?: Partial<SessionUser>) {
  if (typeof window === "undefined") return;

  localStorage.setItem("token", SESSION_MARKER);
  localStorage.setItem("role", role);

  if (user) {
    localStorage.setItem(
      "user",
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        role,
      })
    );
  }
}

export function clearBrowserSessionState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
}

export async function logoutUser() {
  if (typeof window === "undefined") return;

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
    });
  } finally {
    clearBrowserSessionState();
    window.location.href = "/";
  }
}
