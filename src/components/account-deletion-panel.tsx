import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, getAccountDeletionSummary } from "@/lib/account.functions";
import { clearAccountDeviceData } from "@/lib/account-deletion";

export function AccountDeletionPanel() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const summaryFn = useServerFn(getAccountDeletionSummary);
  const deleteFn = useServerFn(deleteMyAccount);
  const summary = useQuery({ queryKey: ["account-deletion-summary", user?.id], queryFn: () => summaryFn(), enabled: !!user && open, staleTime: 0 });

  const remove = async () => {
    if (!confirmed || !summary.data || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteFn({ data: { confirm: true } });
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut({ scope: "local" });
      clearAccountDeviceData(window.localStorage);
      clearAccountDeviceData(window.sessionStorage);
      window.sessionStorage.setItem("bamboo:deletion-result", JSON.stringify({ deleted: true, appleLinked: result.appleLinked }));
      await navigate({ to: "/account-deleted" });
    } catch {
      setError("Deletion could not finish. Some cleanup may already have completed; please retry or contact support. Your account is not reported as deleted until every step succeeds.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">Permanently delete your sign-in account and any household you own. If you joined another household, its shared content stays with the remaining members and your profile is anonymized.</p>
      <p className="text-muted-foreground">Deleting Bamboo does not cancel Apple or Google subscriptions. Cancel store billing separately before deleting.</p>
      <Button variant="destructive" className="w-full gap-2" onClick={() => { setConfirmed(false); setError(""); setOpen(true); }}><Trash2 /> Delete my account</Button>
      <AlertDialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary.data?.hasOwnedHousehold
                ? "Your household profiles, schedules, tasks, notes, documents, photos, and other household records will be permanently removed. Invited members’ own sign-in accounts will not be deleted."
                : "Your sign-in account and personal records will be removed. Any household you joined keeps its shared content; your name, birthday, nickname, PIN, and account link are removed from its profile."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {summary.isFetching && <p className="text-sm text-muted-foreground" role="status">Checking your account…</p>}
          {summary.isError && <div className="space-y-2"><p className="text-sm text-destructive" role="alert">Could not check your account. Please try again.</p><Button variant="outline" onClick={() => void summary.refetch()}>Retry</Button></div>}
          <p className="text-sm text-muted-foreground">This cannot be undone. Apple or Google billing continues until cancelled through that store.</p>
          {summary.data?.appleLinked && <p className="text-sm text-muted-foreground">After deletion, you’ll also be offered a secure Apple page to disconnect your Apple authorization.</p>}
          <label className="flex items-start gap-3 text-sm"><Checkbox checked={confirmed} onCheckedChange={(value) => setConfirmed(value === true)} disabled={busy} aria-label="I understand deletion is permanent and store billing must be cancelled separately" /><span>I understand deletion is permanent and store billing must be cancelled separately.</span></label>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep account</AlertDialogCancel>
            <Button variant="destructive" disabled={!confirmed || !summary.data || summary.isFetching || busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete permanently"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}