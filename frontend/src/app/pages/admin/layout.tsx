import PortalFrame from "@/app/components/portal/PortalFrame";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <PortalFrame role="admin">{children}</PortalFrame>;
}