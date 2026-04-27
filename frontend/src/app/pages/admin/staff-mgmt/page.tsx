"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "./staff-mgmt.module.css";

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

type StaffApiResponse = {
  id?: number | string;
  full_name?: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
  department?: string | null;
  phone?: string | null;
  contact?: string | null;
  profile_image?: string | null;
  created_at?: string;
};

type UserOption = {
  id: number;
  name: string;
  email: string;
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

type ApiErrorResponse = {
  detail?: string;
  message?: string;
};

const API_BASE = "http://127.0.0.1:8000";

function normalizeStaff(raw: StaffApiResponse): StaffUser {
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

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  return fallback;
}

function getApiErrorMessage(data: ApiErrorResponse | null, fallback: string) {
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  return fallback;
}

export default function StaffManagementPage() {
  const router = useRouter();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
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
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const staffRes = await fetch(`${API_BASE}/admin/staff`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const staffData = await safeJson<
          StaffApiResponse[] & ApiErrorResponse
        >(staffRes);

        if (!staffRes.ok) {
          throw new Error(
            getApiErrorMessage(staffData, "Unable to load staff records")
          );
        }

        setStaff(Array.isArray(staffData) ? staffData.map(normalizeStaff) : []);

        const usersRes = await fetch(`${API_BASE}/admin/verified-users`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const usersData = await safeJson<UserOption[]>(usersRes);

        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Unable to load admin records"));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  const filteredStaff = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return staff.filter((member) => {
      const matchesSearch =
        member.full_name.toLowerCase().includes(keyword) ||
        member.email.toLowerCase().includes(keyword) ||
        (member.department || "").toLowerCase().includes(keyword);

      const matchesRole =
        roleFilter === "all" || member.role.toLowerCase() === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        member.status.toLowerCase() === statusFilter;

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

  function capitalizeFirst(value?: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

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

    const token = localStorage.getItem("token");

    try {
      setActionLoading(true);

      const res = await fetch(`${API_BASE}/admin/staff/from-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: selectedUser,
          role: "staff",
        }),
      });

      const data = await safeJson<StaffApiResponse & ApiErrorResponse>(res);

      if (!res.ok) {
        alert(getApiErrorMessage(data, "Failed to add staff"));
        return;
      }

      if (data) {
        setStaff((prev) => [normalizeStaff(data), ...prev]);
      }

      setSelectedUser(null);
      setShowAddModal(false);
    } catch (addError: unknown) {
      alert(getErrorMessage(addError, "Something went wrong while adding staff."));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateStaff() {
    const token = localStorage.getItem("token");

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

      const res = await fetch(`${API_BASE}/admin/staff/${editForm.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await safeJson<StaffApiResponse & ApiErrorResponse>(res);

      if (!res.ok) {
        alert(getApiErrorMessage(data, "Update failed"));
        return;
      }

      const updatedStaff = data ? normalizeStaff(data) : null;

      setStaff((prev) =>
        prev.map((member) =>
          member.id === editForm.id
            ? updatedStaff || {
                ...member,
                full_name: payload.full_name,
                name: payload.name,
                role: payload.role,
                department: payload.department || "",
                phone: payload.phone || "",
                contact: payload.contact || "",
              }
            : member
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

    const token = localStorage.getItem("token");
    const newStatus = confirmAction.type === "deactivate" ? "Inactive" : "Active";

    try {
      setActionLoading(true);

      const res = await fetch(
        `${API_BASE}/admin/staff/${confirmAction.member.id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      const data = await safeJson<StaffApiResponse & ApiErrorResponse>(res);

      if (!res.ok) {
        alert(
          getApiErrorMessage(data, `Failed to ${confirmAction.type} account`)
        );
        return;
      }

      const updatedStaff = data ? normalizeStaff(data) : null;

      setStaff((prev) =>
        prev.map((member) =>
          member.id === confirmAction.member.id
            ? updatedStaff || { ...member, status: newStatus }
            : member
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
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">
        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Staff Management</h1>
            <p className={styles.subtitle}>
              Manage internal users, roles, and account access.
            </p>
          </div>

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
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span>Total Staff</span>
            <strong>{stats.total}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>

          <div className={styles.statCard}>
            <span>Admins</span>
            <strong>{stats.admins}</strong>
          </div>

          <div className={styles.statCard}>
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

        <div className={styles.tableCard}>
          {loading ? (
            <p className={styles.message}>Loading staff records...</p>
          ) : error ? (
            <p className={styles.error}>{error}</p>
          ) : filteredStaff.length === 0 ? (
            <p className={styles.message}>No staff records found.</p>
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

                    <td>
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>

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
        </div>

        {showAddModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCardLarge}>
              <h2>Add Staff</h2>
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
                  onClick={handleAddStaff}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Adding..." : "Confirm"}
                </button>

                <button
                  type="button"
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
                <h2>Staff Profile</h2>
              </div>

              <div className={styles.profileSection}>
                <Image
                  src={selectedStaff.profile_image || "/default-avatar.png"}
                  alt={selectedStaff.full_name}
                  width={42}
                  height={42}
                  className={styles.avatar}
                />

                <div className={styles.profileInfo}>
                  <h3>{selectedStaff.full_name}</h3>
                  <p>{selectedStaff.email}</p>
                </div>
              </div>

              <div className={styles.profileGrid}>
                <div>
                  <strong>Role:</strong> {capitalizeFirst(selectedStaff.role)}
                </div>

                <div>
                  <strong>Department:</strong>{" "}
                  {selectedStaff.department || "N/A"}
                </div>

                <div>
                  <strong>Status:</strong>{" "}
                  {capitalizeFirst(selectedStaff.status)}
                </div>

                <div>
                  <strong>Phone:</strong>{" "}
                  {selectedStaff.phone || selectedStaff.contact || "N/A"}
                </div>

                <div>
                  <strong>Created:</strong>{" "}
                  {selectedStaff.created_at
                    ? new Date(selectedStaff.created_at).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCardLarge}>
              <h2>Edit Staff</h2>
              <p>Update staff details, role, and department information.</p>

              <div className={styles.editGrid}>
                <label>Full Name</label>
                <input
                  value={editForm.full_name}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      full_name: event.target.value,
                    }))
                  }
                />

                <label>Email Locked</label>
                <input value={editForm.email} disabled />

                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="doctor">Doctor</option>
                </select>

                <label>Department</label>
                <input
                  value={editForm.department}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      department: event.target.value,
                    }))
                  }
                  placeholder="Example: Front Desk"
                />

                <label>Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      phone: event.target.value,
                    }))
                  }
                  placeholder="Example: 09123456789"
                />

                <label>Profile Image Locked</label>
                <input
                  value="Cannot edit from admin staff management"
                  disabled
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={handleUpdateStaff}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Saving..." : "Save Changes"}
                </button>

                <button
                  type="button"
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
                  {confirmAction.type === "deactivate" ? "!" : "✓"}
                </div>

                <div>
                  <p className={styles.confirmEyebrow}>
                    {confirmAction.type === "deactivate"
                      ? "Account Deactivation"
                      : "Account Reactivation"}
                  </p>

                  <h2>
                    {confirmAction.type === "deactivate"
                      ? "Deactivate this account?"
                      : "Reactivate this account?"}
                  </h2>
                </div>
              </div>

              <p className={styles.confirmText}>
                {confirmAction.type === "deactivate"
                  ? "This user will no longer be able to access the OurSkin system. Their profile, appointment history, and activity records will remain saved for tracking."
                  : "This user will regain access to the OurSkin system based on their assigned role."}
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

                <div>
                  <span>Role</span>
                  <strong>{capitalizeFirst(confirmAction.member.role)}</strong>
                </div>

                <div>
                  <span>Status</span>
                  <strong>
                    {capitalizeFirst(confirmAction.member.status)}
                  </strong>
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
                    ? "Processing..."
                    : confirmAction.type === "deactivate"
                    ? "Yes, Deactivate"
                    : "Yes, Reactivate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}