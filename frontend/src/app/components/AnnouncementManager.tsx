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
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return null;

  return new Date(value).toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "No expiry";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getExpiryState(expiresAt: string | null) {
  if (!expiresAt) return "No expiry";

  const now = new Date();
  const expiry = new Date(expiresAt);

  if (expiry < now) return "Expired";

  return "Active";
}

export default function AnnouncementManager({
  roleLabel,
}: AnnouncementManagerProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<AnnouncementPayload>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<AnnouncementStatus | "All">(
    "All"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadAnnouncements() {
    try {
      setLoading(true);
      const data = await getAnnouncements();
      setAnnouncements(data);
    } catch (error) {
      console.error("Failed to load announcements:", error);
      alert("Could not load announcements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((announcement) => {
      const matchesStatus =
        activeStatus === "All" || announcement.status === activeStatus;

      const normalizedSearch = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !normalizedSearch ||
        announcement.title.toLowerCase().includes(normalizedSearch) ||
        announcement.message.toLowerCase().includes(normalizedSearch) ||
        announcement.category.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [announcements, activeStatus, searchTerm]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function handleCreateNew() {
    resetForm();
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

    setIsFormOpen(true);
  }

  async function handleArchive(id: string) {
    const confirmed = window.confirm(
      "Archive this announcement? Patients will no longer see it."
    );

    if (!confirmed) return;

    try {
      await archiveAnnouncement(id);
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to archive announcement:", error);
      alert("Could not archive announcement.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      alert("Please add a title and message.");
      return;
    }

    if (form.starts_at && form.expires_at) {
      const startDate = new Date(form.starts_at);
      const expiryDate = new Date(form.expires_at);

      if (expiryDate <= startDate) {
        alert("Expiry date must be later than the start date.");
        return;
      }
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateAnnouncement(editingId, form);
      } else {
        await createAnnouncement(form);
      }

      resetForm();
      setIsFormOpen(false);
      await loadAnnouncements();
    } catch (error) {
      console.error("Failed to save announcement:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Could not save announcement."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.pageShell}>
      <section className={styles.heroCard}>
        <div>
          <p className={styles.eyebrow}>{roleLabel} Portal</p>
          <h1>Clinic Announcements</h1>
          <p>
            Create patient-facing clinic notices, promos, service updates, and
            health advisories from one clean workspace.
          </p>
        </div>

        <button className={styles.primaryButton} onClick={handleCreateNew}>
          Create Announcement
        </button>
      </section>

      <section className={styles.statsGrid}>
        <article className={styles.statCard}>
          <span>Total Posts</span>
          <strong>{announcements.length}</strong>
        </article>

        <article className={styles.statCard}>
          <span>Published</span>
          <strong>
            {announcements.filter((item) => item.status === "Published").length}
          </strong>
        </article>

        <article className={styles.statCard}>
          <span>Urgent</span>
          <strong>
            {announcements.filter((item) => item.priority === "Urgent").length}
          </strong>
        </article>

        <article className={styles.statCard}>
          <span>Pinned</span>
          <strong>
            {announcements.filter((item) => item.is_pinned).length}
          </strong>
        </article>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.statusTabs}>
          {(["All", ...statuses] as const).map((status) => (
            <button
              key={status}
              className={`${styles.statusTab} ${
                activeStatus === status ? styles.statusTabActive : ""
              }`}
              onClick={() => setActiveStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <input
          className={styles.searchInput}
          placeholder="Search announcements..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </section>

      {isFormOpen && (
        <section className={styles.formPanel}>
          <div className={styles.formHeader}>
            <div>
              <p className={styles.eyebrow}>
                {editingId ? "Edit Announcement" : "New Announcement"}
              </p>
              <h2>{editingId ? "Update clinic post" : "Create clinic post"}</h2>
            </div>

            <button
              className={styles.ghostButton}
              onClick={() => {
                resetForm();
                setIsFormOpen(false);
              }}
              type="button"
            >
              Close
            </button>
          </div>

          <form className={styles.formGrid} onSubmit={handleSubmit}>
            <label className={styles.fieldFull}>
              <span>Title</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
                placeholder="Example: Clinic schedule update"
              />
            </label>

            <label className={styles.fieldFull}>
              <span>Message</span>
              <textarea
                value={form.message}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    message: event.target.value,
                  }))
                }
                placeholder="Write the announcement patients will see..."
                rows={5}
              />
            </label>

            <label>
              <span>Category</span>
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    category: event.target.value as AnnouncementCategory,
                  }))
                }
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    priority: event.target.value as AnnouncementPriority,
                  }))
                }
              >
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Status</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    status: event.target.value as AnnouncementStatus,
                  }))
                }
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Visible From</span>
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(form.starts_at)}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    starts_at: fromDateTimeLocalValue(event.target.value),
                  }))
                }
              />
            </label>

            <label>
              <span>Expires At</span>
              <input
                type="datetime-local"
                value={toDateTimeLocalValue(form.expires_at)}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    expires_at: fromDateTimeLocalValue(event.target.value),
                  }))
                }
              />
            </label>

            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={form.is_pinned}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    is_pinned: event.target.checked,
                  }))
                }
              />
              <span>Pin this announcement at the top</span>
            </label>

            <div className={styles.formActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={() =>
                  setForm((previous) => ({
                    ...previous,
                    status: "Draft",
                  }))
                }
              >
                Save as Draft
              </button>

              <button className={styles.primaryButton} type="submit">
                {saving ? "Saving..." : editingId ? "Save Changes" : "Publish"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className={styles.contentPanel}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Announcement Library</p>
            <h2>Manage patient updates</h2>
          </div>
        </div>

        {loading ? (
          <div className={styles.emptyState}>Loading announcements...</div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className={styles.emptyState}>
            No announcements found. Create one to start posting patient updates.
          </div>
        ) : (
          <div className={styles.announcementGrid}>
            {filteredAnnouncements.map((announcement) => (
              <article
                key={announcement.id}
                className={`${styles.announcementCard} ${
                  announcement.priority === "Urgent" ? styles.cardUrgent : ""
                } ${
                  announcement.priority === "Important"
                    ? styles.cardImportant
                    : ""
                }`}
              >
                <div className={styles.cardTop}>
                  <div className={styles.badgeRow}>
                    {announcement.is_pinned && (
                      <span className={styles.pinBadge}>Pinned</span>
                    )}

                    <span className={styles.categoryBadge}>
                      {announcement.category}
                    </span>

                    <span
                      className={`${styles.priorityBadge} ${
                        styles[`priority${announcement.priority}`]
                      }`}
                    >
                      {announcement.priority}
                    </span>
                  </div>

                  <span
                    className={`${styles.statusBadge} ${
                      styles[`status${announcement.status}`]
                    }`}
                  >
                    {announcement.status}
                  </span>
                </div>

                <h3>{announcement.title}</h3>
                <p>{announcement.message}</p>

                <div className={styles.metaGrid}>
                  <span>
                    Posted:
                    <strong>{formatDate(announcement.created_at)}</strong>
                  </span>

                  <span>
                    Expiry:
                    <strong>{formatDate(announcement.expires_at)}</strong>
                  </span>

                  <span>
                    State:
                    <strong>{getExpiryState(announcement.expires_at)}</strong>
                  </span>
                </div>

                <div className={styles.cardActions}>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => handleEdit(announcement)}
                  >
                    Edit
                  </button>

                  {announcement.status !== "Archived" && (
                    <button
                      className={styles.dangerButton}
                      onClick={() => handleArchive(announcement.id)}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}