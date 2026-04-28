export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export function getAuth() {
  if (typeof window === "undefined") {
    return {
      token: null,
      role: null,
      user: null,
    };
  }

  return {
    token: localStorage.getItem("token"),
    role: localStorage.getItem("role"),
    user: localStorage.getItem("user"),
  };
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getAuthHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();

  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...getAuthHeaders(options.headers),
  };

  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`${API_BASE_URL}${cleanPath}`, {
    ...options,
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

  const headers: HeadersInit = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...getAuthHeaders(options.headers),
  };

  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  return fetch(`${API_BASE_URL}${cleanPath}`, {
    ...options,
    headers,
  });
}

export function logoutUser() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user");

  window.location.href = "/";
}