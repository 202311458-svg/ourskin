"use client";

import { useEffect, useMemo, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import { AuditLog, getAdminAuditLogs } from "@/lib/admin-api";
import styles from "./page.module.css";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatAction(action: string) {
  return action
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getModuleFromAction(action: string) {
  const upperAction = action.toUpperCase();

  if (
    upperAction.includes("STAFF") ||
    upperAction.includes("USER") ||
    upperAction.includes("ACCOUNT") ||
    upperAction.includes("ROLE")
  ) {
    return "Account Management";
  }

  if (upperAction.includes("APPOINTMENT")) {
    return "Appointments";
  }

  if (
    upperAction.includes("AI") ||
    upperAction.includes("ANALYSIS") ||
    upperAction.includes("DOCTOR") ||
    upperAction.includes("PATIENT") ||
    upperAction.includes("DIAGNOSIS")
  ) {
    return "Medical Records";
  }

  return "System";
}

function getActionType(action: string) {
  const upperAction = action.toUpperCase();

  if (upperAction.includes("CREATE") || upperAction.includes("PROMOTE")) {
    return "create";
  }

  if (upperAction.includes("UPDATE") || upperAction.includes("EDIT")) {
    return "update";
  }

  if (
    upperAction.includes("DEACTIVATE") ||
    upperAction.includes("INACTIVE") ||
    upperAction.includes("STATUS")
  ) {
    return "status";
  }

  if (upperAction.includes("DELETE") || upperAction.includes("REMOVE")) {
    return "danger";
  }

  return "system";
}

function getActionTone(action: string): "success" | "info" | "warning" | "danger" | "neutral" {
  const actionType = getActionType(action);
  if (actionType === "create") return "success";
  if (actionType === "update") return "info";
  if (actionType === "status") return "warning";
  if (actionType === "danger") return "danger";
  return "neutral";
}

function formatDateTime(value?: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAuditLogs() {
      try {
        setLoading(true);
        setError("");

        const data = await getAdminAuditLogs(page, pageSize);
        if (cancelled) return;
        setLogs(data.items);
        setTotal(data.total);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load audit logs"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAuditLogs();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const enhancedLogs = useMemo(() => {
    return logs.map((log) => ({
      ...log,
      module: getModuleFromAction(log.action || ""),
    }));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return enhancedLogs.filter((log) => {
      const moduleName = log.module || getModuleFromAction(log.action || "");
      const actionType = getActionType(log.action || "");

      const matchesSearch =
        !keyword ||
        (log.action || "").toLowerCase().includes(keyword) ||
        (log.description || "").toLowerCase().includes(keyword) ||
        String(log.actor_id || "").includes(keyword) ||
        String(log.target_id || "").includes(keyword) ||
        (log.actor_name || "").toLowerCase().includes(keyword) ||
        (log.target_name || "").toLowerCase().includes(keyword);

      const matchesModule = moduleFilter === "all" || moduleName === moduleFilter;
      const matchesAction = actionFilter === "all" || actionType === actionFilter;

      return matchesSearch && matchesModule && matchesAction;
    });
  }, [enhancedLogs, search, moduleFilter, actionFilter]);

  const stats = useMemo(() => {
    return {
      total: enhancedLogs.length,
      account: enhancedLogs.filter((log) => log.module === "Account Management").length,
      appointment: enhancedLogs.filter((log) => log.module === "Appointments").length,
      medical: enhancedLogs.filter((log) => log.module === "Medical Records").length,
    };
  }, [enhancedLogs]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Security & accountability"
        title="Audit Logs"
        description="Review system activity, admin actions, and important account changes."
      />

      <AdminStatsGrid compact>
        <StatCard label="Logs on this page" value={stats.total} hint={`${total} total audit records`} />
        <StatCard label="Account actions" value={stats.account} hint="Account-related records on this page" tone="success" />
        <StatCard label="Appointment actions" value={stats.appointment} hint="Appointment-related records on this page" tone="info" />
        <StatCard label="Medical actions" value={stats.medical} hint="Clinical/AI-related records on this page" tone="warning" />
      </AdminStatsGrid>

      <AdminToolbar meta={`${filteredLogs.length} shown on this page`}>
        <input
          type="search"
          aria-label="Search audit logs"
          placeholder="Search action, description, actor, or target"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} aria-label="Filter audit logs by module">
          <option value="all">All modules</option>
          <option value="Account Management">Account Management</option>
          <option value="Appointments">Appointments</option>
          <option value="Medical Records">Medical Records</option>
          <option value="System">System</option>
        </select>
        <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} aria-label="Filter audit logs by action type">
          <option value="all">All actions</option>
          <option value="create">Create / Promote</option>
          <option value="update">Update / Edit</option>
          <option value="status">Status Change</option>
          <option value="danger">Remove / Delete</option>
          <option value="system">System</option>
        </select>
      </AdminToolbar>

      <AdminDataTable
        title="Activity history"
        description="Sensitive administrative actions recorded by the backend audit trail."
        loading={loading}
        loadingText="Loading audit logs…"
        error={error}
        empty={!loading && !error && filteredLogs.length === 0}
        emptyTitle="No audit logs match this view."
        emptyDescription="Try changing the search or filters."
      >
        <table>
          <thead>
            <tr>
              <th>Date & time</th>
              <th>Action</th>
              <th>Module</th>
              <th>Description</th>
              <th>Performed by</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td className={styles.dateCell}>{formatDateTime(log.created_at)}</td>
                <td><StatusBadge tone={getActionTone(log.action || "")}>{formatAction(log.action || "System")}</StatusBadge></td>
                <td><StatusBadge tone="info">{log.module}</StatusBadge></td>
                <td className={styles.descriptionCell}>{log.description || "No description provided"}</td>
                <td>
                  <div className={styles.personCell}>
                    <strong>{log.actor_name || "System"}</strong>
                    <span>{log.actor_id ? `ID: ${log.actor_id}` : "No ID"}</span>
                  </div>
                </td>
                <td>
                  <div className={styles.personCell}>
                    <strong>{log.target_name || "N/A"}</strong>
                    <span>{log.target_id ? `ID: ${log.target_id}` : "No target ID"}</span>
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
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </PageShell>
  );
}
