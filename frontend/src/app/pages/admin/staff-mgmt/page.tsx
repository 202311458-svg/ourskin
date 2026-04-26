"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "./staff-mgmt.module.css";
import Image from "next/image";

type StaffUser = {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  department?: string;
  phone?: string;
  profile_image?: string | null;
  created_at?: string;
};

type UserOption = {
  id: number;
  name: string;
  email: string;
};

export default function StaffManagementPage() {
  const router = useRouter();

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [editForm, setEditForm] = useState<Partial<StaffUser>>({});

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    fetch("http://127.0.0.1:8000/admin/staff", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setError("Unable to load staff records"))
      .finally(() => setLoading(false));

    fetch("http://127.0.0.1:8000/admin/verified-users", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []));
  }, [router]);

  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const matchesSearch =
        member.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        member.email?.toLowerCase().includes(search.toLowerCase()) ||
        member.department?.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" || member.role?.toLowerCase() === roleFilter;

      const matchesStatus =
        statusFilter === "all" || member.status?.toLowerCase() === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, search, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: staff.length,
      active: staff.filter((s) => s.status?.toLowerCase() === "active").length,
      admins: staff.filter((s) => s.role?.toLowerCase() === "admin").length,
      inactive: staff.filter((s) => s.status?.toLowerCase() !== "active").length,
    };
  }, [staff]);

  async function handleDeactivate(id: number) {
    const token = localStorage.getItem("token");

    await fetch(`http://127.0.0.1:8000/admin/staff/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "Inactive" }),
    });

    setStaff((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "Inactive" } : m))
    );
  }

  async function handleReactivate(id: number) {
    const token = localStorage.getItem("token");

    await fetch(`http://127.0.0.1:8000/admin/staff/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: "Active" }),
    });

    setStaff((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "Active" } : m))
    );
  }

  // ADD STAFF
  async function handleAddStaff() {
    const token = localStorage.getItem("token");

    const res = await fetch("http://127.0.0.1:8000/admin/staff/from-user", {
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

    const data = await res.json();
    if (!res.ok) return alert(data.detail || "Failed");

    setStaff((prev) => [data, ...prev]);
    setShowAddModal(false);
  }

  // VIEW
  function handleView(member: StaffUser) {
    setSelectedStaff(member);
    setShowViewModal(true);
  }

  // EDIT
  function handleEdit(member: StaffUser) {
    setSelectedStaff(member);

    setEditForm({
      id: Number(member.id),
      full_name: member.full_name,
      role: member.role,
      department: member.department,
      phone: member.phone,
    });

    setShowEditModal(true);
  }

  console.log("EDIT ID:", editForm.id);

  function capitalizeFirst(str?: string) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  async function handleUpdateStaff() {
    const token = localStorage.getItem("token");

    if (!editForm.id) {
      alert("Missing staff ID");
      return;
    }

    const payload = {
      full_name: editForm.full_name,
      role: editForm.role,
      department: editForm.department,
      phone: editForm.phone,
    };

    const res = await fetch(
      `http://127.0.0.1:8000/admin/staff/${editForm.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Update failed");
      return;
    }

    setStaff((prev) =>
      prev.map((m) => (m.id === data.id ? data : m))
    );

    setShowEditModal(false);
  }

  return (
    <div className="staffLayout">
      <AdminNavbar />

      <div className="staffContent">

        <div className={styles.headerRow}>
          <div>
            <h1 className={styles.title}>Staff Management</h1>
            <p className={styles.subtitle}>
              Manage internal users, roles, and account status.
            </p>
          </div>

          <button
            className={styles.addButton}
            onClick={() => setShowAddModal(true)}
          >
            + Add Staff
          </button>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}><span>Total Staff</span><strong>{stats.total}</strong></div>
          <div className={styles.statCard}><span>Active</span><strong>{stats.active}</strong></div>
          <div className={styles.statCard}><span>Admins</span><strong>{stats.admins}</strong></div>
          <div className={styles.statCard}><span>Inactive</span><strong>{stats.inactive}</strong></div>
        </div>

        <div className={styles.filtersRow}>
          <input
            type="text"
            placeholder="Search by name, email, or department"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className={styles.selectInput}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
            <option value="doctor">Doctor</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
                          <strong>{(member.full_name)}</strong>
                          <p>{member.email}</p>
                        </div>
                      </div>
                    </td>

                    <td>{capitalizeFirst(member.role)}</td>
                    <td>{member.department || "N/A"}</td>

                    <td>
                      <span
                        className={`${styles.statusBadge} ${member.status?.toLowerCase() === "active"
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
                          className={styles.viewBtn}
                          onClick={() => handleView(member)}
                        >
                          View
                        </button>

                        <button
                          className={styles.editBtn}
                          onClick={() => handleEdit(member)}
                        >
                          Edit
                        </button>

                        {member.status?.toLowerCase() === "active" ? (
                          <button
                            className={styles.deactivateBtn}
                            onClick={() => handleDeactivate(member.id)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            className={styles.deactivateBtn}
                            onClick={() => handleReactivate(member.id)}
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
              <p>Select a verified user to promote to staff</p>

              <div className={styles.selectBox}>
                <select
                  onChange={(e) => setSelectedUser(Number(e.target.value))}
                >
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.modalActions}>
                <button onClick={handleAddStaff}>Confirm</button>
                <button onClick={() => setShowAddModal(false)}>Cancel</button>
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
                  src={selectedStaff?.profile_image || "/default-avatar.png"}
                  alt={selectedStaff?.full_name}
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
                <div><strong>Role:</strong> {selectedStaff.role}</div>
                <div><strong>Department:</strong> {selectedStaff.department || "N/A"}</div>
                <div><strong>Status:</strong> {selectedStaff.status}</div>
                <div><strong>Phone:</strong> {selectedStaff.phone || "N/A"}</div>
                <div>
                  <strong>Created:</strong>{" "}
                  {selectedStaff.created_at
                    ? new Date(selectedStaff.created_at).toLocaleDateString()
                    : "N/A"}
                </div>
              </div>

              <div className={styles.modalActions}>
                <button onClick={() => setShowViewModal(false)}>Close</button>
              </div>

            </div>
          </div>
        )}


        {showEditModal && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalCardLarge}>

              <h2>Edit Staff</h2>

              <div className={styles.editGrid}>

                <label>Full Name</label>
                <input
                  value={editForm.full_name || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, full_name: e.target.value })
                  }
                />

                <label>Role</label>
                <input
                  value={editForm.role || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                />

                <label>Department</label>
                <input
                  value={editForm.department || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, department: e.target.value })
                  }
                />

                <label>Phone</label>
                <input
                  value={editForm.phone || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />

                <label>Email (Locked)</label>
                <input value={editForm.email || ""} disabled />

                <label>Profile Image (Locked)</label>
                <input value="Cannot edit" disabled />

              </div>

              <div className={styles.modalActions}>
                <button onClick={handleUpdateStaff}>Save Changes</button>
                <button onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}