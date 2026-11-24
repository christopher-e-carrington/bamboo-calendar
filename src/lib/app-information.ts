export const APP_OPERATOR = "Bamboo Innovations LLC";
export const SUPPORT_EMAIL = "Bamboo.innovations.app@gmail.com";
export const POLICY_UPDATED = "November 24, 2026";

export function informationHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Bamboo Calendar` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Bamboo Calendar` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}

export const INFORMATION_LINKS = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/support", label: "Support" },
  { to: "/subscription", label: "Subscriptions" },
  { to: "/delete-account", label: "Account deletion" },
] as const;