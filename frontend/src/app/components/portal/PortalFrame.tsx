"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FaBars, FaChevronLeft, FaMoon, FaSignOutAlt, FaSun, FaUserCircle } from "react-icons/fa";
import NotificationBell from "@/app/components/NotificationBell";
import { useDarkMode } from "@/app/hooks/useDarkMode";
import { sidebarState } from "@/app/state/sidebarState";
import { getSession, logoutUser, markBrowserSession } from "@/app/utils/auth";
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PortalFrame({ role, children }: PortalFrameProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { darkMode, toggleDarkMode } = useDarkMode();
  const [collapsed, setCollapsed] = useState(sidebarState.collapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const groups = portalNavigation[role];
  const headerSummary = useMemo(() => {
    if (pathname.includes("notifications")) return "Notifications";
    if (role === "patient") return "Care overview";
    if (role === "doctor") return "Clinical workflow";
    if (role === "staff") return "Operations";
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
        <div id="portal-content" className={styles.content}>Verifying session…</div>
      </div>
    );
  }

  return (
    <div className={styles.frame} data-portal-role={role}>
      <a className={styles.skipLink} href="#portal-content">Skip to content</a>

      {mobileOpen && (
        <button
          type="button"
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`} aria-label={`${roleLabels[role]} navigation`}>
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
            <FaChevronLeft style={{ transform: collapsed ? "rotate(180deg)" : undefined }} />
          </button>
          <div className={styles.brandCopy}>
            <span className={styles.brandIntro}>
              <span className={styles.brandBadge}>
                <Image src="/os-logo-col.png" alt="" width={24} height={24} />
              </span>
              <span className={styles.brandName}>OurSkin</span>
            </span>
            <span className={styles.brandRole}>{roleLabels[role]}</span>
          </div>
        </div>

        <nav className={styles.navigation}>
          {groups.map((group, groupIndex) => (
            <div className={styles.group} key={group.label ?? groupIndex}>
              {group.label && <span className={styles.groupLabel}>{group.label}</span>}
              <ul className={styles.navList}>
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
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
              <span className={styles.navIcon}><FaUserCircle /></span>
              <span className={styles.navLabel}>Profile</span>
            </Link>
          )}
          <button type="button" className={styles.footerButton} onClick={toggleDarkMode}>
            <span className={styles.navIcon}>{darkMode ? <FaSun /> : <FaMoon />}</span>
            <span>{darkMode ? "Light mode" : "Dark mode"}</span>
          </button>
          <button type="button" className={styles.footerButton} onClick={handleLogout}>
            <span className={styles.navIcon}><FaSignOutAlt /></span>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.header}>
          <button type="button" className={styles.mobileButton} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <FaBars />
          </button>
          <div className={styles.headerContext}>
            <span className={styles.headerRole}>{roleLabels[role]}</span>
            <span className={styles.headerRoute}>{headerSummary}</span>
          </div>
          <div className={styles.headerActions}>
            <NotificationBell role={role} />
            <button type="button" className={styles.headerButton} onClick={toggleDarkMode} aria-label={darkMode ? "Use light mode" : "Use dark mode"}>
              {darkMode ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        </header>
        <div id="portal-content" className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
