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
  created_by?: string | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
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
  const headers = new Headers(options.headers || {});
  headers.delete("Authorization");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
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
    created_at: raw.created_at ? String(raw.created_at) : "",
    updated_at: raw.updated_at ? String(raw.updated_at) : null,
    created_by: raw.created_by ? String(raw.created_by) : null,
    created_by_name: raw.created_by_name ? String(raw.created_by_name) : null,
    created_by_role: raw.created_by_role ? String(raw.created_by_role) : null,
  };
}

function normalizeAnnouncements(data: unknown): Announcement[] {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeAnnouncement(item as Record<string, unknown>));
  }

  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { announcements?: unknown[] }).announcements)
  ) {
    return (data as { announcements: unknown[] }).announcements.map((item) =>
      normalizeAnnouncement(item as Record<string, unknown>)
    );
  }

  return [];
}

function sortAnnouncements(items: Announcement[]) {
  return [...items].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;

    const bTime = new Date(b.created_at || "").getTime();
    const aTime = new Date(a.created_at || "").getTime();
    return bTime - aTime;
  });
}

const MANAGER_ENDPOINT = "/announcements";
const PATIENT_VISIBLE_ENDPOINT = "/announcements/patient-visible";

export async function getAnnouncements() {
  const data = await requestApi<unknown>(`${MANAGER_ENDPOINT}/`);
  return sortAnnouncements(normalizeAnnouncements(data));
}

export async function getPatientVisibleAnnouncements() {
  const data = await requestApi<unknown>(PATIENT_VISIBLE_ENDPOINT);
  return sortAnnouncements(normalizeAnnouncements(data));
}

export async function createAnnouncement(payload: AnnouncementPayload) {
  const data = await requestApi<unknown>(`${MANAGER_ENDPOINT}/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeAnnouncement(data as Record<string, unknown>);
}

export async function updateAnnouncement(
  id: string,
  payload: Partial<AnnouncementPayload>
) {
  const data = await requestApi<unknown>(`${MANAGER_ENDPOINT}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeAnnouncement(data as Record<string, unknown>);
}

export async function archiveAnnouncement(id: string) {
  const data = await requestApi<unknown>(`${MANAGER_ENDPOINT}/${id}/archive`, {
    method: "PATCH",
  });
  return normalizeAnnouncement(data as Record<string, unknown>);
}

export async function deleteAnnouncement(id: string) {
  return requestApi<{ message: string }>(`${MANAGER_ENDPOINT}/${id}`, {
    method: "DELETE",
  });
}
