import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/src/server/context";

export default async function SettingsPage() {
  const { store } = await requireAdmin();
  return (
    <>
      <PageHeader title="Settings" body="The name shown on the sign-in screen and in the header." />
      <SettingsForm siteName={store.settings.siteName} />
    </>
  );
}
