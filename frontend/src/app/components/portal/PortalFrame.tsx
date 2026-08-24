"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FaBars,
  FaChevronLeft,
  FaMoon,
  FaSignOutAlt,
  FaSun,
  FaUserCircle,
} from "react-icons/fa";
import NotificationBell from "@/app/components/NotificationBell";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import { sidebarState } from "@/app/state/sidebarState";
import {
  getSession,
  logoutUser,
  markBrowserSession,
} from "@/app/utils/auth";
import {
  portalNavigation,
  profileRoutes,
  roleLabels,
  type PortalRole,
} from "./navigation";
import styles from "./PortalFrame.module.css";

type PortalFrameProps = {
  role: PortalRole;
  children: React.ReactNode;
};

const patientRouteTitles = [
  ["/pages/patient/dashboard", "Dashboard"],
  ["/pages/patient/home", "Dashboard"],
  ["/pages/patient/book", "Book an appointment"],
  ["/pages/patient/history", "Appointments"],
  ["/pages/patient/follow-ups", "Follow-ups"],
  ["/pages/patient/records", "Medical records"],
  ["/pages/patient/announcements", "Announcements"],
  ["/pages/patient/profile", "Profile"],
  ["/pages/patient/notifications", "Notifications"],
] as const;

const staffRouteTitles = [
  ["/pages/staff/dashboard", "Dashboard"],
  ["/pages/staff/requests", "Appointment Requests"],
  ["/pages/staff/appointments", "Appointments"],
  ["/pages/staff/schedules", "Schedules"],
  ["/pages/staff/follow-ups", "Follow-Ups"],
  ["/pages/staff/history", "History"],
  ["/pages/staff/announcements", "Announcements"],
  ["/pages/staff/profile", "Staff Profile"],
  ["/pages/staff/notifications", "Notifications"],
] as const;

const doctorRouteTitles = [
  ["/pages/doctor/dashboard", "Clinical overview"],
  ["/pages/doctor/appointments", "Appointments"],
  ["/pages/doctor/follow-ups", "Follow-ups"],
  ["/pages/doctor/patient-records", "Patient records"],
  ["/pages/doctor/ai-analysis", "AI clinical support"],
  ["/pages/doctor/ai-progress", "AI clinical support"],
  ["/pages/doctor/announcements", "Announcements"],
  ["/pages/doctor/settings", "Profile"],
] as const;

function isAiClinicalPath(pathname: string) {
  return (
    pathname === "/pages/doctor/ai-analysis" ||
    pathname.startsWith("/pages/doctor/ai-analysis/") ||
    pathname === "/pages/doctor/ai-progress" ||
    pathname.startsWith("/pages/doctor/ai-progress/")
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/pages/doctor/ai-analysis" && isAiClinicalPath(pathname)) {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRouteTitle(
  pathname: string,
  routes: readonly (readonly [string, string])[],
  fallback: string
) {
  return (
    routes.find(
      ([route]) => pathname === route || pathname.startsWith(`${route}/`)
    )?.[1] || fallback
  );
}

export default function PortalFrame({ role, children }: PortalFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [collapsed, setCollapsed] = useState(sidebarState.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const groups = portalNavigation[role];
  const aiClinicalWorkspace = role === "doctor" && isAiClinicalPath(pathname);

  const headerSummary = useMemo(() => {
    if (role === "patient") {
      return getRouteTitle(pathname, patientRouteTitles, "Patient portal");
    }
    if (role === "staff") {
      return getRouteTitle(pathname, staffRouteTitles, "Staff portal");
    }
    if (pathname.includes("notifications")) return "Notifications";
    if (role === "doctor") {
      return getRouteTitle(pathname, doctorRouteTitles, "Clinical workflow");
    }
    return "Administration";
  }, [pathname, role]);

  useEffect(() => {
    const unsubscribe = sidebarState.subscribe((value) => {
      setCollapsed(value);
      document.body.classList.toggle("navCollapsed", value);
    });
    document.body.classList.toggle("navCollapsed", sidebarState.collapsed);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const session = await getSession();
        if (cancelled) return;

        if (!session || session.role !== role) {
          router.replace("/");
          return;
        }

        markBrowserSession(session.role, session);
        setSessionReady(true);
      } catch {
        if (!cancelled) router.replace("/");
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [role, router]);

  const handleLogout = () => {
    document.body.classList.remove("navCollapsed");
    void logoutUser();
  };

  if (!sessionReady) {
    return (
      <div className={styles.frame} data-portal-role={role} aria-busy="true">
        <div id="portal-content" className={styles.content}>
          Verifying session…
        </div>
      </div>
    );
  }

  return (
    <div className={styles.frame} data-portal-role={role}>
      <a className={styles.skipLink} href="#portal-content">
        Skip to content
      </a>

      {mobileOpen && (
        <button
          type="button"
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
        aria-label={`${roleLabels[role]} navigation`}
      >
        <div className={styles.brand}>
          <button
            type="button"
            className={styles.brandButton}
            onClick={() => {
              sidebarState.toggle();
              setCollapsed(!collapsed);
            }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FaChevronLeft
              style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
            />
          </button>
          <div className={styles.brandCopy}>
            <span className={styles.brandIntro}>
              <span className={styles.brandBadge}>
                <Image src="/os-logo-col.png" alt="" width={24} height={24} />
              </span>
              <span className={styles.brandName}>OurSkin</span>
            </span>
            {role !== "patient" && role !== "staff" && (
              <span className={styles.brandRole}>{roleLabels[role]}</span>
            )}
          </div>
        </div>

        <nav className={styles.navigation}>
          {groups.map((group, groupIndex) => (
            <div className={styles.group} key={group.label ?? groupIndex}>
              {group.label && (
                <span className={styles.groupLabel}>{group.label}</span>
              )}
              <ul className={styles.navList}>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        className={`${styles.navLink} ${
                          active ? styles.navLinkActive : ""
                        }`}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className={styles.navIcon} aria-hidden="true">
                          {item.icon}
                        </span>
                        <span className={styles.navLabel}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {profileRoutes[role] && (
            <Link className={styles.navLink} href={profileRoutes[role]!}>
              <span className={styles.navIcon}>
                <FaUserCircle />
              </span>
              <span className={styles.navLabel}>Profile</span>
            </Link>
          )}
          <button
            type="button"
            className={styles.footerButton}
            onClick={toggleDarkMode}
          >
            <span className={styles.navIcon}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </span>
            <span>{darkMode ? "Light mode" : "Dark mode"}</span>
          </button>
          <button
            type="button"
            className={styles.footerButton}
            onClick={handleLogout}
          >
            <span className={styles.navIcon}>
              <FaSignOutAlt />
            </span>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.mobileButton}
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <FaBars />
          </button>

          <div className={styles.headerContext}>
            <span className={styles.headerRole}>{roleLabels[role]}</span>
            <span className={styles.headerRoute}>{headerSummary}</span>
          </div>

          {aiClinicalWorkspace && (
            <nav
              className={styles.aiModeSwitch}
              aria-label="AI clinical support mode"
            >
              <Link
                href="/pages/doctor/ai-analysis"
                className={`${styles.aiModeLink} ${
                  pathname.startsWith("/pages/doctor/ai-analysis")
                    ? styles.aiModeActive
                    : ""
                }`}
              >
                Assessment
              </Link>
              <Link
                href="/pages/doctor/ai-progress"
                className={`${styles.aiModeLink} ${
                  pathname.startsWith("/pages/doctor/ai-progress")
                    ? styles.aiModeActive
                    : ""
                }`}
              >
                Progress
              </Link>
            </nav>
          )}

          <div className={styles.headerActions}>
            <NotificationBell role={role} />
          </div>
        </header>

        <div
          id="portal-content"
          className={styles.content}
          data-ai-workspace={aiClinicalWorkspace ? "true" : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
