import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./AdminActionButton.module.css";

type AdminActionTone = "primary" | "secondary" | "danger" | "success" | "ghost";

type AdminActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: AdminActionTone;
  icon?: ReactNode;
  fullWidth?: boolean;
};

export default function AdminActionButton({
  tone = "secondary",
  icon,
  fullWidth = false,
  className = "",
  children,
  type = "button",
  ...props
}: AdminActionButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={`${styles.button} ${styles[tone]} ${fullWidth ? styles.fullWidth : ""} ${className}`.trim()}
    >
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
