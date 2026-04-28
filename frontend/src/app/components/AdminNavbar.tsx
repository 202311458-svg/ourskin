"use client";

import { useState, useEffect, useTransition } from "react";
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
  FaTimes,
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";
import { sidebarState } from "@/app/state/sidebarState";

export default function AdminNavbar() {
  const router = useRouter();
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(sidebarState.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, startTransition] = useTransition();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const navItems = [
    {
      name: "Dashboard",
      path: "/pages/admin/dashboard",
      icon: <FaTachometerAlt />,
    },
    {
      name: "Users",
      path: "/pages/admin/users",
      icon: <FaUsers />,
    },
    {
      name: "Appointments",
      path: "/pages/admin/appointments",
      icon: <FaCalendarAlt />,
    },
    {
      name: "AI Review Monitor",
      path: "/pages/admin/ai-logs",
      icon: <FaRobot />,
    },
    {
      name: "Staff Management",
      path: "/pages/admin/staff-mgmt",
      icon: <FaUserShield />,
    },
    {
      name: "Audit Logs",
      path: "/pages/admin/audit-logs",
      icon: <FaClipboardList />,
    },
    {
      name: "Reports",
      path: "/pages/admin/reports",
      icon: <FaClipboardList />,
    },
  ];

useEffect(() => {
  document.body.classList.toggle("navCollapsed", collapsed);

  return () => {
    document.body.classList.remove("navCollapsed");
  };
}, [collapsed]);

useEffect(() => {
  const unsub = sidebarState.subscribe((value) => {
    setCollapsed(value);
    document.body.classList.toggle("navCollapsed", value);
  });

  document.body.classList.toggle("navCollapsed", sidebarState.collapsed);

  return () => {
    unsub();
  };
}, []);

  const toggleCollapse = () => {
    sidebarState.toggle();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/");
  };

  const goToPage = (targetPath: string) => {
    router.push(targetPath);
    setMobileOpen(false);
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
          priority
        />

        <button
          type="button"
          className={styles.mobileToggle}
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={mobileOpen ? "Close admin menu" : "Open admin menu"}
        >
          {mobileOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      <nav className={`${styles.navMenu} ${mobileOpen ? styles.mobileOpen : ""}`}>
        <div className={styles.navScrollArea}>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.path}
              className={`${styles.navItem} ${
                path === item.path ? styles.active : ""
              }`}
              onClick={() => goToPage(item.path)}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.name}</span>
            </button>
          ))}
        </div>

        <div className={styles.mobileActions}>
          <button
            type="button"
            className={styles.navItem}
            onClick={() => {
              toggleDarkMode();
              setMobileOpen(false);
            }}
          >
            <span className={styles.icon}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </span>
            <span className={styles.label}>
              {darkMode ? "Light Mode" : "Dark Mode"}
            </span>
          </button>

          <button
            type="button"
            className={styles.navItem}
            onClick={handleLogout}
          >
            <span className={styles.icon}>
              <FaSignOutAlt />
            </span>
            <span className={styles.label}>Logout</span>
          </button>
        </div>
      </nav>

      <div className={styles.navBottom}>
        <button type="button" className={styles.navItem} onClick={toggleDarkMode}>
          <span className={styles.icon}>
            {darkMode ? <FaSun /> : <FaMoon />}
          </span>
          <span className={styles.label}>
            {darkMode ? "Light Mode" : "Dark Mode"}
          </span>
        </button>

        <button type="button" className={styles.navItem} onClick={handleLogout}>
          <span className={styles.icon}>
            <FaSignOutAlt />
          </span>
          <span className={styles.label}>Logout</span>
        </button>
      </div>
    </aside>
  );
}