import { createFileRoute, Link } from "@tanstack/react-router";
import { InformationLayout } from "@/components/information-layout";
import { AccountDeletionPanel } from "@/components/account-deletion-panel";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { SUPPORT_EMAIL, informationHead } from "@/lib/app-information";
export const Route = createFileRoute("/delete-account")({ head: () => informationHead("Delete your account", "Delete a Bamboo Calendar account online or contact Bamboo Innovations LLC to request deletion without the installed app."), component: DeleteAccountPage });
function DeleteAccountPage() {
  const { user, loading } = useAuth();
  return <InformationLayout title="Delete your account">
    <section><h2>Delete online or in the app</h2><p>In Bamboo, open Settings → Delete account. You can also sign in here to delete without the installed app. Deletion removes your sign-in account and any household you own; it does not delete invited members’ separate accounts. If you joined another household, its shared content remains and your identifying profile details are removed.</p></section>
    <section>{loading ? <p role="status">Checking sign-in…</p> : user ? <><p className="mb-4 break-all">Signed in as {user.email}</p><AccountDeletionPanel /></> : <Button asChild><Link to="/">Sign in to delete your account</Link></Button>}</section>
    <section><h2>Request deletion by email</h2><p>If you cannot sign in, email <a className="break-all" href={`mailto:${SUPPORT_EMAIL}?subject=Bamboo%20account%20deletion%20request`}>{SUPPORT_EMAIL}</a> from your account email address with the subject “Bamboo account deletion request.” Include the account email and whether you own or joined the household. We will verify ownership before deleting data. Do not send your password or PIN.</p></section>
    <section><h2>Billing and retained information</h2><p>Cancel any Apple or Google subscription separately before deletion. Shared contributions retained by another household, copies other members downloaded, provider backups awaiting expiry, and legally required records may remain as explained in the <Link to="/privacy">privacy policy</Link>.</p></section>
  </InformationLayout>;
}