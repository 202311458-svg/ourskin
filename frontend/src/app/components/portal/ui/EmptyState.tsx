import React from "react";
import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export default function EmptyState({ title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${className}`} role="status">
      {title && <p className={styles.title}>{title}</p>}
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
