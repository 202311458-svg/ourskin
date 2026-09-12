import { apiFetch } from "@/lib/api";
import type { Announcement } from "@/lib/AnnouncementsApi";
import type { NotificationItem } from "@/lib/notifications-api";

export type Phase8Page<T, TSummary> = {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  summary: TSummary;
  items: T[];
};

export type AdminAnnouncement = Announcement & {
  patient_visibility: "visible" | "scheduled" | "expired" | "not_visible";
};

export type AdminAnnouncementSummary = {
  total: number;
  draft: number;
  published: number;
  archived: number;
  visible_now: number;
  scheduled: number;
  expired: number;
  pinned: number;
};

export type AdminNotificationSummary = {
  total: number;
  unread: number;
  read: number;
  type_counts: Record<string, number>;
};

export type AdminProfile = {
  id: number;
  name: string;
  email: string;
  contact?: string | null;
  role: string;
  status: string;
  department?: string | null;
  profile_image?: string | null;
  is_verified: boolean;
  created_at?: string | null;
};

function addOptional(params: URLSearchParams, key: string, value?: string) {
  const clean = value?.trim();
  if (clean && clean.toLowerCase() !== "all") params.set(key, clean);
}

export function queryAdminAnnouncements(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  category?: string;
  priority?: string;
  visibility?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 20),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "status", params.status);
  addOptional(search, "category", params.category);
  addOptional(search, "priority", params.priority);
  addOptional(search, "visibility", params.visibility);
  return apiFetch<Phase8Page<AdminAnnouncement, AdminAnnouncementSummary>>(
    `/admin/announcements/query?${search.toString()}`
  );
}

export function queryAdminNotifications(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  readState?: string;
  notificationType?: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page || 1),
    page_size: String(params.pageSize || 20),
  });
  addOptional(search, "search", params.search);
  addOptional(search, "read_state", params.readState);
  addOptional(search, "notification_type", params.notificationType);
  return apiFetch<Phase8Page<NotificationItem, AdminNotificationSummary>>(
    `/admin/notifications/query?${search.toString()}`
  );
}

export function getAdminProfile() {
  return apiFetch<AdminProfile>("/admin/profile");
}

export function updateAdminProfile(payload: {
  name?: string;
  contact?: string | null;
  profile_image?: string | null;
}) {
  return apiFetch<{ message: string; user: AdminProfile }>("/admin/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function changeAdminPassword(payload: {
  current_password: string;
  new_password: string;
}) {
  return apiFetch<{ message?: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
