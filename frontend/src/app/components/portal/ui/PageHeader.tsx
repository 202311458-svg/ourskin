import React from "react";
import styles from "./PageHeader.module.css";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.text}>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className={styles.actions}>
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
