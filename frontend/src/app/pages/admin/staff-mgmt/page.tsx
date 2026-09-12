"use client";

import { useCallback, useEffect, useState } from "react";
import PaginationControls from "@/app/components/PaginationControls";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import { useDebouncedValue } from "@/app/hooks/useDebouncedValue";
import {
  type AdminStaffSummary,
  type AdminVerifiedUserOption,
  addAdminStaffFromUser,
  queryAdminStaff,
  queryAdminStaffCandidates,
  updateAdminStaff,
  updateAdminStaffStatus,
} from "@/lib/admin-management-api";
import styles from "./page.module.css";
import StaffPromotionDialog from "./components/StaffPromotionDialog";
import StaffDirectoryTable from "./components/StaffDirectoryTable";
import { StaffEditDialog, StaffLifecycleDialog, StaffViewDialog } from "./components/StaffAccountDialogs";
import { normalizeStaff, type ConfirmAction, type EditStaffForm, type StaffUser } from "./staff-types";

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [summary, setSummary] = useState<AdminStaffSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [showAddModal, setShowAddModal] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const debouncedCandidateSearch = useDebouncedValue(candidateSearch, 300);
  const [candidates, setCandidates] = useState<AdminVerifiedUserOption[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [editForm, setEditForm] = useState<EditStaffForm>({
    id: null,
    full_name: "",
    role: "staff",
    department: "",
    phone: "",
    specialty: "",
  });

  const loadStaff = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const data = await queryAdminStaff({
        page,
        pageSize,
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter,
      });
      setStaff(data.items.map(normalizeStaff));
      setSummary(data.summary);
      setTotal(data.total);
    } catch (loadError) {
      setError(errorMessage(loadError, "Unable to load internal accounts."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [debouncedSearch, page, pageSize, roleFilter, statusFilter]);

  useEffect(() => { void loadStaff(); }, [loadStaff]);

  useEffect(() => {
    if (!showAddModal) return;
    let cancelled = false;
    async function loadCandidates() {
      try {
        setCandidateLoading(true);
        setActionError("");
        const data = await queryAdminStaffCandidates(debouncedCandidateSearch);
        if (!cancelled) setCandidates(data);
      } catch (candidateError) {
        if (!cancelled) setActionError(errorMessage(candidateError, "Unable to load promotion candidates."));
      } finally {
        if (!cancelled) setCandidateLoading(false);
      }
    }
    void loadCandidates();
    return () => { cancelled = true; };
  }, [debouncedCandidateSearch, showAddModal]);

  function openAddModal() {
    setSelectedUser(null);
    setCandidateSearch("");
    setCandidates([]);
    setActionError("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (actionLoading) return;
    setShowAddModal(false);
    setSelectedUser(null);
    setCandidates([]);
    setActionError("");
  }

  function openEdit(member: StaffUser) {
    setSelectedStaff(member);
    setEditForm({
      id: member.id,
      full_name: member.full_name,
      role: member.role,
      department: member.department,
      phone: member.phone,
      specialty: member.specialty,
    });
    setActionError("");
    setShowEditModal(true);
  }

  async function handleAddStaff() {
    if (!selectedUser) {
      setActionError("Select an eligible verified account first.");
      return;
    }
    try {
      setActionLoading(true);
      setActionError("");
      setFeedback("");
      const created = normalizeStaff(await addAdminStaffFromUser(selectedUser, "staff"));
      setFeedback(`${created.full_name} now has Staff access. Their previous session was invalidated.`);
      closeAddModal();
      await loadStaff(false);
    } catch (addError) {
      setActionError(errorMessage(addError, "Unable to promote this account."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateStaff() {
    if (!editForm.id) return;
    if (!editForm.full_name.trim()) {
      setActionError("Full name is required.");
      return;
    }
    if (editForm.role === "doctor" && !editForm.specialty.trim()) {
      setActionError("A specialty is required when assigning the Doctor role.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      setFeedback("");
      const updated = normalizeStaff(await updateAdminStaff(editForm.id, {
        full_name: editForm.full_name.trim(),
        name: editForm.full_name.trim(),
        role: editForm.role,
        department: editForm.department.trim() || null,
        phone: editForm.phone.trim() || null,
        contact: editForm.phone.trim() || null,
        specialty: editForm.specialty.trim() || null,
      }));
      setFeedback(`${updated.full_name}'s internal account was updated.`);
      setShowEditModal(false);
      setSelectedStaff(null);
      await loadStaff(false);
    } catch (updateError) {
      setActionError(errorMessage(updateError, "Unable to update the internal account."));
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmStatusChange() {
    if (!confirmAction) return;
    const nextStatus = confirmAction.type === "deactivate" ? "Inactive" : "Active";
    try {
      setActionLoading(true);
      setActionError("");
      setFeedback("");
      const updated = normalizeStaff(await updateAdminStaffStatus(confirmAction.member.id, nextStatus));
      setFeedback(
        nextStatus === "Inactive"
          ? `${updated.full_name} was deactivated and existing sessions were invalidated.`
          : `${updated.full_name} was reactivated.`
      );
      setConfirmAction(null);
      await loadStaff(false);
    } catch (statusError) {
      setActionError(errorMessage(statusError, "Unable to update account access."));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Internal access"
        title="Staff Management"
        description="Manage clinic administrators, staff, and doctors with backend-enforced role and access protections."
        primaryAction={<AdminActionButton tone="primary" onClick={openAddModal}>+ Add staff</AdminActionButton>}
      />

      {feedback ? <div className={styles.feedback} role="status">{feedback}</div> : null}

      <AdminStatsGrid compact>
        <StatCard label="Internal users" value={summary?.total ?? 0} hint="Admins, staff, and doctors" />
        <StatCard label="Active" value={summary?.active ?? 0} hint="Accounts allowed to authenticate" tone="success" />
        <StatCard label="Inactive" value={summary?.inactive ?? 0} hint="Access disabled" tone="warning" />
        <StatCard label="Admins" value={summary?.admins ?? 0} hint="Administrator accounts" tone="danger" />
        <StatCard label="Staff" value={summary?.staff ?? 0} hint="Clinic staff accounts" tone="info" />
        <StatCard label="Doctors" value={summary?.doctors ?? 0} hint="Doctor accounts" tone="info" />
      </AdminStatsGrid>

      <AdminToolbar meta={`${total} matching internal account${total === 1 ? "" : "s"}`}>
        <input type="search" aria-label="Search internal users" placeholder="Search name, email, department, contact, specialty…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} aria-label="Filter internal users by role">
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="doctor">Doctor</option>
        </select>
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter internal users by status">
          <option value="all">All access</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </AdminToolbar>

      <StaffDirectoryTable
        staff={staff}
        loading={loading}
        error={error}
        onView={(member) => { setSelectedStaff(member); setShowViewModal(true); }}
        onEdit={openEdit}
        onConfirm={(action) => { setActionError(""); setConfirmAction(action); }}
      />

      <PaginationControls total={total} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />

      <StaffPromotionDialog
        open={showAddModal}
        busy={actionLoading}
        error={actionError}
        search={candidateSearch}
        candidates={candidates}
        loading={candidateLoading}
        selected={selectedUser}
        onClose={closeAddModal}
        onSearch={setCandidateSearch}
        onSelect={setSelectedUser}
        onConfirm={handleAddStaff}
      />
      <StaffViewDialog member={selectedStaff} open={showViewModal} onClose={() => setShowViewModal(false)} />
      <StaffEditDialog
        member={selectedStaff}
        open={showEditModal}
        form={editForm}
        busy={actionLoading}
        error={actionError}
        onClose={() => { setShowEditModal(false); setSelectedStaff(null); setActionError(""); }}
        onChange={setEditForm}
        onSave={handleUpdateStaff}
      />
      <StaffLifecycleDialog
        action={confirmAction}
        busy={actionLoading}
        error={actionError}
        onClose={() => { setConfirmAction(null); setActionError(""); }}
        onConfirm={confirmStatusChange}
      />
    </PageShell>
  );
}

