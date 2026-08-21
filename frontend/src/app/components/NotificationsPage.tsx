"use client";

import { useCallback, useEffect, useState } from "react";
import PaginationControls from "./PaginationControls";
import { notificationApi, NotificationItem } from "@/lib/notifications-api";
import styles from "./NotificationsPage.module.css";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await notificationApi.list(page, pageSize);
      if (data.total > 0 && data.items.length === 0 && page > 1) { setPage(Math.max(1, data.total_pages)); return; }
      setItems(data.items); setTotal(data.total);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load notifications"); }
    finally { setLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (item: NotificationItem) => {
    try {
      if (!item.is_read) { await notificationApi.markRead(item.id); setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, is_read: true } : entry)); }
      if (item.target_url?.startsWith("/pages/")) window.location.assign(item.target_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notification");
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}><div><p>Communication center</p><h1>Notifications</h1><span>Review account and clinical workflow updates intended for you.</span></div><button type="button" onClick={async () => { try { await notificationApi.markAllRead(); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update notifications"); } }} disabled={!items.some((item) => !item.is_read)}>Mark all as read</button></header>
      <section className={styles.card} aria-busy={loading}>
        {loading && <div className={styles.state}>Loading your notifications…</div>}
        {error && <div className={styles.error} role="alert"><strong>Notifications could not be loaded.</strong><span>{error}</span><button type="button" onClick={load}>Try again</button></div>}
        {!loading && !error && items.length === 0 && <div className={styles.state}><strong>No notifications yet</strong><span>New appointment and account updates will appear here.</span></div>}
        {!loading && !error && items.map((item) => <button type="button" key={item.id} className={`${styles.row} ${!item.is_read ? styles.unread : ""}`} onClick={() => markRead(item)}><span className={styles.marker} /><span className={styles.content}><span className={styles.rowTop}><strong>{item.title}</strong><time>{formatTimestamp(item.created_at)}</time></span><span className={styles.message}>{item.message}</span><span className={styles.type}>{item.notification_type.replaceAll("_", " ")}</span></span></button>)}
      </section>
      {!loading && !error && total > 0 && <PaginationControls total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
    </div>
  );
}