import styles from "@/app/components/PortalShell.module.css";

type PortalRole = "admin" | "staff" | "patient" | "doctor";

type PortalShellProps = {
  role: PortalRole;
  children: React.ReactNode;
  className?: string;
};

/**
 * PortalShell provides the shared sidebar offset for every portal role.
 *
 * CSS follows the `navCollapsed` class on <body> and removes the offset at the
 * same 900px breakpoint where the shared sidebar becomes a top navigation bar.
 */
export default function PortalShell({
  role,
  children,
  className = "",
}: PortalShellProps) {
  return (
    <div data-portal-role={role} className={`${styles.shell} ${className}`}>
      {children}
    </div>
  );
}