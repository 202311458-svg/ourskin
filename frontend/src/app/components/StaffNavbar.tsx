"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  FaCalendarAlt,
  FaUserMd,
  FaClipboardList,
  FaUsers,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBell,
  FaBars,
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";
import { useDarkMode } from "@/app/hooks/useDarkMode";

export default function StaffNavbar() {
  const router = useRouter();
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { darkMode, toggleDarkMode } = useDarkMode();

  const navItems = [
    { name: "Dashboard", path: "/pages/staff/dashboard", icon: <FaCalendarAlt /> },
    { name: "Appointment Requests", path: "/pages/staff/requests", icon: <FaClipboardList /> },
    { name: "Appointments", path: "/pages/staff/appointments", icon: <FaUserMd /> },
    { name: "History", path: "/pages/staff/history", icon: <FaUserMd /> },
    { name: "Profile", path: "/pages/staff/profile", icon: <FaUsers /> },
    { name: "Notifications", path: "/pages/staff/updates", icon: <FaBell /> },
  ];

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);

    if (newState) document.body.classList.add("navCollapsed");
    else document.body.classList.remove("navCollapsed");

    window.dispatchEvent(new CustomEvent("navbarToggle", { detail: newState }));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/");
  };

  return (
    <aside className={`${styles.navbar} ${collapsed ? styles.collapsed : ""}`}>
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
            {path === item.path && !collapsed && (
              <span className={styles.activeBar}></span>
            )}
          </div>
        ))}
      </nav>

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

      {mobileOpen && (
        <div className={styles.navLogoutMobile} onClick={handleLogout}>
          <FaSignOutAlt />
          <span>Logout</span>
        </div>
      )}
    </aside>
  );
}