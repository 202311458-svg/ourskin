import PortalShell from "@/app/components/PortalShell";

export default function PortalPageLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="patient">{children}</PortalShell>;
}
