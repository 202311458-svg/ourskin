"use client";

import { useEffect, useState } from "react";
import styles from "@/app/components/PortalShell.module.css";

type PortalRole = "admin" | "staff" | "patient" | "doctor";

type PortalShellProps = {
  role: PortalRole;
  children: React.ReactNode;
  className?: string;
};

/**
 * PortalShell provides the correct sidebar offset for every portal role.
 *
 * It reads the `navCollapsed` class from <body> and applies the appropriate
 * margin-left and width based on the role's sidebar dimensions.
 *
 * On mobile (≤ 900px) the sidebar offset is removed and top padding is added
 * to account for the collapsed mobile navbar.
 */
export default function PortalShell({ role, children, className = "" }: PortalShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const checkNav = () => {
      setCollapsed(document.body.classList.contains("navCollapsed"));
    };

    checkNav();

    const observer = new MutationObserver(checkNav);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const roleClass = styles[role] || styles.admin;

  return (
    <div className={`${styles.shell} ${roleClass} ${collapsed ? styles.collapsed : ""} ${className}`}>
      {children}
    </div>
  );
}