"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Announcement,
  AnnouncementCategory,
  AnnouncementPayload,
  AnnouncementPriority,
  AnnouncementStatus,
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from "@/lib/AnnouncementsApi";
import styles from "@/app/styles/AnnouncementManager.module.css";

type AnnouncementManagerProps = {
  roleLabel: "Admin" | "Staff" | "Doctor";
};

const categories: AnnouncementCategory[] = [
  "Clinic Notice",
  "Service Update",
  "Promo",
  "Health Advisory",
  "Appointment Reminder",
];

const priorities: AnnouncementPriority[] = ["Normal", "Important", "Urgent"];
const statuses: AnnouncementStatus[] = ["Draft", "Published", "Archived"];

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

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function formatDate(value: string | null, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getPatientVisibility(item: Announcement) {
  if (item.status !== "Published") return "Not visible";
  const now = new Date();
  if (item.starts_at && new Date(item.starts_at) > now) return "Scheduled";
  if (item.expires_at && new Date(item.expires_at) < now) return "Expired";
  return "Visible now";
}

export default function AnnouncementManager({ roleLabel }: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<AnnouncementPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<AnnouncementStatus | "All">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Announcement | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadAnnouncements(showLoader = true) {
    try {
      if (showLoader) setLoading(true);
      const data = await getAnnouncements();
      setAnnouncements(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Failed to load announcements:", error);
      setFeedback({ tone: "error", text: "Could not load announcements." });
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => {
    void loadAnnouncements();
  }, []);

  const filteredAnnouncements = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const matchesStatus = activeStatus === "All" || announcement.status === activeStatus;
      const matchesSearch =
        !normalizedSearch ||
        [announcement.title, announcement.message, announcement.category, announcement.priority]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesStatus && matchesSearch;
    });
  }, [announcements, activeStatus, searchTerm]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function closeForm() {
    resetForm();
    setIsFormOpen(false);
  }

  function handleCreateNew() {
    resetForm();
    setFeedback(null);
    setIsFormOpen(true);
  }

  function handleEdit(announcement: Announcement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      message: announcement.message,
      category: announcement.category,
      priority: announcement.priority,
      status: announcement.status,
      is_pinned: announcement.is_pinned,
      starts_at: announcement.starts_at,
      expires_at: announcement.expires_at,
    });
    setFeedback(null);
    setIsFormOpen(true);
  }

  function validate(payload: AnnouncementPayload) {
    if (!payload.title.trim() || !payload.message.trim()) return "Add both a title and message.";
    if (payload.starts_at && payload.expires_at && new Date(payload.expires_at) <= new Date(payload.starts_at)) {
      return "Expiry date must be later than the visible-from date.";
    }
    return "";
  }

  async function save(payload: AnnouncementPayload, successText: string) {
    const validation = validate(payload);
    if (validation) {
      setFeedback({ tone: "error", text: validation });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);
      if (editingId) await updateAnnouncement(editingId, payload);
      else await createAnnouncement(payload);
      closeForm();
      await loadAnnouncements(false);
      setFeedback({ tone: "success", text: successText });
    } catch (error) {
      console.error("Failed to save announcement:", error);
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Could not save announcement." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const publishPayload: AnnouncementPayload = { ...form, status: "Published" };
    await save(publishPayload, editingId ? "Announcement updated and published." : "Announcement published and patients notified.");
  }

  async function handleSaveDraft() {
    const draftPayload: AnnouncementPayload = { ...form, status: "Draft" };
    await save(draftPayload, editingId ? "Draft changes saved." : "Announcement saved as draft.");
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    try {
      setSaving(true);
      await archiveAnnouncement(archiveTarget.id);
      setArchiveTarget(null);
      await loadAnnouncements(false);
      setFeedback({ tone: "success", text: "Announcement archived." });
    } catch (error) {
      console.error("Failed to archive announcement:", error);
      setFeedback({ tone: "error", text: "Could not archive announcement." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <section className={styles.compactHeader}>
        <div>
          <span className={styles.eyebrow}>{roleLabel} communication</span>
          <h1>Clinic announcements</h1>
          <p>Draft, schedule, publish, and archive patient-facing clinic updates.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={handleCreateNew}>Create announcement</button>
      </section>

      {feedback && (
        <div className={feedback.tone === "error" ? styles.errorMessage : styles.successMessage} role={feedback.tone === "error" ? "alert" : "status"}>
          {feedback.text}
        </div>
      )}

      <section className={styles.toolbar}>
        <div className={styles.statusTabs} aria-label="Announcement status filters">
          {(["All", ...statuses] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`${styles.statusTab} ${activeStatus === status ? styles.statusTabActive : ""}`}
              onClick={() => setActiveStatus(status)}
              aria-pressed={activeStatus === status}
            >
              {status}
            </button>
          ))}
        </div>
        <input
          className={styles.searchInput}
          placeholder="Search announcements"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search announcements"
        />
        <div className={styles.resultMeta}>
          <span>{filteredAnnouncements.length} shown</span>
          {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
        </div>
      </section>

      {isFormOpen && (
        <section className={styles.formPanel} aria-label={editingId ? "Edit announcement" : "Create announcement"}>
          <div className={styles.formHeader}>
            <div>
              <h2>{editingId ? "Edit announcement" : "New announcement"}</h2>
              <p>Publishing makes the post available to patients according to its visible period and sends the existing patient notification.</p>
            </div>
            <button className={styles.ghostButton} onClick={closeForm} type="button">Cancel</button>
          </div>

          <form className={styles.formGrid} onSubmit={handleSubmit}>
            <label className={styles.fieldFull}>
              <span>Title</span>
              <input value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} />
            </label>

            <label className={styles.fieldFull}>
              <span>Message</span>
              <textarea value={form.message} onChange={(event) => setForm((previous) => ({ ...previous, message: event.target.value }))} rows={5} />
            </label>

            <label>
              <span>Category</span>
              <select value={form.category} onChange={(event) => setForm((previous) => ({ ...previous, category: event.target.value as AnnouncementCategory }))}>
                {categories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value as AnnouncementPriority }))}>
                {priorities.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </label>

            <label>
              <span>Visible from</span>
              <input type="datetime-local" value={toDateTimeLocalValue(form.starts_at)} onChange={(event) => setForm((previous) => ({ ...previous, starts_at: fromDateTimeLocalValue(event.target.value) }))} />
            </label>

            <label>
              <span>Expires at</span>
              <input type="datetime-local" value={toDateTimeLocalValue(form.expires_at)} onChange={(event) => setForm((previous) => ({ ...previous, expires_at: fromDateTimeLocalValue(event.target.value) }))} />
            </label>

            <label className={styles.checkboxField}>
              <input type="checkbox" checked={form.is_pinned} onChange={(event) => setForm((previous) => ({ ...previous, is_pinned: event.target.checked }))} />
              <span>Pin announcement</span>
            </label>

            <div className={styles.formActions}>
              <button className={styles.ghostButton} type="button" onClick={closeForm}>Cancel</button>
              <button className={styles.secondaryButton} type="button" onClick={handleSaveDraft} disabled={saving}>Save draft</button>
              <button className={styles.primaryButton} type="submit" disabled={saving}>{saving ? "Saving..." : "Publish & notify patients"}</button>
            </div>
          </form>
        </section>
      )}

      <section className={styles.contentPanel}>
        {loading ? (
          <div className={styles.emptyState}>Loading announcements...</div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className={styles.emptyState}>No announcements match this view.</div>
        ) : (
          <div className={styles.announcementTable} role="table" aria-label="Announcement library">
            <div className={styles.tableHeader} role="row">
              <span role="columnheader">Title</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Priority</span>
              <span role="columnheader">Publication</span>
              <span role="columnheader">Patient visibility</span>
              <span role="columnheader">Visible period</span>
              <span role="columnheader">Pinned</span>
              <span role="columnheader">Actions</span>
            </div>

            {filteredAnnouncements.map((announcement) => (
              <div className={styles.tableRow} role="row" key={announcement.id}>
                <div className={styles.tableCell} role="cell" data-label="Title">
                  <strong>{announcement.title}</strong>
                  <small>{announcement.message}</small>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Category">{announcement.category}</div>
                <div className={styles.tableCell} role="cell" data-label="Priority">
                  <span className={`${styles.badge} ${styles[`priority${announcement.priority}`]}`}>{announcement.priority}</span>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Publication">
                  <span className={`${styles.badge} ${styles[`status${announcement.status}`]}`}>{announcement.status}</span>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Patient visibility">
                  <span className={styles.visibilityText}>{getPatientVisibility(announcement)}</span>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Visible period">
                  <small>{announcement.starts_at ? `From ${formatDate(announcement.starts_at)}` : "Immediately"}</small>
                  <small>{announcement.expires_at ? `Until ${formatDate(announcement.expires_at)}` : "No expiry"}</small>
                </div>
                <div className={styles.tableCell} role="cell" data-label="Pinned">{announcement.is_pinned ? "Yes" : "—"}</div>
                <div className={`${styles.tableCell} ${styles.rowActions}`} role="cell" data-label="Actions">
                  <button className={styles.secondaryButton} type="button" onClick={() => handleEdit(announcement)}>Edit</button>
                  {announcement.status !== "Archived" && (
                    <button className={styles.dangerButton} type="button" onClick={() => setArchiveTarget(announcement)}>Archive</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {archiveTarget && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="archive-announcement-title">
          <div className={styles.confirmDialog}>
            <h2 id="archive-announcement-title">Archive announcement?</h2>
            <p><strong>{archiveTarget.title}</strong> will stop being visible to patients.</p>
            <div className={styles.confirmActions}>
              <button className={styles.ghostButton} type="button" onClick={() => setArchiveTarget(null)} disabled={saving}>Cancel</button>
              <button className={styles.dangerSolidButton} type="button" onClick={confirmArchive} disabled={saving}>{saving ? "Archiving..." : "Archive"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
