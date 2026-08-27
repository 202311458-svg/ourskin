import type { ReactNode } from "react";
import styles from "./AdminToolbar.module.css";

type AdminToolbarProps = {
  children: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  ariaLabel?: string;
};

export default function AdminToolbar({
  children,
  meta,
  actions,
  className = "",
  ariaLabel = "Admin page filters",
}: AdminToolbarProps) {
  return (
    <div className={`${styles.toolbar} ${className}`.trim()} role="group" aria-label={ariaLabel}>
      <div className={styles.controls}>{children}</div>
      {(meta || actions) && (
        <div className={styles.trailing}>
          {meta ? <div className={styles.meta}>{meta}</div> : null}
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </div>
      )}
    </div>
  );
}
