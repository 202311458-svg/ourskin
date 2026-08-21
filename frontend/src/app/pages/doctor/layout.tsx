import PortalFrame from "@/app/components/portal/PortalFrame";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <PortalFrame role="doctor">{children}</PortalFrame>;
}