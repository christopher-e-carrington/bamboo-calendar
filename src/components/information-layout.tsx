import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_OPERATOR, INFORMATION_LINKS, POLICY_UPDATED } from "@/lib/app-information";

export function InformationLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="App information" className={`flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs ${className}`}>
      {INFORMATION_LINKS.map((link) => (
        <Link key={link.to} to={link.to} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{link.label}</Link>
      ))}
    </nav>
  );
}

export function InformationLayout({ title, children, dated = false }: {
  title: string; children: React.ReactNode; dated?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg">
            <img src="/app-icon-192.png" alt="" className="h-8 w-8 rounded-md" /> Bamboo Calendar
          </Link>
          <Button asChild variant="ghost" size="icon" aria-label="Back to Bamboo"><Link to="/"><ArrowLeft /></Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <h1 className="font-display text-3xl">{title}</h1>
        {dated && <p className="mt-2 text-xs text-muted-foreground">Last updated {POLICY_UPDATED} · {APP_OPERATOR}</p>}
        <div className="mt-8 space-y-7 text-sm leading-7 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-xl [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">
          {children}
        </div>
      </main>
      <footer className="mx-auto max-w-3xl border-t border-border px-5 py-6">
        <InformationLinks />
        <p className="mt-4 text-center text-xs text-muted-foreground">{APP_OPERATOR}</p>
      </footer>
    </div>
  );
}