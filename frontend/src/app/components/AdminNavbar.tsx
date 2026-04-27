"use client";

import { useState, useEffect } from "react";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarAlt,
  FaRobot,
  FaUserShield,
  FaClipboardList,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBars,
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";
import { sidebarState } from "@/app/state/sidebarState";

export default function AdminNavbar() {
  const router = useRouter();
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(sidebarState.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();


  const navItems = [
    { name: "Dashboard", path: "/pages/admin/dashboard", icon: <FaTachometerAlt /> },
    { name: "Users", path: "/pages/admin/users", icon: <FaUsers /> },
    { name: "Appointments", path: "/pages/admin/appointments", icon: <FaCalendarAlt /> },
    { name: "AI Review Monitor", path: "/pages/admin/ai-logs", icon: <FaRobot /> },
    { name: "Staff Management", path: "/pages/admin/staff-mgmt", icon: <FaUserShield /> },
    { name: "Audit Logs", path: "/pages/admin/audit-logs", icon: <FaClipboardList /> },
    { name: "Reports", path: "/pages/admin/reports", icon: <FaClipboardList /> },
  ];

  // sync sidebar state globally
  useEffect(() => {
    const unsub = sidebarState.subscribe(setCollapsed);
    return () => unsub();
  }, []);


  const toggleCollapse = () => {
    sidebarState.toggle();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/");
  };

  return (
    <aside className={`${styles.navbar} ${collapsed ? styles.collapsed : ""}`}>

      {/* LOGO */}
      <div className={styles.logoSection}>
        <Image
          src={collapsed ? "/os-logo-col.png" : "/os-logo.png"}
          alt="OurSkin"
          width={collapsed ? 70 : 170}
          height={collapsed ? 70 : 65}
          onClick={toggleCollapse}
        />

        <div
          className={styles.mobileToggle}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <FaBars />
        </div>
      </div>

      {/* NAV ITEMS */}
      <nav className={`${styles.navMenu} ${mobileOpen ? styles.mobileOpen : ""}`}>
        {navItems.map((item, idx) => (
          <div
            key={idx}
            className={`${styles.navItem} ${path === item.path ? styles.active : ""}`}
            onClick={() => {
              router.push(item.path);
              setMobileOpen(false);
            }}
          >
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={styles.label}>{item.name}</span>}
          </div>
        ))}
      </nav>

      {/* BOTTOM */}
      <div className={styles.navBottom}>
        <div className={styles.navItem} onClick={toggleDarkMode}>
          <span className={styles.icon}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </span>
          {!collapsed && (
            <span className={styles.label}>
              {darkMode ? "Light Mode" : "Dark Mode"}
            </span>
          )}
        </div>

        <div className={styles.navItem} onClick={handleLogout}>
          <span className={styles.icon}>
            <FaSignOutAlt />
          </span>
          {!collapsed && <span className={styles.label}>Logout</span>}
        </div>
      </div>
    </aside>
  );
}