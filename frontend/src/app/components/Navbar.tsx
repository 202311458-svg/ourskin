"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  FaCalendarAlt,
  FaHistory,
  FaUser,
  FaPlusCircle,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBars,
  FaTimes,
  FaNotesMedical,
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import { sidebarState } from "@/app/state/sidebarState";

export default function Navbar() {
  const router = useRouter();
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(sidebarState.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { darkMode, toggleDarkMode } = useDarkMode();

  const navItems = [
    {
      name: "Dashboard",
      path: "/pages/patient/dashboard",
      icon: <FaCalendarAlt />,
    },
    {
      name: "Book Appointment",
      path: "/pages/patient/book",
      icon: <FaPlusCircle />,
    },
    {
      name: "Appointment History",
      path: "/pages/patient/history",
      icon: <FaHistory />,
    },
    {
      name: "Medical Records",
      path: "/pages/patient/records",
      icon: <FaNotesMedical />,
    },
    {
      name: "Profile",
      path: "/pages/patient/profile",
      icon: <FaUser />,
    },
  ];

  useEffect(() => {
    const updateLayoutState = (value: boolean) => {
      setCollapsed(value);
      document.body.classList.toggle("navCollapsed", value);

      window.dispatchEvent(
        new CustomEvent("navbarToggle", {
          detail: value,
        })
      );
    };

    const unsubscribe = sidebarState.subscribe((value) => {
      updateLayoutState(value);
    });

    updateLayoutState(sidebarState.collapsed);

    return () => {
      unsubscribe();
      document.body.classList.remove("navCollapsed");
    };
  }, []);

  const toggleCollapse = () => {
    const nextState = !collapsed;

    sidebarState.toggle();

    document.body.classList.toggle("navCollapsed", nextState);

    window.dispatchEvent(
      new CustomEvent("navbarToggle", {
        detail: nextState,
      })
    );
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

  const isActive = (targetPath: string) => {
    return path === targetPath || path.startsWith(`${targetPath}/`);
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
          aria-label={mobileOpen ? "Close patient menu" : "Open patient menu"}
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
                isActive(item.path) ? styles.active : ""
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