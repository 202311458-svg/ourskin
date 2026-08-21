import type { ReactNode } from "react";

type PortalShellProps = {
  role?: "admin" | "staff" | "doctor" | "patient";
  children: ReactNode;
};

export default function PortalShell({ children }: PortalShellProps) {
  return <>{children}</>;
}
