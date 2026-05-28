"use client";

import { useEffect, useState } from "react";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  FaTachometerAlt,
  FaUsersCog,
  FaCalendarCheck,
  FaRobot,
  FaUserShield,
  FaClipboardList,
  FaChartBar,
  FaBullhorn,
  FaSignOutAlt,
  FaMoon,
  FaSun,
  FaBars,
  FaTimes,
} from "react-icons/fa";

import styles from "@/app/styles/navbar.module.css";
import { sidebarState } from "@/app/state/sidebarState";

type AdminNavItem = {
  name: string;
  path: string;
  icon: React.ReactNode;
};

const navItems: AdminNavItem[] = [
  {
    name: "Dashboard",
    path: "/pages/admin/dashboard",
    icon: <FaTachometerAlt />,
  },
  {
    name: "Patients & Users",
    path: "/pages/admin/users",
    icon: <FaUsersCog />,
  },
  {
    name: "Schedules",
    path: "/pages/admin/schedules",
    icon: <FaCalendarCheck />,
  },
  {
    name: "Appointments",
    path: "/pages/admin/appointments",
    icon: <FaCalendarCheck />,
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
    icon: <FaChartBar />,
  },
  {
    name: "Announcements",
    path: "/pages/admin/announcements",
    icon: <FaBullhorn />,
  },
];

export default function AdminNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(sidebarState.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    document.body.classList.toggle("navCollapsed", collapsed);

    return () => {
      document.body.classList.remove("navCollapsed");
    };
  }, [collapsed]);

  useEffect(() => {
    const unsubscribe = sidebarState.subscribe((value) => {
      setCollapsed(value);
      document.body.classList.toggle("navCollapsed", value);
    });

    document.body.classList.toggle("navCollapsed", sidebarState.collapsed);

    return () => {
      unsubscribe();
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

  const isActiveRoute = (targetPath: string) => {
    if (!pathname) return false;

    if (targetPath === "/pages/admin/dashboard") {
      return pathname === targetPath;
    }

    return pathname === targetPath || pathname.startsWith(`${targetPath}/`);
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
                isActiveRoute(item.path) ? styles.active : ""
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