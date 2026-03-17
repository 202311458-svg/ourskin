"use client";

import { Dispatch, SetStateAction, useEffect, useState } from "react";
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
  FaBell,
  FaBars
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";

interface NavbarProps {
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
}

export default function Navbar({ darkMode, setDarkMode }: NavbarProps) {
  const router = useRouter();
  const path = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", path: "/pages/patient/dashboard", icon: <FaCalendarAlt /> },
    { name: "Book Appointment", path: "/pages/patient/book", icon: <FaPlusCircle /> },
    { name: "History", path: "/pages/patient/history", icon: <FaHistory /> },
    { name: "Profile", path: "/pages/patient/profile", icon: <FaUser /> },
    { name: "Updates", path: "/pages/patient/updates", icon: <FaBell /> },
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

  return (
    <aside className={`${styles.navbar} ${collapsed ? styles.collapsed : ""}`}>
      {/* LOGO & MOBILE TOGGLE */}
      <div className={styles.logoSection}>
        <Image
          src="/os-logo.png"
          alt="OurSkin"
          width={collapsed ? 50 : 160}
          height={collapsed ? 50 : 60}
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
            {path === item.path && !collapsed && <span className={styles.activeBar}></span>}
          </div>
        ))}
      </nav>

      {/* DARK MODE & LOGOUT */}
      <div className={styles.navBottom}>
        <div className={styles.navItem} onClick={() => setDarkMode(!darkMode)}>
          <span className={styles.icon}>{darkMode ? <FaSun /> : <FaMoon />}</span>
          {!collapsed && <span className={styles.label}>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
        </div>
        <div className={styles.navItem} onClick={() => router.push("/")}>
          <span className={styles.icon}><FaSignOutAlt /></span>
          {!collapsed && <span className={styles.label}>Logout</span>}
        </div>
      </div>

      {/* MOBILE LOGOUT */}
      {mobileOpen && (
        <div
          className={styles.navLogoutMobile}
          onClick={() => router.push("/")}
        >
          <FaSignOutAlt />
          <span>Logout</span>
        </div>
      )}
    </aside>
  );
}