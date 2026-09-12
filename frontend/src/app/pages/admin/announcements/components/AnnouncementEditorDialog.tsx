"use client";

import { useEffect, useState } from "react";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import type {
  AnnouncementCategory,
  AnnouncementPayload,
  AnnouncementPriority,
} from "@/lib/AnnouncementsApi";
import type { AdminAnnouncement } from "@/lib/admin-phase8-api";
import styles from "../page.module.css";

const categories: AnnouncementCategory[] = [
  "Clinic Notice",
  "Service Update",
  "Promo",
  "Health Advisory",
  "Appointment Reminder",
];
const priorities: AnnouncementPriority[] = ["Normal", "Important", "Urgent"];

const emptyForm: AnnouncementPayload = {
  title: "",
  message: "",
  category: "Clinic Notice",
  priority: "Normal",
  status: "Draft",
  is_pinned: false,
  starts_at: null,
  expires_at: null,
};

function toLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function AnnouncementEditorDialog({
  open,
  item,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  item: AdminAnnouncement | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (payload: AnnouncementPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<AnnouncementPayload>(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm(item ? {
      title: item.title,
      message: item.message,
      category: item.category,
      priority: item.priority,
      status: item.status === "Archived" ? "Draft" : item.status,
      is_pinned: item.is_pinned,
      starts_at: item.starts_at,
      expires_at: item.expires_at,
    } : emptyForm);
  }, [item, open]);

  const save = async (status: "Draft" | "Published") => {
    await onSave({ ...form, title: form.title.trim(), message: form.message.trim(), status });
  };

  return (
    <AdminDialog
      open={open}
      onClose={onClose}
      eyebrow={item ? "Edit clinic update" : "New clinic update"}
      title={item ? item.title : "Create announcement"}
      description="Draft first or publish immediately. Publishing a draft creates the existing patient notification fan-out."
      size="lg"
      footer={
        <>
          <AdminActionButton onClick={onClose} disabled={saving}>Cancel</AdminActionButton>
          <AdminActionButton onClick={() => void save("Draft")} disabled={saving}>{saving ? "Saving…" : "Save draft"}</AdminActionButton>
          <AdminActionButton tone="primary" onClick={() => void save("Published")} disabled={saving}>{saving ? "Publishing…" : "Publish & notify"}</AdminActionButton>
        </>
      }
    >
      <div className={styles.formStack}>
        {error ? <div className={styles.errorMessage} role="alert">{error}</div> : null}
        <label className={styles.wideField}><span>Title</span><input value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} /></label>
        <label className={styles.wideField}><span>Message</span><textarea rows={6} value={form.message} onChange={(e) => setForm((v) => ({ ...v, message: e.target.value }))} /></label>
        <div className={styles.formGrid}>
          <label><span>Category</span><select value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value as AnnouncementCategory }))}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Priority</span><select value={form.priority} onChange={(e) => setForm((v) => ({ ...v, priority: e.target.value as AnnouncementPriority }))}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Visible from</span><input type="datetime-local" value={toLocal(form.starts_at)} onChange={(e) => setForm((v) => ({ ...v, starts_at: toIso(e.target.value) }))} /></label>
          <label><span>Expires at</span><input type="datetime-local" value={toLocal(form.expires_at)} onChange={(e) => setForm((v) => ({ ...v, expires_at: toIso(e.target.value) }))} /></label>
        </div>
        <label className={styles.checkboxField}><input type="checkbox" checked={form.is_pinned} onChange={(e) => setForm((v) => ({ ...v, is_pinned: e.target.checked }))} /><span>Pin this announcement</span></label>
        {form.starts_at && new Date(form.starts_at) > new Date() ? <p className={styles.helperText}>Publishing with a future visible-from time still sends the patient notification when you publish; the announcement itself becomes visible at the scheduled time.</p> : null}
      </div>
    </AdminDialog>
  );
}
