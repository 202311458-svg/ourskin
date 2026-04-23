"use client";

import { useState, useEffect } from "react";
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

  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", path: "/pages/doctor/dashboard", icon: <FaTachometerAlt /> },
    { name: "Appointments", path: "/pages/doctor/appointments", icon: <FaCalendarAlt /> },
    { name: "AI Analysis", path: "/pages/doctor/ai-analysis", icon: <FaRobot /> },
    { name: "Patient Records", path: "/pages/doctor/patient-records", icon: <FaNotesMedical /> },
    { name: "Follow-Ups", path: "/pages/doctor/follow-ups", icon: <FaUserClock /> },
    { name: "Settings", path: "/pages/doctor/settings", icon: <FaCog /> },
  ];

  useEffect(() => {
    if (darkMode) document.body.classList.add("darkMode");
    else document.body.classList.remove("darkMode");
  }, [darkMode]);

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
          {path === item.path && !collapsed && <span className={styles.activeBar}></span>}
        </div>
      ))}
    </nav>

      <div className={styles.navBottom}>
        <div className={styles.navItem} onClick={() => setDarkMode(!darkMode)}>
          <span className={styles.icon}>{darkMode ? <FaSun /> : <FaMoon />}</span>
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
        <div
          className={styles.navLogoutMobile}
          onClick={handleLogout}
        >
          <FaSignOutAlt />
          <span>Logout</span>
        </div>
      )}
    </aside>
  );
}