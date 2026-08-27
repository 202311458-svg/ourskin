"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import AdminActionButton from "@/app/components/portal/admin/AdminActionButton";
import AdminDataTable from "@/app/components/portal/admin/AdminDataTable";
import AdminDialog from "@/app/components/portal/admin/AdminDialog";
import AdminStatsGrid from "@/app/components/portal/admin/AdminStatsGrid";
import AdminToolbar from "@/app/components/portal/admin/AdminToolbar";
import PageHeader from "@/app/components/portal/ui/PageHeader";
import PageShell from "@/app/components/portal/ui/PageShell";
import StatCard from "@/app/components/portal/ui/StatCard";
import StatusBadge from "@/app/components/portal/ui/StatusBadge";
import {
  AdminStaffRecord,
  AdminVerifiedUserOption,
  addAdminStaffFromUser,
  getAdminStaff,
  getAdminVerifiedUsers,
  updateAdminStaff,
  updateAdminStaffStatus,
} from "@/lib/admin-management-api";
import styles from "./page.module.css";

type StaffUser = {
  id: number;
  full_name: string;
  name?: string;
  email: string;
  role: string;
  status: string;
  department?: string;
  phone?: string;
  contact?: string;
  profile_image?: string | null;
  created_at?: string;
};

type EditStaffForm = {
  id: number | null;
  full_name: string;
  email: string;
  role: string;
  department: string;
  phone: string;
};

type ConfirmAction = {
  type: "deactivate" | "reactivate";
  member: StaffUser;
} | null;

function normalizeStaff(raw: AdminStaffRecord): StaffUser {
  return {
    id: Number(raw.id),
    full_name: raw.full_name || raw.name || "Unnamed User",
    name: raw.name || raw.full_name || "Unnamed User",
    email: raw.email || "",
    role: raw.role || "staff",
    status: raw.status || "Active",
    department: raw.department || "",
    phone: raw.phone || raw.contact || "",
    contact: raw.contact || raw.phone || "",
    profile_image: raw.profile_image || null,
    created_at: raw.created_at,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function capitalizeFirst(value?: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString();
}

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [users, setUsers] = useState<AdminVerifiedUserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const [editForm, setEditForm] = useState<EditStaffForm>({
    id: null,
    full_name: "",
    email: "",
    role: "staff",
    department: "",
    phone: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        setError("");
        const [staffData, usersData] = await Promise.all([
          getAdminStaff(),
          getAdminVerifiedUsers(),
        ]);
        if (cancelled) return;
        setStaff(Array.isArray(staffData) ? staffData.map(normalizeStaff) : []);
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Unable to load admin records"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStaff = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return staff.filter((member) => {
      const matchesSearch =
        !keyword ||
        member.full_name.toLowerCase().includes(keyword) ||
        member.email.toLowerCase().includes(keyword) ||
        (member.department || "").toLowerCase().includes(keyword);
      const matchesRole = roleFilter === "all" || member.role.toLowerCase() === roleFilter;
      const matchesStatus = statusFilter === "all" || member.status.toLowerCase() === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, search, roleFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: staff.length,
    active: staff.filter((item) => item.status.toLowerCase() === "active").length,
    admins: staff.filter((item) => item.role.toLowerCase() === "admin").length,
    inactive: staff.filter((item) => item.status.toLowerCase() !== "active").length,
  }), [staff]);

  function openAddModal() {
    setSelectedUser(null);
    setActionError("");
    setShowAddModal(true);
  }

  function closeAddModal() {
    if (actionLoading) return;
    setShowAddModal(false);
    setSelectedUser(null);
    setActionError("");
  }

  function handleView(member: StaffUser) {
    setSelectedStaff(member);
    setShowViewModal(true);
  }

  function handleEdit(member: StaffUser) {
    const normalized = member;
    setSelectedStaff(normalized);
    setEditForm({
      id: normalized.id,
      full_name: normalized.full_name,
      email: normalized.email,
      role: normalized.role,
      department: normalized.department || "",
      phone: normalized.phone || normalized.contact || "",
    });
    setActionError("");
    setShowEditModal(true);
  }

  function closeEditModal() {
    if (actionLoading) return;
    setShowEditModal(false);
    setSelectedStaff(null);
    setActionError("");
  }

  async function handleAddStaff() {
    if (!selectedUser) {
      setActionError("Please select a verified user first.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      const data = await addAdminStaffFromUser(selectedUser, "staff");
      setStaff((prev) => [normalizeStaff(data), ...prev]);
      setSelectedUser(null);
      setShowAddModal(false);
    } catch (addError: unknown) {
      setActionError(getErrorMessage(addError, "Something went wrong while adding staff."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateStaff() {
    if (!editForm.id) {
      setActionError("Missing staff ID.");
      return;
    }
    if (!editForm.full_name.trim()) {
      setActionError("Full name is required.");
      return;
    }
    if (!editForm.role.trim()) {
      setActionError("Role is required.");
      return;
    }

    const payload = {
      full_name: editForm.full_name.trim(),
      name: editForm.full_name.trim(),
      role: editForm.role.trim().toLowerCase(),
      department: editForm.department.trim() || null,
      phone: editForm.phone.trim() || null,
      contact: editForm.phone.trim() || null,
    };

    try {
      setActionLoading(true);
      setActionError("");
      const data = await updateAdminStaff(editForm.id, payload);
      const updatedStaff = normalizeStaff(data);
      setStaff((prev) => prev.map((member) => member.id === editForm.id ? updatedStaff : member));
      setShowEditModal(false);
      setSelectedStaff(null);
    } catch (updateError: unknown) {
      setActionError(getErrorMessage(updateError, "Something went wrong while updating staff."));
    } finally {
      setActionLoading(false);
    }
  }

  function requestStatusChange(member: StaffUser, type: "deactivate" | "reactivate") {
    setActionError("");
    setConfirmAction({ type, member });
  }

  async function confirmStatusChange() {
    if (!confirmAction) return;
    const newStatus = confirmAction.type === "deactivate" ? "Inactive" : "Active";

    try {
      setActionLoading(true);
      setActionError("");
      const data = await updateAdminStaffStatus(confirmAction.member.id, newStatus);
      const updatedStaff = normalizeStaff(data);
      setStaff((prev) => prev.map((member) => member.id === confirmAction.member.id ? updatedStaff : member));
      setConfirmAction(null);
    } catch (statusError: unknown) {
      setActionError(getErrorMessage(statusError, "Something went wrong while updating account status."));
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Internal access"
        title="Staff Management"
        description="Manage internal users, roles, departments, and account access."
        primaryAction={<AdminActionButton tone="primary" onClick={openAddModal}>+ Add staff</AdminActionButton>}
      />

      <AdminStatsGrid compact>
        <StatCard label="Internal users" value={stats.total} hint="Admin, staff, and doctor accounts" />
        <StatCard label="Active" value={stats.active} hint="Accounts currently allowed to sign in" tone="success" />
        <StatCard label="Admins" value={stats.admins} hint="Accounts with administrator role" tone="info" />
        <StatCard label="Inactive" value={stats.inactive} hint="Accounts with access disabled" tone="warning" />
      </AdminStatsGrid>

      <AdminToolbar meta={`${filteredStaff.length} shown`}>
        <input type="search" aria-label="Search staff" placeholder="Search name, email, or department" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter staff by role">
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="doctor">Doctor</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter staff by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </AdminToolbar>

      <AdminDataTable
        title="Internal user directory"
        description="Role, department, status, and account actions for clinic users."
        loading={loading}
        loadingText="Loading staff records…"
        error={error}
        empty={!loading && !error && filteredStaff.length === 0}
        emptyTitle="No staff records match this view."
        emptyDescription="Try adjusting the search or filters."
      >
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member) => (
              <tr key={member.id}>
                <td>
                  <div className={styles.staffCell}>
                    <Image src={member.profile_image || "/default-avatar.png"} alt={member.full_name} width={42} height={42} className={styles.avatar} />
                    <div>
                      <strong>{member.full_name}</strong>
                      <p>{member.email}</p>
                    </div>
                  </div>
                </td>
                <td><StatusBadge tone={member.role.toLowerCase() === "admin" ? "danger" : member.role.toLowerCase() === "doctor" ? "info" : "warning"}>{capitalizeFirst(member.role)}</StatusBadge></td>
                <td>{member.department || "N/A"}</td>
                <td><StatusBadge tone={member.status.toLowerCase() === "active" ? "success" : "neutral"}>{capitalizeFirst(member.status)}</StatusBadge></td>
                <td>{formatDate(member.created_at)}</td>
                <td>
                  <div className={styles.actions}>
                    <AdminActionButton onClick={() => handleView(member)}>View</AdminActionButton>
                    <AdminActionButton onClick={() => handleEdit(member)}>Edit</AdminActionButton>
                    {member.status.toLowerCase() === "active" ? (
                      <AdminActionButton tone="danger" onClick={() => requestStatusChange(member, "deactivate")}>Deactivate</AdminActionButton>
                    ) : (
                      <AdminActionButton tone="success" onClick={() => requestStatusChange(member, "reactivate")}>Reactivate</AdminActionButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminDataTable>

      <AdminDialog
        open={showAddModal}
        onClose={closeAddModal}
        title="Add staff"
        description="Select a verified user to promote to an internal staff account."
        size="sm"
        footer={
          <>
            <AdminActionButton onClick={closeAddModal} disabled={actionLoading}>Cancel</AdminActionButton>
            <AdminActionButton tone="primary" onClick={handleAddStaff} disabled={actionLoading}>{actionLoading ? "Adding…" : "Add staff"}</AdminActionButton>
          </>
        }
      >
        {actionError ? <div className={styles.dialogError} role="alert">{actionError}</div> : null}
        <div className={styles.formStack}>
          <label htmlFor="admin-add-staff-user">Verified user</label>
          <select id="admin-add-staff-user" value={selectedUser || ""} onChange={(event) => setSelectedUser(event.target.value ? Number(event.target.value) : null)}>
            <option value="">Select user</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.email})</option>)}
          </select>
        </div>
      </AdminDialog>

      <AdminDialog
        open={showViewModal && Boolean(selectedStaff)}
        onClose={() => setShowViewModal(false)}
        title="Staff details"
        description="Review staff account information and access status."
        size="lg"
        footer={<AdminActionButton onClick={() => setShowViewModal(false)}>Close</AdminActionButton>}
      >
        {selectedStaff ? (
          <>
            <div className={styles.profileSection}>
              <Image src={selectedStaff.profile_image || "/default-avatar.png"} alt={selectedStaff.full_name} width={52} height={52} className={styles.avatar} />
              <div className={styles.profileInfo}>
                <h3>{selectedStaff.full_name}</h3>
                <p>{selectedStaff.email}</p>
              </div>
            </div>
            <div className={styles.profileGrid}>
              <div><span>Role</span><strong>{capitalizeFirst(selectedStaff.role)}</strong></div>
              <div><span>Status</span><strong>{capitalizeFirst(selectedStaff.status)}</strong></div>
              <div><span>Department</span><strong>{selectedStaff.department || "N/A"}</strong></div>
              <div><span>Contact</span><strong>{selectedStaff.phone || selectedStaff.contact || "N/A"}</strong></div>
              <div><span>Created</span><strong>{formatDate(selectedStaff.created_at)}</strong></div>
            </div>
          </>
        ) : null}
      </AdminDialog>

      <AdminDialog
        open={showEditModal && Boolean(selectedStaff)}
        onClose={closeEditModal}
        title="Edit staff"
        description="Update internal user profile and role information."
        size="lg"
        footer={
          <>
            <AdminActionButton onClick={closeEditModal} disabled={actionLoading}>Cancel</AdminActionButton>
            <AdminActionButton tone="primary" onClick={handleUpdateStaff} disabled={actionLoading}>{actionLoading ? "Saving…" : "Save changes"}</AdminActionButton>
          </>
        }
      >
        {actionError ? <div className={styles.dialogError} role="alert">{actionError}</div> : null}
        <div className={styles.editGrid}>
          <label htmlFor="full_name">Full name</label>
          <input id="full_name" value={editForm.full_name} onChange={(event) => setEditForm((prev) => ({ ...prev, full_name: event.target.value }))} />
          <label htmlFor="email">Email</label>
          <input id="email" value={editForm.email} disabled />
          <label htmlFor="role">Role</label>
          <select id="role" value={editForm.role} onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="doctor">Doctor</option>
          </select>
          <label htmlFor="department">Department</label>
          <input id="department" value={editForm.department} onChange={(event) => setEditForm((prev) => ({ ...prev, department: event.target.value }))} />
          <label htmlFor="phone">Phone</label>
          <input id="phone" value={editForm.phone} onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))} />
        </div>
      </AdminDialog>

      <AdminDialog
        open={Boolean(confirmAction)}
        onClose={() => {
          if (!actionLoading) {
            setConfirmAction(null);
            setActionError("");
          }
        }}
        eyebrow="Confirm status change"
        title={confirmAction?.type === "deactivate" ? "Deactivate staff account?" : "Reactivate staff account?"}
        description={confirmAction ? `This will update access for ${confirmAction.member.full_name}.` : undefined}
        size="sm"
        footer={
          <>
            <AdminActionButton onClick={() => setConfirmAction(null)} disabled={actionLoading}>Cancel</AdminActionButton>
            <AdminActionButton tone={confirmAction?.type === "deactivate" ? "danger" : "success"} onClick={confirmStatusChange} disabled={actionLoading}>
              {actionLoading ? "Updating…" : confirmAction?.type === "deactivate" ? "Deactivate" : "Reactivate"}
            </AdminActionButton>
          </>
        }
      >
        {actionError ? <div className={styles.dialogError} role="alert">{actionError}</div> : null}
        {confirmAction ? (
          <div className={styles.confirmUserBox}>
            <div><span>Name</span><strong>{confirmAction.member.full_name}</strong></div>
            <div><span>Email</span><strong>{confirmAction.member.email}</strong></div>
          </div>
        ) : null}
      </AdminDialog>
    </PageShell>
  );
}
