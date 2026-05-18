import { API_BASE_URL } from "@/lib/api";

export type AnnouncementCategory =
  | "Clinic Notice"
  | "Service Update"
  | "Promo"
  | "Health Advisory"
  | "Appointment Reminder";

export type AnnouncementPriority = "Normal" | "Important" | "Urgent";

export type AnnouncementStatus = "Draft" | "Published" | "Archived";

export type AnnouncementPayload = {
  title: string;
  message: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  is_pinned: boolean;
  starts_at: string | null;
  expires_at: string | null;
};

export type Announcement = AnnouncementPayload & {
  id: string;
  created_at: string;
  updated_at?: string | null;
};

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

function getHeaders(hasBody = false): HeadersInit {
  const token = getToken();

  return {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getApiMessage(data: ApiErrorResponse | null, fallback: string) {
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return fallback;
}

async function requestApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });

  const data = await safeJson<T | ApiErrorResponse>(response);

  if (!response.ok) {
    throw new ApiRequestError(
      getApiMessage(
        data as ApiErrorResponse | null,
        `Request failed for ${path}`
      ),
      response.status
    );
  }

  return data as T;
}

async function requestFromPossiblePaths<T>(
  paths: string[],
  options: RequestInit = {}
): Promise<T> {
  let lastError: unknown = null;

  for (const path of paths) {
    try {
      return await requestApi<T>(path, options);
    } catch (error) {
      lastError = error;

      if (error instanceof ApiRequestError) {
        if (error.status !== 404 && error.status !== 405) {
          throw error;
        }
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Announcement request failed.");
}

function normalizeAnnouncement(raw: Record<string, unknown>): Announcement {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    message: String(raw.message ?? ""),
    category: (raw.category ?? "Clinic Notice") as AnnouncementCategory,
    priority: (raw.priority ?? "Normal") as AnnouncementPriority,
    status: (raw.status ?? "Draft") as AnnouncementStatus,
    is_pinned: Boolean(raw.is_pinned),
    starts_at: raw.starts_at ? String(raw.starts_at) : null,
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    created_at: raw.created_at ? String(raw.created_at) : new Date().toISOString(),
    updated_at: raw.updated_at ? String(raw.updated_at) : null,
  };
}

function extractAnnouncements(data: unknown): Announcement[] {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeAnnouncement(item as Record<string, unknown>));
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;

    const list =
      record.announcements ||
      record.items ||
      record.results ||
      record.data;

    if (Array.isArray(list)) {
      return list.map((item) =>
        normalizeAnnouncement(item as Record<string, unknown>)
      );
    }
  }

  return [];
}

function sortAnnouncements(items: Announcement[]) {
  return [...items].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });
}

const MANAGER_ENDPOINTS = [
  "/announcements/",
  "/admin/announcements",
  "/staff/announcements",
];

const PATIENT_ENDPOINTS = [
  "/announcements/patient-visible",
  "/announcements/published",
  "/patient/announcements",
];

export async function getAnnouncements() {
  const data = await requestFromPossiblePaths<unknown>(MANAGER_ENDPOINTS);

  return sortAnnouncements(extractAnnouncements(data));
}

export async function getPatientVisibleAnnouncements() {
  const data = await requestFromPossiblePaths<unknown>(PATIENT_ENDPOINTS);

  return sortAnnouncements(extractAnnouncements(data));
}

export async function createAnnouncement(payload: AnnouncementPayload) {
  const data = await requestFromPossiblePaths<unknown>(MANAGER_ENDPOINTS, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const announcements = extractAnnouncements(data);

  if (announcements.length > 0) return announcements[0];

  if (data && typeof data === "object") {
    return normalizeAnnouncement(data as Record<string, unknown>);
  }

  throw new Error("Announcement was created, but the response was invalid.");
}

export async function updateAnnouncement(
  id: string,
  payload: AnnouncementPayload
) {
  const data = await requestFromPossiblePaths<unknown>(
    MANAGER_ENDPOINTS.map((path) => `${path}/${id}`),
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  const announcements = extractAnnouncements(data);

  if (announcements.length > 0) return announcements[0];

  if (data && typeof data === "object") {
    return normalizeAnnouncement(data as Record<string, unknown>);
  }

  throw new Error("Announcement was updated, but the response was invalid.");
}

export async function archiveAnnouncement(id: string) {
  const data = await requestFromPossiblePaths<unknown>(
    MANAGER_ENDPOINTS.map((path) => `${path}/${id}/archive`),
    {
      method: "PATCH",
    }
  );

  return data;
}