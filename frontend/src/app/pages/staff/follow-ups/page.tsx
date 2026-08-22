import FollowUpWorkspace from "@/app/components/portal/FollowUpWorkspace";
import PageShell from "@/app/components/portal/ui/PageShell";

export default function Page() {
  return (
    <PageShell>
      <FollowUpWorkspace role="staff" />
    </PageShell>
  );
}
