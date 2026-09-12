"use client";

import { useCallback, useEffect, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import {
  queryAdminUsers,
  type AdminManagedUser,
  type AdminUserSummary,
} from "@/lib/admin-data-api";
import { updateAdminUserStatus } from "@/lib/admin-management-api";
import styles from "./page.module.css";
import UserDetailsDialog from "./components/UserDetailsDialog";
import UserDirectoryTable from "./components/UserDirectoryTable";
import UserLifecycleDialog, { type UserLifecycleAction } from "./components/UserLifecycleDialog";

type RoleFilter = "all" | "patient" | "doctor" | "staff" | "admin";
type VerificationFilter = "all" | "verified" | "unverified";
type PatientTypeFilter = "all" | "minor" | "adult" | "internal";
type StatusFilter = "all" | "active" | "inactive";
type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [summary, setSummary] = useState<AdminUserSummary | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminManagedUser | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<UserLifecycleAction>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [patientTypeFilter, setPatientTypeFilter] = useState<PatientTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const loadUsers = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const data = await queryAdminUsers({
        page,
        pageSize,
        search: debouncedSearch,
        role: roleFilter,
        verification: verificationFilter,
        patientType: patientTypeFilter,
        status: statusFilter,
      });
      setUsers(data.items);
      setTotal(data.total);
      setSummary(data.summary);
    } catch (loadError) {
      setError(errorMessage(loadError, "Unable to load user records."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [debouncedSearch, page, pageSize, patientTypeFilter, roleFilter, statusFilter, verificationFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const requestStatus = (user: AdminManagedUser, nextStatus: "Active" | "Inactive") => {
    setActionError("");
    setLifecycleAction({ user, nextStatus });
  };

  const confirmStatus = async () => {
    if (!lifecycleAction) return;
    try {
      setActionLoading(true);
      setActionError("");
      setFeedback("");
      const updated = await updateAdminUserStatus<AdminManagedUser>(
        lifecycleAction.user.id,
        lifecycleAction.nextStatus
      );
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (selectedUser?.id === updated.id) setSelectedUser(updated);
      setFeedback(
        lifecycleAction.nextStatus === "Inactive"
          ? `${updated.name || updated.email} was deactivated and existing sessions were invalidated.`
          : `${updated.name || updated.email} was reactivated. A fresh login is required if their previous session was invalidated.`
      );
      setLifecycleAction(null);
      await loadUsers(false);
    } catch (statusError) {
      setActionError(errorMessage(statusError, "Unable to update account status."));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin directory"
        title="Patients & Users"
        description="Review every account, verification state, profile context, and access status from one authoritative directory."
      />

      {feedback ? <div className={styles.feedback} role="status">{feedback}</div> : null}

      <AdminStatsGrid compact>
        <StatCard label="Total users" value={summary?.total ?? 0} hint="All registered accounts" />
        <StatCard label="Active" value={summary?.active ?? 0} hint="Accounts currently allowed to authenticate" tone="success" />
        <StatCard label="Inactive" value={summary?.inactive ?? 0} hint="Accounts with access disabled" tone="warning" />
        <StatCard label="Patients" value={summary?.patients ?? 0} hint="Adult and minor patient accounts" tone="success" />
        <StatCard label="Internal users" value={summary?.internal ?? 0} hint="Admins, staff, and doctors" tone="info" />
        <StatCard label="Verified" value={summary?.verified ?? 0} hint="Email-confirmed accounts" tone="info" />
      </AdminStatsGrid>

      <AdminToolbar meta={`${total} matching account${total === 1 ? "" : "s"}`}>
        <input
          type="search"
          aria-label="Search users"
          placeholder="Search name, email, contact, guardian, address, specialty…"
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
        />
        <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as RoleFilter); setPage(1); }} aria-label="Filter by role">
          <option value="all">All roles</option>
          <option value="patient">Patients</option>
          <option value="doctor">Doctors</option>
          <option value="staff">Staff</option>
          <option value="admin">Admins</option>
        </select>
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1); }} aria-label="Filter by access status">
          <option value="all">All access</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={verificationFilter} onChange={(event) => { setVerificationFilter(event.target.value as VerificationFilter); setPage(1); }} aria-label="Filter by verification">
          <option value="all">All verification</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
        <select value={patientTypeFilter} onChange={(event) => { setPatientTypeFilter(event.target.value as PatientTypeFilter); setPage(1); }} aria-label="Filter by account type">
          <option value="all">All account types</option>
          <option value="adult">Adult patients</option>
          <option value="minor">Minor patients</option>
          <option value="internal">Internal users</option>
        </select>
      </AdminToolbar>

      <UserDirectoryTable
        users={users}
        loading={loading}
        error={error}
        onView={setSelectedUser}
        onStatus={requestStatus}
      />

      <PaginationControls
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      <UserDetailsDialog user={selectedUser} onClose={() => setSelectedUser(null)} />

      <UserLifecycleDialog
        action={lifecycleAction}
        busy={actionLoading}
        error={actionError}
        onClose={() => { setLifecycleAction(null); setActionError(""); }}
        onConfirm={confirmStatus}
      />
    </PageShell>
  );
}
