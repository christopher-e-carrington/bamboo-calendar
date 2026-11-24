import { createFileRoute, Link } from "@tanstack/react-router";
import { InformationLayout } from "@/components/information-layout";
import { SUPPORT_EMAIL, informationHead } from "@/lib/app-information";
export const Route = createFileRoute("/support")({ head: () => informationHead("Support", "Contact Bamboo Calendar support for sign-in, household access, billing questions, and privacy requests."), component: SupportPage });
function SupportPage() {
  return <InformationLayout title="Support">
    <section><h2>Contact us</h2><p>Email <a className="break-all" href={`mailto:${SUPPORT_EMAIL}?subject=Bamboo%20Calendar%20support`}>{SUPPORT_EMAIL}</a>. Include your account email, device type, and a brief description of the problem. Never send passwords, profile PINs, payment-card details, or confidential household documents.</p></section>
    <section><h2>Sign-in and household access</h2><p>Use Forgot password on the sign-in screen for email/password accounts. If you joined through an invitation, use the email associated with that invitation. Household owners can manage users and send invitations from Settings.</p></section>
    <section><h2>Billing help</h2><p>For Apple or Google charges, refunds, or cancellation, use the store that billed you. We can help with Bamboo access after a purchase. See <Link to="/subscription">subscription information</Link>.</p></section>
    <section><h2>Privacy and account deletion</h2><p>Use our <Link to="/delete-account">account-deletion page</Link> to delete an account or request assistance without the installed app. Privacy requests can be sent to the address above. We may need to verify account ownership before acting on a request.</p></section>
  </InformationLayout>;
}