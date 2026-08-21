import PortalFrame from "@/app/components/portal/PortalFrame";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <PortalFrame role="staff">{children}</PortalFrame>;
}