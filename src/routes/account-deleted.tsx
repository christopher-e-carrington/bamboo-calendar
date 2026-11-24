import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { InformationLayout } from "@/components/information-layout";
import { Button } from "@/components/ui/button";
import { informationHead } from "@/lib/app-information";
export const Route = createFileRoute("/account-deleted")({ head: () => informationHead("Account deletion confirmation", "Bamboo account deletion confirmation and a secure way to disconnect managed Apple sign-in authorization."), component: AccountDeletedPage });
function AccountDeletedPage() {
  const [result, setResult] = useState<{ deleted: boolean; appleLinked: boolean } | null>(null);
  const [revokeUrl, setRevokeUrl] = useState("");
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.sessionStorage.getItem("bamboo:deletion-result") ?? "null");
      if (stored && typeof stored === "object" && "deleted" in stored && stored.deleted === true) {
        setResult({ deleted: true, appleLinked: "appleLinked" in stored && stored.appleLinked === true });
      }
    } catch { /* A direct visit is not proof of deletion. */ }
    setRevokeUrl(`${window.location.origin}/~oauth/apple/revoke?redirect_uri=${encodeURIComponent(window.location.origin)}`);
  }, []);
  return <InformationLayout title={result?.deleted ? "Account deleted" : "Account deletion"}>
    {result?.deleted ? <>
      <section><p>Your Bamboo account has been deleted. If you owned a household, its live household records and household-folder uploads were removed. If you joined a household, its shared content remains under an anonymized profile.</p><p>Deleting your account does not cancel Apple or Google store billing.</p></section>
      {result.appleLinked && <section><h2>Disconnect Apple</h2><p>Finish by disconnecting Apple’s authorization for Bamboo. Apple will ask you to sign in and confirm. Your Bamboo account stays deleted even if you cancel that step; you can retry below.</p><Button asChild><a href={revokeUrl} target="_blank" rel="noopener noreferrer">Disconnect Apple</a></Button></section>}
      <Button asChild variant="outline"><Link to="/subscription">Manage store billing</Link></Button>
    </> : <p>To start a verified deletion, visit the <Link to="/delete-account">account-deletion page</Link>.</p>}
  </InformationLayout>;
}