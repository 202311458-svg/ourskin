"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaBell } from "react-icons/fa";
import { notificationApi, NotificationItem } from "@/lib/notifications-api";
import styles from "./NotificationBell.module.css";

type Props = { role: "admin" | "doctor" | "staff" | "patient"; onNavigate?: () => void };

function formatRelativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(value).toLocaleDateString();
}

export default function NotificationBell({ role, onNavigate }: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshCount = async () => {
    try {
      const result = await notificationApi.unreadCount();
      setUnread(result.unread_count);
    } catch {
      // The surrounding route guard handles invalid sessions.
    }
  };

  const loadRecent = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await notificationApi.list(1, 6);
      setItems(result.items);
      await refreshCount();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCount();
    const handleFocus = () => refreshCount();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (open && rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) loadRecent();
  };

  const openNotification = async (item: NotificationItem) => {
    try {
      if (!item.is_read) {
        await notificationApi.markRead(item.id);
        setUnread((count) => Math.max(0, count - 1));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notification");
      return;
    }
    setOpen(false);
    onNavigate?.();
    if (item.target_url?.startsWith("/pages/")) router.push(item.target_url);
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnread(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notifications");
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button type="button" className={styles.trigger} onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <FaBell />
        <span className={styles.label}>Notifications</span>
        {unread > 0 && <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <section className={styles.panel} aria-label="Recent notifications">
          <header><div><strong>Notifications</strong><span>{unread} unread</span></div>{unread > 0 && <button type="button" onClick={markAll}>Mark all read</button>}</header>
          <div className={styles.list}>
            {loading && <p className={styles.state}>Loading notifications…</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {!loading && !error && items.length === 0 && <p className={styles.state}>You’re all caught up.</p>}
            {items.map((item) => (
              <button type="button" key={item.id} className={`${styles.item} ${!item.is_read ? styles.unread : ""}`} onClick={() => openNotification(item)}>
                <span className={styles.dot} /><span><strong>{item.title}</strong><small>{item.message}</small><span className={styles.meta}><span className={styles.type}>{item.notification_type.replaceAll("_", " ")}</span><time>{formatRelativeTime(item.created_at)}</time></span></span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.viewAll} onClick={() => { setOpen(false); onNavigate?.(); router.push(`/pages/${role}/notifications`); }}>View all notifications</button>
        </section>
      )}
    </div>
  );
}