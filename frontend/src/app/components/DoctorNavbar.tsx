"use client";

import { useEffect, useState } from "react";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  FaTachometerAlt,
  FaCalendarAlt,
  FaRobot,
  FaNotesMedical,
  FaUserClock,
  FaCog,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBars,
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";

export default function DoctorNavbar() {
  const router = useRouter();
  const path = usePathname();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;

    try {
      return localStorage.getItem("doctorNavbarCollapsed") === "true";
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    {
      name: "Dashboard",
      path: "/pages/doctor/dashboard",
      icon: <FaTachometerAlt />,
    },
    {
      name: "Appointments",
      path: "/pages/doctor/appointments",
      icon: <FaCalendarAlt />,
    },
    {
      name: "AI Analysis",
      path: "/pages/doctor/ai-analysis",
      icon: <FaRobot />,
    },
    {
      name: "Patient Records",
      path: "/pages/doctor/patient-records",
      icon: <FaNotesMedical />,
    },
    {
      name: "Follow-Ups",
      path: "/pages/doctor/follow-ups",
      icon: <FaUserClock />,
    },
    {
      name: "Settings",
      path: "/pages/doctor/settings",
      icon: <FaCog />,
    },
  ];

  useEffect(() => {
    if (collapsed) {
      document.body.classList.add("navCollapsed");
    } else {
      document.body.classList.remove("navCollapsed");
    }

    try {
      localStorage.setItem("doctorNavbarCollapsed", String(collapsed));
    } catch {
      // Ignore localStorage errors.
    }

    window.dispatchEvent(
      new CustomEvent("navbarToggle", { detail: collapsed })
    );
  }, [collapsed]);

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const handleNavigate = (itemPath: string) => {
    router.push(itemPath);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("doctorNavbarCollapsed");

    document.body.classList.remove("navCollapsed");

    setMobileOpen(false);
    router.push("/");
  };

  const handleThemeToggle = () => {
    toggleDarkMode();
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
          aria-label="Toggle navigation menu"
        >
          <FaBars />
        </button>
      </div>

      <nav
        className={`${styles.navMenu} ${
          mobileOpen ? styles.mobileOpen : ""
        }`}
      >
        <div className={styles.navScrollArea}>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.path}
              className={`${styles.navItem} ${
                path === item.path ? styles.active : ""
              }`}
              onClick={() => handleNavigate(item.path)}
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
            onClick={handleThemeToggle}
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
        <button
          type="button"
          className={styles.navItem}
          onClick={handleThemeToggle}
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
    </aside>
  );
}