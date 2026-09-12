"use client";

import { useCallback, useEffect, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import {
  archiveAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  type AnnouncementPayload,
} from "@/lib/AnnouncementsApi";
import {
  queryAdminAnnouncements,
  type AdminAnnouncement,
  type AdminAnnouncementSummary,
} from "@/lib/admin-phase8-api";
import AnnouncementEditorDialog from "./components/AnnouncementEditorDialog";
import styles from "./page.module.css";

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

function priorityTone(value: string): "neutral" | "warning" | "danger" {
  if (value === "Urgent") return "danger";
  if (value === "Important") return "warning";
  return "neutral";
}

function statusTone(value: string): "success" | "warning" | "neutral" {
  if (value === "Published") return "success";
  if (value === "Draft") return "warning";
  return "neutral";
}

function visibilityLabel(value: AdminAnnouncement["patient_visibility"]) {
  if (value === "visible") return "Visible now";
  if (value === "scheduled") return "Scheduled";
  if (value === "expired") return "Expired";
  return "Not visible";
}

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [summary, setSummary] = useState<AdminAnnouncementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AdminAnnouncement | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await queryAdminAnnouncements({ page, pageSize, search: debouncedSearch, status, visibility, priority });
      if (data.total > 0 && data.items.length === 0 && page > 1) { setPage(Math.max(1, data.total_pages)); return; }
      setItems(data.items); setTotal(data.total); setSummary(data.summary);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load announcements."); }
    finally { setLoading(false); }
  }, [debouncedSearch, page, pageSize, priority, status, visibility]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setEditing(null); setActionError(""); setEditorOpen(true); };
  const openEdit = (item: AdminAnnouncement) => { setEditing(item); setActionError(""); setEditorOpen(true); };

  const saveAnnouncement = async (payload: AnnouncementPayload) => {
    if (!payload.title.trim() || !payload.message.trim()) { setActionError("Title and message are required."); return; }
    if (payload.starts_at && payload.expires_at && new Date(payload.expires_at) <= new Date(payload.starts_at)) { setActionError("Expiry date must be later than the visible-from date."); return; }
    setSaving(true); setActionError(""); setFeedback("");
    try {
      if (editing) await updateAnnouncement(editing.id, payload);
      else await createAnnouncement(payload);
      setEditorOpen(false); setEditing(null);
      setFeedback(payload.status === "Published" ? "Announcement saved. Newly published drafts notify active patient accounts." : "Announcement draft saved.");
      await load();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Unable to save announcement."); }
    finally { setSaving(false); }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setSaving(true); setActionError(""); setFeedback("");
    try { await archiveAnnouncement(archiveTarget.id); setArchiveTarget(null); setFeedback("Announcement archived and removed from patient visibility."); await load(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Unable to archive announcement."); }
    finally { setSaving(false); }
  };

  return (
    <PageShell>
      <PageHeader eyebrow="Patient communication" title="Announcements" description="Draft, publish, schedule, pin, and archive clinic updates. Publishing a new announcement uses the existing patient notification fan-out." primaryAction={<AdminActionButton tone="primary" onClick={openCreate}>Create announcement</AdminActionButton>} />
      <AdminStatsGrid>
        <StatCard label="Announcements" value={summary?.total ?? 0} hint="All retained clinic posts" />
        <StatCard label="Visible now" value={summary?.visible_now ?? 0} hint="Currently patient-visible" tone="success" />
        <StatCard label="Scheduled" value={summary?.scheduled ?? 0} hint="Published with a future start" tone="info" />
        <StatCard label="Drafts" value={summary?.draft ?? 0} hint="Not yet published" tone="warning" />
        <StatCard label="Archived" value={summary?.archived ?? 0} hint="Retained but hidden" />
      </AdminStatsGrid>
      {feedback ? <div className={styles.successMessage} role="status">{feedback}</div> : null}
      {actionError && !editorOpen && !archiveTarget ? <div className={styles.errorMessage} role="alert">{actionError}</div> : null}
      <AdminToolbar meta={`${total} matching announcement${total === 1 ? "" : "s"}`}>
        <input type="search" aria-label="Search announcements" placeholder="Search title, message, category, creator…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter announcement status"><option value="all">All statuses</option><option value="Draft">Draft</option><option value="Published">Published</option><option value="Archived">Archived</option></select>
        <select value={visibility} onChange={(e) => { setVisibility(e.target.value); setPage(1); }} aria-label="Filter patient visibility"><option value="all">All visibility</option><option value="visible">Visible now</option><option value="scheduled">Scheduled</option><option value="expired">Expired</option></select>
        <select value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} aria-label="Filter priority"><option value="all">All priorities</option><option value="Normal">Normal</option><option value="Important">Important</option><option value="Urgent">Urgent</option></select>
      </AdminToolbar>
      <AdminDataTable title="Announcement library" description="Patient-facing clinic communication with publication and visibility state." loading={loading} loadingText="Loading announcements…" error={error} empty={!loading && !error && items.length === 0} emptyTitle="No announcements match this view." emptyDescription="Try changing the filters or create a new clinic update.">
        <table><thead><tr><th>Announcement</th><th>Category</th><th>Priority</th><th>Status</th><th>Patient visibility</th><th>Visible period</th><th>Creator</th><th>Actions</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}><td className={styles.messageCell}><strong>{item.title}</strong><span>{item.message}</span>{item.is_pinned ? <small>Pinned</small> : null}</td><td>{item.category}</td><td><StatusBadge tone={priorityTone(item.priority)}>{item.priority}</StatusBadge></td><td><StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge></td><td>{visibilityLabel(item.patient_visibility)}</td><td className={styles.dateCell}><span>{item.starts_at ? `From ${formatDate(item.starts_at)}` : "Immediately"}</span><small>{item.expires_at ? `Until ${formatDate(item.expires_at)}` : "No expiry"}</small></td><td>{item.created_by_name || item.created_by_role || "N/A"}</td><td><div className={styles.actions}><AdminActionButton onClick={() => openEdit(item)}>Edit</AdminActionButton>{item.status !== "Archived" ? <AdminActionButton tone="danger" onClick={() => { setActionError(""); setArchiveTarget(item); }}>Archive</AdminActionButton> : null}</div></td></tr>)}</tbody></table>
      </AdminDataTable>
      <PaginationControls total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      <AnnouncementEditorDialog open={editorOpen} item={editing} saving={saving} error={actionError} onClose={() => { if (!saving) { setEditorOpen(false); setEditing(null); setActionError(""); } }} onSave={saveAnnouncement} />
      <AdminDialog open={Boolean(archiveTarget)} onClose={() => { if (!saving) { setArchiveTarget(null); setActionError(""); } }} eyebrow="Patient visibility" title="Archive announcement?" description={archiveTarget ? `“${archiveTarget.title}” will stop being visible to patients.` : "Archive this announcement."} size="sm" footer={<><AdminActionButton onClick={() => setArchiveTarget(null)} disabled={saving}>Cancel</AdminActionButton><AdminActionButton tone="danger" onClick={() => void confirmArchive()} disabled={saving}>{saving ? "Archiving…" : "Archive"}</AdminActionButton></>}>
        {actionError ? <div className={styles.errorMessage} role="alert">{actionError}</div> : <p className={styles.helperText}>Archived announcements are retained for administrative history and can still be inspected through this library.</p>}
      </AdminDialog>
    </PageShell>
  );
}
