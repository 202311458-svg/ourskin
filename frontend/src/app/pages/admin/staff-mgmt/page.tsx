"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "@/app/components/AdminNavbar";
import styles from "./staff-mgmt.module.css";

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

export default function StaffManagementPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");

    if (!token || role !== "admin") {
      router.push("/");
      return;
    }

    fetch("http://127.0.0.1:8000/admin/staff", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch staff");
        }
        return res.json();
      })
      .then((data) => {
        setStaff(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Staff fetch error:", err);
        setError("Unable to load staff records.");
      })
      .finally(() => {
        setLoading(false);
      });
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
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`http://127.0.0.1:8000/admin/staff/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "Inactive" }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      setStaff((prev) =>
        prev.map((member) =>
          member.id === id ? { ...member, status: "Inactive" } : member
        )
      );
    } catch (err) {
      console.error("Deactivate error:", err);
      alert("Could not deactivate staff account.");
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
              Manage internal users, roles, and account status.
            </p>
          </div>

          <button className={styles.addButton}>+ Add Staff</button>
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
                        <img
                          src={member.profile_image || "/default-avatar.png"}
                          alt={member.full_name}
                          className={styles.avatar}
                        />
                        <div>
                          <strong>{member.full_name}</strong>
                          <p>{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{member.role}</td>
                    <td>{member.department || "N/A"}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          member.status?.toLowerCase() === "active"
                            ? styles.active
                            : styles.inactive
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td>
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.viewBtn}>View</button>
                        <button className={styles.editBtn}>Edit</button>
                        {member.status?.toLowerCase() === "active" && (
                          <button
                            className={styles.deactivateBtn}
                            onClick={() => handleDeactivate(member.id)}
                          >
                            Deactivate
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
      </div>
    </div>
  );
}