"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import { queryAdminNotifications, type AdminNotificationSummary } from "@/lib/admin-phase8-api";
import { notificationApi, type NotificationItem } from "@/lib/notifications-api";
import styles from "./page.module.css";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function AdminNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<AdminNotificationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [readState, setReadState] = useState("all");
  const [notificationType, setNotificationType] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await queryAdminNotifications({ page, pageSize, search: debouncedSearch, readState, notificationType });
      if (data.total > 0 && data.items.length === 0 && page > 1) {
        setPage(Math.max(1, data.total_pages));
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, notificationType, page, pageSize, readState]);

  useEffect(() => { void load(); }, [load]);

  const typeOptions = useMemo(() => Object.keys(summary?.type_counts || {}).sort(), [summary]);

  const markRead = async (item: NotificationItem, navigate = false) => {
    setFeedback("");
    setError("");
    try {
      if (!item.is_read) await notificationApi.markRead(item.id);
      if (navigate && item.target_url?.startsWith("/pages/")) {
        router.push(item.target_url);
        return;
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notification.");
    }
  };

  const markAllRead = async () => {
    setFeedback("");
    setError("");
    try {
      const result = await notificationApi.markAllRead();
      setFeedback(`${result.updated_count} notification${result.updated_count === 1 ? "" : "s"} marked as read.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notifications.");
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Communication center"
        title="Notifications"
        description="Review administrative, appointment, and system notifications sent to your account."
        primaryAction={
          <AdminActionButton
            tone="secondary"
            onClick={() => void markAllRead()}
            disabled={(summary?.unread ?? 0) === 0}
          >
            Mark all as read
          </AdminActionButton>
        }
      />
      <AdminStatsGrid compact>
        <StatCard label="Notifications" value={summary?.total ?? 0} hint="All retained notifications" />
        <StatCard label="Unread" value={summary?.unread ?? 0} hint="Require your attention" tone="warning" />
        <StatCard label="Read" value={summary?.read ?? 0} hint="Already reviewed" tone="success" />
        <StatCard label="Notification types" value={Object.keys(summary?.type_counts || {}).length} hint="Distinct categories in your inbox" tone="info" />
      </AdminStatsGrid>
      {feedback ? <div className={styles.feedback} role="status">{feedback}</div> : null}
      <AdminToolbar meta={`${total} matching notification${total === 1 ? "" : "s"}`}>
        <input
          type="search"
          aria-label="Search notifications"
          placeholder="Search title, message, or type"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        />
        <select value={readState} onChange={(event) => { setReadState(event.target.value); setPage(1); }} aria-label="Filter read state">
          <option value="all">All states</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <select value={notificationType} onChange={(event) => { setNotificationType(event.target.value); setPage(1); }} aria-label="Filter notification type">
          <option value="all">All types</option>
          {typeOptions.map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
        </select>
      </AdminToolbar>
      <AdminDataTable
        title="Inbox"
        description="Notifications are private to your administrator account. Opening an internal target marks the item read first."
        loading={loading}
        loadingText="Loading notifications…"
        error={error}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No notifications match this view."
        emptyDescription="Try changing the search or filters."
      >
        <table>
          <thead><tr><th>Notification</th><th>Type</th><th>Status</th><th>Received</th><th>Related record</th><th>Actions</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={!item.is_read ? styles.unreadRow : undefined}>
                <td className={styles.titleCell}><strong>{item.title}</strong><span>{item.message}</span></td>
                <td><StatusBadge tone="info">{pretty(item.notification_type)}</StatusBadge></td>
                <td><StatusBadge tone={item.is_read ? "success" : "warning"}>{item.is_read ? "Read" : "Unread"}</StatusBadge></td>
                <td>{formatDate(item.created_at)}</td>
                <td>{item.related_entity_type ? `${pretty(item.related_entity_type)} ${item.related_entity_id || ""}`.trim() : "N/A"}</td>
                <td>
                  <div className={styles.actions}>
                    {!item.is_read ? <AdminActionButton onClick={() => void markRead(item)}>Mark read</AdminActionButton> : null}
                    {item.target_url?.startsWith("/pages/") ? <AdminActionButton tone="primary" onClick={() => void markRead(item, true)}>Open</AdminActionButton> : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminDataTable>
      <PaginationControls
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </PageShell>
  );
}
