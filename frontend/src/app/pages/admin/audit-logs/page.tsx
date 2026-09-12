"use client";

import { useEffect, useState } from "react";
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
import { queryOversightAudit, type OversightAuditLog, type OversightAuditSummary } from "@/lib/admin-oversight-api";
import AuditDetailDialog from "./components/AuditDetailDialog";
import { auditTone, formatAuditAction, formatAuditDate } from "./audit-utils";
import styles from "./page.module.css";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<OversightAuditLog[]>([]);
  const [summary, setSummary] = useState<OversightAuditSummary | null>(null);
  const [selected, setSelected] = useState<OversightAuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorRole, setActorRole] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError("");
      try {
        const data = await queryOversightAudit({ page, pageSize, search: debouncedSearch, module: moduleFilter, actionType: actionFilter, actorRole, dateFrom, dateTo });
        if (cancelled) return;
        setLogs(data.items); setTotal(data.total); setSummary(data.summary);
      } catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load audit logs."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [actionFilter, actorRole, dateFrom, dateTo, debouncedSearch, moduleFilter, page, pageSize]);

  const clearFilters = () => { setSearch(""); setModuleFilter("all"); setActionFilter("all"); setActorRole("all"); setDateFrom(""); setDateTo(""); setPage(1); };

  return (
    <PageShell>
      <PageHeader eyebrow="Security & accountability" title="Audit Logs" description="Review backend-recorded administrative events, actors, targets, and change context." />
      <AdminStatsGrid compact>
        <StatCard label="Audit records" value={summary?.total ?? 0} hint="All backend audit entries" />
        <StatCard label="Account actions" value={summary?.account ?? 0} hint="Access and account lifecycle" tone="success" />
        <StatCard label="Appointment actions" value={summary?.appointment ?? 0} hint="Appointments, follow-ups, and schedules" tone="info" />
        <StatCard label="Status changes" value={summary?.status_changes ?? 0} hint="Activation, lock, and workflow state changes" tone="warning" />
        <StatCard label="Destructive actions" value={summary?.destructive ?? 0} hint="Delete and remove events" tone="danger" />
      </AdminStatsGrid>
      <AdminToolbar meta={`${total} matching record${total === 1 ? "" : "s"}`}>
        <input type="search" aria-label="Search audit logs" placeholder="Search action, description, actor, target, or record ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }} aria-label="Filter by module"><option value="all">All modules</option><option value="Account Management">Account Management</option><option value="Appointments">Appointments</option><option value="Medical Records">Medical Records</option><option value="System">System</option></select>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} aria-label="Filter by action"><option value="all">All actions</option><option value="create">Create / promote</option><option value="update">Update / review</option><option value="status">Status / access change</option><option value="danger">Remove / delete</option><option value="system">System</option></select>
        <select value={actorRole} onChange={(e) => { setActorRole(e.target.value); setPage(1); }} aria-label="Filter by actor role"><option value="all">All actor roles</option><option value="admin">Admin</option><option value="staff">Staff</option><option value="doctor">Doctor</option><option value="patient">Patient</option><option value="system">System</option></select>
        <input type="date" aria-label="Audit records from date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <input type="date" aria-label="Audit records to date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        <AdminActionButton onClick={clearFilters}>Clear filters</AdminActionButton>
      </AdminToolbar>
      <AdminDataTable title="Activity history" description="Sensitive actions recorded by the backend audit trail. Open a row to inspect recorded before/after state when available." loading={loading} loadingText="Loading audit logs…" error={error} empty={!loading && !error && logs.length === 0} emptyTitle="No audit logs match this view." emptyDescription="Try changing the filters or date range.">
        <table><thead><tr><th>Date & time</th><th>Action</th><th>Module</th><th>Description</th><th>Actor</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log.id}><td className={styles.dateCell}>{formatAuditDate(log.created_at)}</td><td><StatusBadge tone={auditTone(log.action_type)}>{formatAuditAction(log.action)}</StatusBadge></td><td><StatusBadge tone="info">{log.module || "System"}</StatusBadge></td><td className={styles.descriptionCell}>{log.description || "No description provided"}</td><td><div className={styles.personCell}><strong>{log.actor_name || log.performed_by || "System"}</strong><span>{log.actor_role || "system"}</span></div></td><td><div className={styles.personCell}><strong>{log.target_name || log.target_type || "N/A"}</strong><span>{log.target_record_id ? `Record ${log.target_record_id}` : log.target_id ? `ID ${log.target_id}` : "No target ID"}</span></div></td><td><AdminActionButton onClick={() => setSelected(log)}>Inspect</AdminActionButton></td></tr>)}</tbody></table>
      </AdminDataTable>
      <PaginationControls total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      <AuditDetailDialog log={selected} onClose={() => setSelected(null)} />
    </PageShell>
  );
}
