import { apiFetch } from "@/lib/api";

export type NotificationItem = {
  id: number;
  recipient_id: number;
  title: string;
  message: string;
  notification_type: string;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  target_url?: string | null;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type PaginatedNotifications = {
  items: NotificationItem[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export const notificationApi = {
  list: (page = 1, pageSize = 20) =>
    apiFetch<PaginatedNotifications>(
      `/notifications?page=${page}&page_size=${pageSize}`
    ),
  unreadCount: () => apiFetch<{ unread_count: number }>("/notifications/unread-count"),
  markRead: (id: number) =>
    apiFetch<NotificationItem>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () =>
    apiFetch<{ message: string; updated_count: number }>("/notifications/read-all", {
      method: "PATCH",
    }),
};