"use client";

import AnnouncementManager from "@/app/components/AnnouncementManager";
import PageShell from "@/app/components/portal/ui/PageShell";

export default function StaffAnnouncementsPage() {
  return (
    <PageShell>
      <AnnouncementManager roleLabel="Staff" />
    </PageShell>
  );
}
