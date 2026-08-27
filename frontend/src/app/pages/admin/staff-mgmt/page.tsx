"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PageHeader from "@/app/components/portal/ui/PageHeader";
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

      const matchesRole =
        roleFilter === "all" || member.role.toLowerCase() === roleFilter;

      const matchesStatus =
        statusFilter === "all" || member.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: staff.length,
      active: staff.filter((item) => item.status.toLowerCase() === "active")
        .length,
      admins: staff.filter((item) => item.role.toLowerCase() === "admin")
        .length,
      inactive: staff.filter((item) => item.status.toLowerCase() !== "active")
        .length,
    };
  }, [staff]);

  function closeEditModal() {
    if (actionLoading) return;
    setShowEditModal(false);
    setSelectedStaff(null);
  }

  function handleView(member: StaffUser) {
    setSelectedStaff(member);
    setShowViewModal(true);
  }

  function handleEdit(member: StaffUser) {
    const normalized = normalizeStaff(member);

    setSelectedStaff(normalized);
    setEditForm({
      id: normalized.id,
      full_name: normalized.full_name,
      email: normalized.email,
      role: normalized.role,
      department: normalized.department || "",
      phone: normalized.phone || normalized.contact || "",
    });
    setShowEditModal(true);
  }

  async function handleAddStaff() {
    if (!selectedUser) {
      alert("Please select a verified user first.");
      return;
    }

    try {
      setActionLoading(true);

      const data = await addAdminStaffFromUser(selectedUser, "staff");
      setStaff((prev) => [normalizeStaff(data), ...prev]);

      setSelectedUser(null);
      setShowAddModal(false);
    } catch (addError: unknown) {
      alert(getErrorMessage(addError, "Something went wrong while adding staff."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateStaff() {
    if (!editForm.id) {
      alert("Missing staff ID.");
      return;
    }

    if (!editForm.full_name.trim()) {
      alert("Full name is required.");
      return;
    }

    if (!editForm.role.trim()) {
      alert("Role is required.");
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

      const data = await updateAdminStaff(editForm.id, payload);
      const updatedStaff = normalizeStaff(data);

      setStaff((prev) =>
        prev.map((member) =>
          member.id === editForm.id ? updatedStaff : member
        )
      );

      setShowEditModal(false);
      setSelectedStaff(null);
    } catch (updateError: unknown) {
      alert(
        getErrorMessage(
          updateError,
          "Something went wrong while updating staff."
        )
      );
    } finally {
      setActionLoading(false);
    }
  }

  function requestStatusChange(
    member: StaffUser,
    type: "deactivate" | "reactivate"
  ) {
    setConfirmAction({ type, member });
  }

  async function confirmStatusChange() {
    if (!confirmAction) return;

    const newStatus = confirmAction.type === "deactivate" ? "Inactive" : "Active";

    try {
      setActionLoading(true);

      const data = await updateAdminStaffStatus(
        confirmAction.member.id,
        newStatus
      );
      const updatedStaff = normalizeStaff(data);

      setStaff((prev) =>
        prev.map((member) =>
          member.id === confirmAction.member.id ? updatedStaff : member
        )
      );

      setConfirmAction(null);
    } catch (statusError: unknown) {
      alert(
        getErrorMessage(
          statusError,
          "Something went wrong while updating account status."
        )
      );
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className={styles.staffMgmtPage}>
      <PageHeader
        title="Staff Management"
        description="Manage internal users, roles, and account access."
        primaryAction={
          <button
            type="button"
            className={styles.addButton}
            onClick={() => {
              setSelectedUser(null);
              setShowAddModal(true);
            }}
          >
            + Add Staff
          </button>
        }
      />

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span>Total Staff</span>
          <strong>{stats.total}</strong>
        </div>
        <div className={`${styles.statCard} ${styles.greenAccent}`}>
          <span>Active</span>
          <strong>{stats.active}</strong>
        </div>
        <div className={`${styles.statCard} ${styles.blueAccent}`}>
          <span>Admins</span>
          <strong>{stats.admins}</strong>
        </div>
        <div className={`${styles.statCard} ${styles.orangeAccent}`}>
          <span>Inactive</span>
          <strong>{stats.inactive}</strong>
        </div>
      </div>

      <div className={styles.filtersRow}>
        <input
          type="text"
          placeholder="Search by name, email, or department"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className={styles.searchInput}
        />

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className={styles.selectInput}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="doctor">Doctor</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className={styles.selectInput}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <section className={styles.tableCard}>
        {loading ? (
          <p className={styles.message}>Loading staff records...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : filteredStaff.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No staff records found</h3>
            <p>Try adjusting the search or filters.</p>
          </div>
        ) : (
          <table className={styles.table}>
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
                      <Image
                        src={member.profile_image || "/default-avatar.png"}
                        alt={member.full_name}
                        width={42}
                        height={42}
                        className={styles.avatar}
                      />
                      <div>
                        <strong>{member.full_name}</strong>
                        <p>{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>{capitalizeFirst(member.role)}</td>
                  <td>{member.department || "N/A"}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        member.status.toLowerCase() === "active"
                          ? styles.active
                          : styles.inactive
                      }`}
                    >
                      {capitalizeFirst(member.status)}
                    </span>
                  </td>
                  <td>{formatDate(member.created_at)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.viewBtn}
                        onClick={() => handleView(member)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className={styles.editBtn}
                        onClick={() => handleEdit(member)}
                      >
                        Edit
                      </button>
                      {member.status.toLowerCase() === "active" ? (
                        <button
                          type="button"
                          className={styles.deactivateBtn}
                          onClick={() =>
                            requestStatusChange(member, "deactivate")
                          }
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.deactivateBtn}
                          onClick={() =>
                            requestStatusChange(member, "reactivate")
                          }
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <h3>Add Staff</h3>
            <p>Select a verified user to promote to staff.</p>

            <div className={styles.selectBox}>
              <select
                value={selectedUser || ""}
                onChange={(event) =>
                  setSelectedUser(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.dangerConfirmBtn}
                onClick={handleAddStaff}
                disabled={actionLoading}
              >
                {actionLoading ? "Adding..." : "Confirm"}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowAddModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedStaff && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCardLarge}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Staff Details</h2>
                <p>Review staff account information and access status.</p>
              </div>
              <button
                type="button"
                className={styles.topCloseButton}
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>

            <div className={styles.profileSection}>
              <Image
                src={selectedStaff.profile_image || "/default-avatar.png"}
                alt={selectedStaff.full_name}
                width={44}
                height={44}
                className={styles.avatar}
              />
              <div className={styles.profileInfo}>
                <h3>{selectedStaff.full_name}</h3>
                <p>{selectedStaff.email}</p>
              </div>
            </div>

            <div className={styles.profileGrid}>
              <div>
                <strong>Role</strong>
                <p>{capitalizeFirst(selectedStaff.role)}</p>
              </div>
              <div>
                <strong>Status</strong>
                <p>{capitalizeFirst(selectedStaff.status)}</p>
              </div>
              <div>
                <strong>Department</strong>
                <p>{selectedStaff.department || "N/A"}</p>
              </div>
              <div>
                <strong>Contact</strong>
                <p>{selectedStaff.phone || selectedStaff.contact || "N/A"}</p>
              </div>
              <div>
                <strong>Created</strong>
                <p>{formatDate(selectedStaff.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedStaff && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCardLarge}>
            <div className={styles.modalHeader}>
              <div>
                <h2>Edit Staff</h2>
                <p>Update internal user profile and role information.</p>
              </div>
            </div>

            <div className={styles.editGrid}>
              <label htmlFor="full_name">Full Name</label>
              <input
                id="full_name"
                value={editForm.full_name}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    full_name: event.target.value,
                  }))
                }
              />

              <label htmlFor="email">Email</label>
              <input id="email" value={editForm.email} disabled />

              <label htmlFor="role">Role</label>
              <select
                id="role"
                value={editForm.role}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, role: event.target.value }))
                }
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="doctor">Doctor</option>
              </select>

              <label htmlFor="department">Department</label>
              <input
                id="department"
                value={editForm.department}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    department: event.target.value,
                  }))
                }
              />

              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                value={editForm.phone}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.dangerConfirmBtn}
                onClick={handleUpdateStaff}
                disabled={actionLoading}
              >
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={closeEditModal}
                disabled={actionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className={styles.modalOverlay}>
          <div className={styles.confirmCard}>
            <div className={styles.confirmTop}>
              <div
                className={`${styles.confirmIcon} ${
                  confirmAction.type === "deactivate"
                    ? styles.warningIcon
                    : styles.successIcon
                }`}
              >
                !
              </div>
              <div>
                <p className={styles.confirmEyebrow}>Confirm Status Change</p>
                <h2>
                  {confirmAction.type === "deactivate"
                    ? "Deactivate staff account?"
                    : "Reactivate staff account?"}
                </h2>
              </div>
            </div>

            <p className={styles.confirmText}>
              This will update the account status for{" "}
              {confirmAction.member.full_name}.
            </p>

            <div className={styles.confirmUserBox}>
              <div>
                <span>Name</span>
                <strong>{confirmAction.member.full_name}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{confirmAction.member.email}</strong>
              </div>
            </div>

            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelConfirmBtn}
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  confirmAction.type === "deactivate"
                    ? styles.dangerConfirmBtn
                    : styles.successConfirmBtn
                }
                onClick={confirmStatusChange}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Updating..."
                  : confirmAction.type === "deactivate"
                  ? "Deactivate"
                  : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
