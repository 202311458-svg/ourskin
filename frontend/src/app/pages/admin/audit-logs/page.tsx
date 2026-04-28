"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import { API_BASE_URL } from "@/lib/api";
import styles from "./audit-logs.module.css";

type AuditLog = {
  id: number;
  action: string;
  description: string;
  actor_id: number | null;
  target_id: number | null;
  created_at: string | null;
  actor_name?: string | null;
  target_name?: string | null;
  module?: string | null;
};

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};


const API_BASE = API_BASE_URL;

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getApiErrorMessage(data: ApiErrorResponse | null, fallback: string) {
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return fallback;
}

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

function formatDateTime(value: string | null) {
  if (!value) return "N/A";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogsPage() {
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    async function loadAuditLogs() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`${API_BASE}/admin/audit-logs`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await safeJson<AuditLog[] & ApiErrorResponse>(res);

        if (!res.ok) {
          throw new Error(
            getApiErrorMessage(data, "Unable to load audit logs")
          );
        }

        setLogs(Array.isArray(data) ? data : []);
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Unable to load audit logs"));
      } finally {
        setLoading(false);
      }
    }

    loadAuditLogs();
  }, [router]);

  const enhancedLogs = useMemo(() => {
    return logs.map((log) => ({
      ...log,
      module: log.module || getModuleFromAction(log.action),
    }));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return enhancedLogs.filter((log) => {
      const moduleName = log.module || getModuleFromAction(log.action);
      const actionType = getActionType(log.action);

      const matchesSearch =
        log.action.toLowerCase().includes(keyword) ||
        log.description.toLowerCase().includes(keyword) ||
        String(log.actor_id || "").includes(keyword) ||
        String(log.target_id || "").includes(keyword) ||
        (log.actor_name || "").toLowerCase().includes(keyword) ||
        (log.target_name || "").toLowerCase().includes(keyword);

      const matchesModule =
        moduleFilter === "all" || moduleName === moduleFilter;

      const matchesAction =
        actionFilter === "all" || actionType === actionFilter;

      return matchesSearch && matchesModule && matchesAction;
    });
  }, [enhancedLogs, search, moduleFilter, actionFilter]);

  const stats = useMemo(() => {
    return {
      total: enhancedLogs.length,
      account: enhancedLogs.filter(
        (log) => log.module === "Account Management"
      ).length,
      appointment: enhancedLogs.filter((log) => log.module === "Appointments")
        .length,
      medical: enhancedLogs.filter((log) => log.module === "Medical Records")
        .length,
    };
  }, [enhancedLogs]);

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Audit Logs</h1>
            <p className={styles.subtitle}>
              Review system activity, admin actions, and important account
              changes.
            </p>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Logs</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Account Actions</span>
            <strong>{stats.account}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Appointment Actions</span>
            <strong>{stats.appointment}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Medical Actions</span>
            <strong>{stats.medical}</strong>
          </div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by action, description, actor ID, or target ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />

          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Modules</option>
            <option value="Account Management">Account Management</option>
            <option value="Appointments">Appointments</option>
            <option value="Medical Records">Medical Records</option>
            <option value="System">System</option>
          </select>

          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Actions</option>
            <option value="create">Create / Promote</option>
            <option value="update">Update / Edit</option>
            <option value="status">Status Change</option>
            <option value="danger">Remove / Delete</option>
            <option value="system">System</option>
          </select>
        </div>

        <div className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading audit logs...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredLogs.length === 0 ? (
            <div className={styles.emptyState}>
              <h3>No audit logs found</h3>
              <p>
                Once admins update accounts, appointments, or system records,
                the activities will appear here.
              </p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Description</th>
                  <th>Performed By</th>
                  <th>Target</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => {
                  const actionType = getActionType(log.action);
                  const moduleName = log.module || getModuleFromAction(log.action);

                  return (
                    <tr key={log.id}>
                      <td className={styles.dateCell}>
                        {formatDateTime(log.created_at)}
                      </td>

                      <td>
                        <span
                          className={`${styles.actionBadge} ${
                            styles[actionType]
                          }`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>

                      <td>
                        <span className={styles.moduleBadge}>
                          {moduleName}
                        </span>
                      </td>

                      <td className={styles.descriptionCell}>
                        {log.description || "No description provided"}
                      </td>

                      <td>
                        {log.actor_name ? (
                          <div className={styles.personCell}>
                            <strong>{log.actor_name}</strong>
                            <span>ID #{log.actor_id || "N/A"}</span>
                          </div>
                        ) : (
                          <span className={styles.idText}>
                            Actor ID #{log.actor_id || "N/A"}
                          </span>
                        )}
                      </td>

                      <td>
                        {log.target_name ? (
                          <div className={styles.personCell}>
                            <strong>{log.target_name}</strong>
                            <span>ID #{log.target_id || "N/A"}</span>
                          </div>
                        ) : (
                          <span className={styles.idText}>
                            Target ID #{log.target_id || "N/A"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}